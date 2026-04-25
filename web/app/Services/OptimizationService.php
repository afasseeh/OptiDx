<?php

namespace App\Services;

use App\Models\DiagnosticTest;
use Illuminate\Support\Arr;

class OptimizationService
{
    private const LARGE_RATIO_SENTINEL = 1_000_000_000_000.0;

    public function __construct(
        private readonly PathwayDefinitionService $definitions,
        private readonly PythonEngineBridge $bridge,
    ) {
    }

    public function optimize(array $tests, array $constraints = [], ?float $prevalence = null): array
    {
        $startedAt = hrtime(true);
        $constraints = $this->normalizeConstraints($constraints);
        $tests = $this->normalizeTests($tests);
        $tests = $this->filterTestsByAllowedSampleTypes($tests, $constraints);
        $templates = [];

        foreach ($this->buildTemplates($tests, $constraints) as $template) {
            $validation = $this->definitions->validate($template);
            if (! $validation['valid']) {
                continue;
            }

            $templates[] = $template;
        }

        $evaluation = $this->bridge->optimize([
            'templates' => $templates,
            'prevalence' => $prevalence,
        ]);

        $candidates = [];
        foreach ($evaluation['ranked_results'] ?? [] as $index => $candidate) {
            $template = $templates[$index] ?? $candidate['pathway'] ?? null;
            if (! is_array($template)) {
                continue;
            }

            $metrics = $candidate['metrics'] ?? [];
            $row = [
                'pathway' => $template,
                'metrics' => $this->enrichMetrics($metrics),
                'warnings' => $candidate['warnings'] ?? [],
                'label' => $template['metadata']['label'] ?? 'Candidate pathway',
            ];

            if (! $this->passesConstraints($row['metrics'], $constraints)) {
                continue;
            }

            $candidates[] = $row;
        }

        usort($candidates, function (array $left, array $right): int {
            $leftScore = $this->candidateScore($left['metrics']);
            $rightScore = $this->candidateScore($right['metrics']);

            if ($leftScore === $rightScore) {
                return ($left['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX) <=> ($right['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX);
            }

            return $leftScore <=> $rightScore;
        });

        $candidates = array_values($candidates);
        foreach ($candidates as $index => $candidate) {
            $candidates[$index]['candidate_index'] = $index;
        }

        $paretoFrontier = $this->paretoFrontier($candidates);

        return [
            'candidate_count' => count($candidates),
            'feasible_count' => count($candidates),
            'ranked_results' => $candidates,
            'pareto_frontier' => $paretoFrontier,
            'named_rankings' => $this->buildNamedRankings($candidates),
            'run_ms' => (int) round((hrtime(true) - $startedAt) / 1_000_000),
        ];
    }

    private function filterTestsByAllowedSampleTypes(array $tests, array $constraints): array
    {
        $allowedSampleTypes = array_values(array_filter(array_map(
            static fn ($value) => strtolower(trim((string) $value)),
            Arr::wrap($constraints['allowed_sample_types'] ?? [])
        ), static fn (string $value) => $value !== ''));

        if ($allowedSampleTypes === []) {
            return $tests;
        }

        $filtered = [];
        foreach ($tests as $id => $test) {
            if (! is_array($test)) {
                continue;
            }

            $sampleTypes = array_values(array_filter(array_map(
                static fn ($value) => strtolower(trim((string) $value)),
                $test['sample_types'] ?? []
            ), static fn (string $value) => $value !== ''));

            if ($sampleTypes === [] || array_intersect($allowedSampleTypes, $sampleTypes) !== []) {
                $filtered[$id] = $test;
            }
        }

        return $filtered;
    }

    private function buildTemplates(array $tests, array $constraints): array
    {
        $testIds = array_keys($tests);
        $candidates = [];
        $maxTestsPerPath = max(1, (int) ($constraints['max_tests_per_path'] ?? 4));

        foreach ($testIds as $id) {
            $candidates[] = $this->singleTestTemplate($id, $tests[$id]);
        }

        if ($maxTestsPerPath >= 2) {
            $count = count($testIds);
            for ($i = 0; $i < $count; $i++) {
                for ($j = 0; $j < $count; $j++) {
                    if ($i === $j) {
                        continue;
                    }

                    $first = $testIds[$i];
                    $second = $testIds[$j];
                    $candidates[] = $this->serialConfirmatoryTemplate($first, $second, $tests);
                    $candidates[] = $this->serialRescueTemplate($first, $second, $tests);
                }
            }

            if ($maxTestsPerPath >= 3 && count($testIds) >= 3 && ($constraints['max_parallel_block_size'] ?? 3) >= 3) {
                $parallelIds = array_slice($this->rankParallelTestIds($testIds, $tests), 0, 3);
                if (count($parallelIds) === 3) {
                    $candidates[] = $this->parallelOrTemplate($parallelIds, $tests);
                    $candidates[] = $this->parallelAndTemplate($parallelIds, $tests);
                }
            }

            for ($i = 0; $i < $count; $i++) {
                for ($j = $i + 1; $j < $count; $j++) {
                    $first = $testIds[$i];
                    $second = $testIds[$j];
                    $candidates[] = $this->parallelOrTemplate([$first, $second], $tests);
                    $candidates[] = $this->parallelAndTemplate([$first, $second], $tests);

                    $referee = $this->selectRefereeTestId($testIds, $first, $second, $tests);
                    if ($referee !== null) {
                        $candidates[] = $this->discordantRefereeTemplate($first, $second, $referee, $tests);
                    }
                }
            }
        }

        return $this->dedupeTemplates($candidates);
    }

    private function singleTestTemplate(string $testId, array $test): array
    {
        return [
            'start_node' => 'start',
            'tests' => [$testId => $test],
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$testId], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$testId => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$testId => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Single test'],
        ];
    }

    private function serialConfirmatoryTemplate(string $first, string $second, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$first => 'pos'], 'next_node' => 'confirm'],
                        ['conditions' => [$first => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'confirm' => [
                    'action' => ['test_names' => [$second], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$second => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Serial confirmatory'],
        ];
    }

    private function serialRescueTemplate(string $first, string $second, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$first => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$first => 'neg'], 'next_node' => 'rescue'],
                    ],
                ],
                'rescue' => [
                    'action' => ['test_names' => [$second], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$second => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Serial rescue'],
        ];
    }

    private function parallelOrTemplate(array $testIds, array $tests): array
    {
        $branches = $this->exactOutcomeBranches($testIds, function (array $outcomes): string {
            return in_array('pos', array_values($outcomes), true) ? 'final_positive' : 'final_negative';
        });

        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, $testIds),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => $testIds, 'mode' => 'parallel', 'parallel_time' => true],
                    'branches' => $branches,
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => count($testIds) > 2 ? 'Parallel OR trio' : 'Parallel OR'],
        ];
    }

    private function parallelAndTemplate(array $testIds, array $tests): array
    {
        $branches = $this->exactOutcomeBranches($testIds, function (array $outcomes): string {
            return count(array_filter($outcomes, static fn (string $outcome): bool => $outcome === 'pos')) === count($outcomes)
                ? 'final_positive'
                : 'final_negative';
        });

        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, $testIds),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => $testIds, 'mode' => 'parallel', 'parallel_time' => true],
                    'branches' => $branches,
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => count($testIds) > 2 ? 'Parallel AND trio' : 'Parallel AND'],
        ];
    }

    private function discordantRefereeTemplate(string $first, string $second, string $referee, array $tests): array
    {
        return [
            'start_node' => 'start',
            'tests' => Arr::only($tests, [$first, $second, $referee]),
            'nodes' => [
                'start' => [
                    'action' => ['test_names' => [$first, $second], 'mode' => 'parallel', 'parallel_time' => true],
                    'branches' => [
                        ['conditions' => [$first => 'pos', $second => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$first => 'neg', $second => 'neg'], 'next_node' => 'final_negative'],
                        ['conditions' => [$first => 'pos', $second => 'neg'], 'next_node' => 'referee'],
                        ['conditions' => [$first => 'neg', $second => 'pos'], 'next_node' => 'referee'],
                    ],
                ],
                'referee' => [
                    'action' => ['test_names' => [$referee], 'mode' => 'sequential', 'parallel_time' => false],
                    'branches' => [
                        ['conditions' => [$referee => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => [$referee => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => ['final_classification' => 'positive'],
                'final_negative' => ['final_classification' => 'negative'],
            ],
            'metadata' => ['label' => 'Discordant referee'],
        ];
    }

    private function passesConstraints(array $metrics, array $constraints): bool
    {
        $maximumCost = $constraints['maximum_total_cost']
            ?? $constraints['max_expected_cost']
            ?? $constraints['max_worst_case_cost']
            ?? null;
        $maximumTat = $constraints['maximum_turnaround_time']
            ?? $constraints['max_expected_tat']
            ?? $constraints['max_worst_case_tat']
            ?? null;
        $maximumSkill = $constraints['maximum_skill_level']
            ?? $constraints['max_skill_level']
            ?? null;
        $minimumSensitivity = $constraints['minimum_sensitivity']
            ?? $constraints['min_sensitivity']
            ?? null;
        $minimumSpecificity = $constraints['minimum_specificity']
            ?? $constraints['min_specificity']
            ?? null;
        $forbiddenSamples = array_values(array_filter(array_map(
            static fn ($value) => strtolower(trim((string) $value)),
            Arr::wrap($constraints['forbidden_samples'] ?? [])
        ), static fn (string $value) => $value !== ''));

        if ($maximumCost !== null && ($metrics['expected_cost_population'] ?? $metrics['expected_cost_given_disease'] ?? PHP_FLOAT_MAX) > $maximumCost) {
            return false;
        }

        if ($maximumTat !== null && ($metrics['expected_turnaround_time_population'] ?? $metrics['expected_turnaround_time_given_disease'] ?? PHP_FLOAT_MAX) > $maximumTat) {
            return false;
        }

        if ($maximumSkill !== null && ($metrics['max_skill_required'] ?? 0) > $maximumSkill) {
            return false;
        }

        if ($minimumSensitivity !== null && ($metrics['sensitivity'] ?? 0) < $minimumSensitivity) {
            return false;
        }

        if ($minimumSpecificity !== null && ($metrics['specificity'] ?? 0) < $minimumSpecificity) {
            return false;
        }

        if ($forbiddenSamples !== []) {
            $sampleTypes = array_values(array_filter(array_map(
                static fn ($value) => strtolower(trim((string) $value)),
                Arr::wrap($metrics['all_sample_types_required'] ?? [])
            ), static fn (string $value) => $value !== ''));

            if (array_intersect($forbiddenSamples, $sampleTypes) !== []) {
                return false;
            }
        }

        return true;
    }

    private function normalizeConstraints(array $constraints): array
    {
        return array_filter($constraints, static fn ($value) => $value !== null);
    }

    private function normalizeTests(array $tests): array
    {
        $normalized = [];
        foreach ($tests as $key => $test) {
            if (! is_array($test)) {
                continue;
            }

            $resolvedKey = $test['id'] ?? (is_string($key) ? $key : $test['name'] ?? null);
            if (! $resolvedKey) {
                continue;
            }

            $normalized[(string) $resolvedKey] = $this->normalizeTestRecord($test);
        }

        return $normalized;
    }

    private function normalizeTestRecord(array $test): array
    {
        $sampleTypes = $test['sample_types'] ?? null;
        if (is_string($sampleTypes)) {
            $sampleTypes = [$sampleTypes];
        }

        if (! is_array($sampleTypes)) {
            $sampleTypes = isset($test['sample']) ? [$test['sample']] : [];
        }

        return [
            ...$test,
            'sensitivity' => (float) ($test['sensitivity'] ?? $test['sens'] ?? 0),
            'specificity' => (float) ($test['specificity'] ?? $test['spec'] ?? 0),
            'turnaround_time' => $this->numberOrNull($test['turnaround_time'] ?? $test['tat'] ?? null),
            'turnaround_time_unit' => $test['turnaround_time_unit'] ?? $test['tatUnit'] ?? null,
            'sample_types' => array_values(array_filter(array_map(
                static fn ($value) => is_string($value) ? trim($value) : (string) $value,
                $sampleTypes
            ), static fn (string $value) => $value !== '')),
            'skill_level' => $this->skillLevel($test['skill_level'] ?? null, $test['skill_label'] ?? $test['skill'] ?? null),
        ];
    }

    private function selectRefereeTestId(array $testIds, string $first, string $second, array $tests): ?string
    {
        $remaining = array_values(array_filter($testIds, static fn (string $testId): bool => ! in_array($testId, [$first, $second], true)));
        if ($remaining === []) {
            return null;
        }

        usort($remaining, function (string $left, string $right) use ($tests): int {
            $leftTest = $tests[$left] ?? [];
            $rightTest = $tests[$right] ?? [];

            $leftScore = $this->refereeScore($leftTest);
            $rightScore = $this->refereeScore($rightTest);

            if ($leftScore === $rightScore) {
                return strcmp($left, $right);
            }

            return $rightScore <=> $leftScore;
        });

        return $remaining[0] ?? null;
    }

    private function rankParallelTestIds(array $testIds, array $tests): array
    {
        usort($testIds, function (string $left, string $right) use ($tests): int {
            $leftScore = $this->refereeScore($tests[$left] ?? []);
            $rightScore = $this->refereeScore($tests[$right] ?? []);

            if ($leftScore === $rightScore) {
                return strcmp($left, $right);
            }

            return $rightScore <=> $leftScore;
        });

        return $testIds;
    }

    private function refereeScore(array $test): float
    {
        return (
            ((float) ($test['specificity'] ?? $test['spec'] ?? 0)) * 2
            + ((float) ($test['sensitivity'] ?? $test['sens'] ?? 0))
            - ((float) ($test['cost'] ?? 0)) * 0.05
        );
    }

    private function exactOutcomeBranches(array $testIds, callable $classify): array
    {
        $branches = [];
        foreach ($this->outcomeCombinations($testIds) as $outcomes) {
            $branches[] = [
                'conditions' => $outcomes,
                'next_node' => $classify($outcomes),
            ];
        }

        return $branches;
    }

    private function outcomeCombinations(array $testIds): array
    {
        $results = [];
        $this->expandOutcomeCombinations(array_values($testIds), 0, [], $results);

        return $results;
    }

    private function expandOutcomeCombinations(array $testIds, int $index, array $current, array &$results): void
    {
        if ($index >= count($testIds)) {
            $results[] = $current;
            return;
        }

        $testId = $testIds[$index];
        $current[$testId] = 'pos';
        $this->expandOutcomeCombinations($testIds, $index + 1, $current, $results);

        $current[$testId] = 'neg';
        $this->expandOutcomeCombinations($testIds, $index + 1, $current, $results);
    }

    private function dedupeTemplates(array $templates): array
    {
        $deduped = [];
        $seen = [];

        foreach ($templates as $template) {
            if (! is_array($template)) {
                continue;
            }

            $signature = $this->templateSignature($template);
            if (isset($seen[$signature])) {
                continue;
            }

            $seen[$signature] = true;
            $deduped[] = $template;
        }

        return $deduped;
    }

    private function templateSignature(array $template): string
    {
        return hash('sha256', json_encode([
            $template['metadata']['label'] ?? null,
            $template['start_node'] ?? null,
            $template['tests'] ?? [],
            $template['nodes'] ?? [],
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function enrichMetrics(array $metrics): array
    {
        $cost = $this->metricCost($metrics);
        $tat = $this->metricTat($metrics);
        $sensitivity = (float) ($metrics['sensitivity'] ?? 0);
        $specificity = (float) ($metrics['specificity'] ?? 0);
        $truePositivesPerThousand = (float) ($metrics['expected_true_positives_per_1000'] ?? 0);

        return [
            ...$metrics,
            'expected_cost_population' => $cost,
            'expected_turnaround_time_population' => $tat,
            'balanced_accuracy' => ($sensitivity + $specificity) / 2,
            'youden_index' => $sensitivity + $specificity - 1,
            'diagnostic_odds_ratio' => $this->diagnosticOddsRatio($sensitivity, $specificity),
            'cost_per_detected_case' => $truePositivesPerThousand > 0
                ? $cost / ($truePositivesPerThousand / 1000)
                : null,
        ];
    }

    private function candidateScore(array $metrics): float
    {
        $cost = $this->metricCost($metrics);
        $tat = $this->metricTat($metrics);
        $sensitivity = (float) ($metrics['sensitivity'] ?? 0);
        $specificity = (float) ($metrics['specificity'] ?? 0);

        return ($cost * 1.0) + ($tat * 0.45) - ($sensitivity * 35.0) - ($specificity * 25.0);
    }

    private function paretoFrontier(array $candidates): array
    {
        $frontier = [];

        foreach ($candidates as $index => $candidate) {
            $dominated = false;
            foreach ($candidates as $otherIndex => $otherCandidate) {
                if ($index === $otherIndex) {
                    continue;
                }

                if ($this->dominates($otherCandidate['metrics'] ?? [], $candidate['metrics'] ?? [])) {
                    $dominated = true;
                    break;
                }
            }

            if (! $dominated) {
                $frontier[] = $candidate;
            }
        }

        usort($frontier, function (array $left, array $right): int {
            $leftScore = $this->candidateScore($left['metrics'] ?? []);
            $rightScore = $this->candidateScore($right['metrics'] ?? []);

            if ($leftScore === $rightScore) {
                return ($left['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX) <=> ($right['metrics']['expected_cost_population'] ?? PHP_FLOAT_MAX);
            }

            return $leftScore <=> $rightScore;
        });

        return array_values($frontier);
    }

    private function dominates(array $left, array $right): bool
    {
        $leftCost = $this->metricCost($left);
        $rightCost = $this->metricCost($right);
        $leftTat = $this->metricTat($left);
        $rightTat = $this->metricTat($right);
        $leftSens = (float) ($left['sensitivity'] ?? 0);
        $rightSens = (float) ($right['sensitivity'] ?? 0);
        $leftSpec = (float) ($left['specificity'] ?? 0);
        $rightSpec = (float) ($right['specificity'] ?? 0);

        $noWorse = $leftCost <= $rightCost
            && $leftTat <= $rightTat
            && $leftSens >= $rightSens
            && $leftSpec >= $rightSpec;

        $strictlyBetter = $leftCost < $rightCost
            || $leftTat < $rightTat
            || $leftSens > $rightSens
            || $leftSpec > $rightSpec;

        return $noWorse && $strictlyBetter;
    }

    private function buildNamedRankings(array $candidates): array
    {
        $buckets = [
            ['key' => 'cheapest', 'label' => 'Cheapest', 'metric_name' => 'expected_cost_population', 'direction' => 'min'],
            ['key' => 'most_cost_effective', 'label' => 'Most cost-effective', 'metric_name' => 'cost_per_detected_case', 'direction' => 'min'],
            ['key' => 'highest_sensitivity', 'label' => 'Highest sensitivity', 'metric_name' => 'sensitivity', 'direction' => 'max'],
            ['key' => 'highest_dor', 'label' => 'Highest Diagnostic Odds Ratio (DOR)', 'metric_name' => 'diagnostic_odds_ratio', 'direction' => 'max'],
            ['key' => 'least_cost_per_positive_test', 'label' => 'Least cost per positive test', 'metric_name' => 'cost_per_detected_case', 'direction' => 'min'],
            ['key' => 'highest_balanced_accuracy', 'label' => 'Highest Balanced Accuracy', 'metric_name' => 'balanced_accuracy', 'direction' => 'max'],
            ['key' => 'highest_youden_index', 'label' => 'Highest Youden\'s Index (J)', 'metric_name' => 'youden_index', 'direction' => 'max'],
            ['key' => 'least_turnaround_time', 'label' => 'Least turnaround time', 'metric_name' => 'expected_turnaround_time_population', 'direction' => 'min'],
            ['key' => 'lowest_average_cost_per_patient', 'label' => 'Lowest average cost per patient', 'metric_name' => 'expected_cost_population', 'direction' => 'min'],
        ];

        $rankings = [];
        foreach ($buckets as $bucket) {
            $best = $this->bestCandidateForMetric($candidates, $bucket['metric_name'], $bucket['direction']);
            if ($best === null) {
                continue;
            }

            $rankings[] = [
                'key' => $bucket['key'],
                'label' => $bucket['label'],
                'candidate_index' => $best['candidate_index'] ?? null,
                'metric_name' => $bucket['metric_name'],
                'metric_value' => $best['metrics'][$bucket['metric_name']] ?? null,
            ];
        }

        return $rankings;
    }

    private function bestCandidateForMetric(array $candidates, string $metricName, string $direction): ?array
    {
        if ($candidates === []) {
            return null;
        }

        $ranked = array_values($candidates);
        usort($ranked, function (array $left, array $right) use ($metricName, $direction): int {
            $leftValue = $this->rankingValue($left['metrics'] ?? [], $metricName, $direction);
            $rightValue = $this->rankingValue($right['metrics'] ?? [], $metricName, $direction);

            if ($leftValue !== $rightValue) {
                return $direction === 'min'
                    ? $leftValue <=> $rightValue
                    : $rightValue <=> $leftValue;
            }

            return $this->compareTieBreakers($left, $right);
        });

        return $ranked[0] ?? null;
    }

    private function rankingValue(array $metrics, string $metricName, string $direction): float
    {
        $value = $metrics[$metricName] ?? null;
        if ($value === null || ! is_numeric($value)) {
            return $direction === 'min' ? PHP_FLOAT_MAX : -PHP_FLOAT_MAX;
        }

        return (float) $value;
    }

    private function compareTieBreakers(array $left, array $right): int
    {
        $leftMetrics = $left['metrics'] ?? [];
        $rightMetrics = $right['metrics'] ?? [];

        $comparisons = [
            [$this->metricCost($leftMetrics), $this->metricCost($rightMetrics), 'min'],
            [$this->metricTat($leftMetrics), $this->metricTat($rightMetrics), 'min'],
            [(float) ($leftMetrics['sensitivity'] ?? 0), (float) ($rightMetrics['sensitivity'] ?? 0), 'max'],
            [(float) ($leftMetrics['specificity'] ?? 0), (float) ($rightMetrics['specificity'] ?? 0), 'max'],
        ];

        foreach ($comparisons as [$leftValue, $rightValue, $direction]) {
            if ($leftValue === $rightValue) {
                continue;
            }

            return $direction === 'min'
                ? $leftValue <=> $rightValue
                : $rightValue <=> $leftValue;
        }

        return strcmp(
            (string) ($left['label'] ?? $left['candidate_index'] ?? ''),
            (string) ($right['label'] ?? $right['candidate_index'] ?? '')
        );
    }

    private function metricCost(array $metrics): float
    {
        return (float) ($metrics['expected_cost_population'] ?? $metrics['expected_cost_given_disease'] ?? PHP_FLOAT_MAX);
    }

    private function metricTat(array $metrics): float
    {
        return (float) ($metrics['expected_turnaround_time_population'] ?? $metrics['expected_turnaround_time_given_disease'] ?? PHP_FLOAT_MAX);
    }

    private function diagnosticOddsRatio(float $sensitivity, float $specificity): float
    {
        $numerator = $sensitivity * $specificity;
        $denominator = (1 - $sensitivity) * (1 - $specificity);

        if ($denominator <= 0.0) {
            return $numerator > 0.0 ? self::LARGE_RATIO_SENTINEL : 0.0;
        }

        return $numerator / $denominator;
    }

    private function skillLevel(mixed $value, mixed $label = null): ?int
    {
        if (is_int($value)) {
            return $value;
        }

        if (is_numeric($value)) {
            return (int) $value;
        }

        $source = strtolower(trim((string) ($label ?? $value ?? '')));
        if ($source === '') {
            return null;
        }

        return match (true) {
            str_contains($source, 'chw'), str_contains($source, 'self') => 1,
            str_contains($source, 'nurse') => 2,
            str_contains($source, 'radiographer'), str_contains($source, 'lab tech'), str_contains($source, 'lab technician') => 3,
            str_contains($source, 'radiologist'), str_contains($source, 'specialist'), str_contains($source, 'cardiology'), str_contains($source, 'gastroenterology'), str_contains($source, 'gi specialist'), str_contains($source, 'bsl-2') => 4,
            str_contains($source, 'bsl-3') => 5,
            default => 3,
        };
    }

    private function numberOrNull(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }
}
