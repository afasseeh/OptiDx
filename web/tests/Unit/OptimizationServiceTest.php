<?php

namespace Tests\Unit;

use App\Services\OptimizationService;
use App\Services\PathwayDefinitionService;
use App\Services\PythonEngineBridge;
use Tests\TestCase;

class OptimizationServiceTest extends TestCase
{
    public function test_optimize_batches_templates_and_filters_allowed_sample_types(): void
    {
        $definitions = $this->createMock(PathwayDefinitionService::class);
        $definitions->method('validate')->willReturn([
            'valid' => true,
            'errors' => [],
            'warnings' => [],
        ]);

        $bridge = $this->createMock(PythonEngineBridge::class);
        $bridge->expects($this->once())
            ->method('optimize')
            ->with($this->callback(function (array $payload): bool {
                $templates = $payload['templates'] ?? [];

                $this->assertCount(1, $templates);
                $this->assertSame('t_blood', array_key_first($templates[0]['tests'] ?? []));
                $this->assertSame(0.08, $payload['prevalence']);

                return true;
            }))
            ->willReturn([
                'ranked_results' => [
                    [
                        'pathway' => [
                            'metadata' => ['label' => 'Single test'],
                        ],
                        'metrics' => [
                            'expected_cost_population' => 4.25,
                            'sensitivity' => 0.91,
                            'specificity' => 0.96,
                        ],
                        'warnings' => [],
                        'label' => 'Single test',
                    ],
                ],
            ]);

        $service = new OptimizationService($definitions, $bridge);

        $result = $service->optimize([
            't_blood' => [
                'id' => 't_blood',
                'name' => 'Blood screen',
                'sensitivity' => 0.91,
                'specificity' => 0.96,
                'turnaround_time' => 2,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 4,
            ],
            't_sputum' => [
                'id' => 't_sputum',
                'name' => 'Sputum assay',
                'sensitivity' => 0.88,
                'specificity' => 0.94,
                'turnaround_time' => 4,
                'sample_types' => ['sputum'],
                'skill_level' => 3,
                'cost' => 6,
            ],
        ], [
            'allowed_sample_types' => ['blood'],
            'minimum_sensitivity' => 0.85,
            'minimum_specificity' => 0.90,
            'maximum_total_cost' => 10,
        ], 0.08);

        $this->assertSame(1, $result['candidate_count']);
        $this->assertSame(1, $result['feasible_count']);
        $this->assertSame('Single test', $result['ranked_results'][0]['label']);
        $this->assertSame(0.935, round($result['ranked_results'][0]['metrics']['balanced_accuracy'], 3));
        $this->assertSame(0.87, round($result['ranked_results'][0]['metrics']['youden_index'], 2));
        $this->assertArrayHasKey('named_rankings', $result);
    }

    public function test_optimize_exposes_multiple_frontier_candidates_for_tradeoff_libraries(): void
    {
        $definitions = $this->createMock(PathwayDefinitionService::class);
        $definitions->method('validate')->willReturn([
            'valid' => true,
            'errors' => [],
            'warnings' => [],
        ]);

        $bridge = $this->createMock(PythonEngineBridge::class);
        $bridge->expects($this->once())
            ->method('optimize')
            ->with($this->callback(function (array $payload): bool {
                $this->assertGreaterThanOrEqual(6, count($payload['templates'] ?? []));
                return true;
            }))
            ->willReturn([
                'ranked_results' => [
                    [
                        'pathway' => ['metadata' => ['label' => 'Cost-first']],
                        'metrics' => [
                            'expected_cost_population' => 2.0,
                            'expected_turnaround_time_population' => 1.6,
                            'sensitivity' => 0.94,
                            'specificity' => 0.82,
                        ],
                        'warnings' => [],
                        'label' => 'Cost-first',
                    ],
                    [
                        'pathway' => ['metadata' => ['label' => 'Specificity-first']],
                        'metrics' => [
                            'expected_cost_population' => 3.8,
                            'expected_turnaround_time_population' => 1.0,
                            'sensitivity' => 0.88,
                            'specificity' => 0.95,
                        ],
                        'warnings' => [],
                        'label' => 'Specificity-first',
                    ],
                    [
                        'pathway' => ['metadata' => ['label' => 'Fastest']],
                        'metrics' => [
                            'expected_cost_population' => 2.9,
                            'expected_turnaround_time_population' => 0.7,
                            'sensitivity' => 0.90,
                            'specificity' => 0.89,
                        ],
                        'warnings' => [],
                        'label' => 'Fastest',
                    ],
                ],
            ]);

        $service = new OptimizationService($definitions, $bridge);

        $result = $service->optimize([
            't_a' => [
                'id' => 't_a',
                'name' => 'Test A',
                'sensitivity' => 0.94,
                'specificity' => 0.82,
                'turnaround_time' => 1.0,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 2.0,
            ],
            't_b' => [
                'id' => 't_b',
                'name' => 'Test B',
                'sensitivity' => 0.88,
                'specificity' => 0.95,
                'turnaround_time' => 2.0,
                'sample_types' => ['sputum'],
                'skill_level' => 3,
                'cost' => 3.8,
            ],
            't_c' => [
                'id' => 't_c',
                'name' => 'Test C',
                'sensitivity' => 0.90,
                'specificity' => 0.89,
                'turnaround_time' => 0.7,
                'sample_types' => ['urine'],
                'skill_level' => 2,
                'cost' => 2.9,
            ],
        ], [
            'allowed_sample_types' => ['blood', 'sputum', 'urine'],
            'minimum_sensitivity' => 0.85,
            'minimum_specificity' => 0.80,
            'maximum_total_cost' => 10,
        ], 0.08);

        $this->assertSame(3, $result['candidate_count']);
        $this->assertGreaterThanOrEqual(2, count($result['pareto_frontier']));
        $this->assertSame('Cheapest', $result['named_rankings'][0]['label']);
        $this->assertSame(0, $result['named_rankings'][0]['candidate_index']);
    }

    public function test_optimize_respects_objective_when_ranking_candidates(): void
    {
        $definitions = $this->createMock(PathwayDefinitionService::class);
        $definitions->method('validate')->willReturn([
            'valid' => true,
            'errors' => [],
            'warnings' => [],
        ]);

        $bridge = $this->createMock(PythonEngineBridge::class);
        $bridge->expects($this->exactly(2))
            ->method('optimize')
            ->willReturn([
                'ranked_results' => [
                    [
                        'pathway' => ['metadata' => ['label' => 'Sensitivity-first']],
                        'metrics' => [
                            'expected_cost_population' => 5.0,
                            'expected_turnaround_time_population' => 2.0,
                            'sensitivity' => 0.97,
                            'specificity' => 0.78,
                        ],
                        'warnings' => [],
                    ],
                    [
                        'pathway' => ['metadata' => ['label' => 'Specificity-first']],
                        'metrics' => [
                            'expected_cost_population' => 5.0,
                            'expected_turnaround_time_population' => 2.0,
                            'sensitivity' => 0.81,
                            'specificity' => 0.97,
                        ],
                        'warnings' => [],
                    ],
                ],
            ]);

        $service = new OptimizationService($definitions, $bridge);
        $tests = [
            't_a' => [
                'id' => 't_a',
                'name' => 'Test A',
                'sensitivity' => 0.97,
                'specificity' => 0.78,
                'turnaround_time' => 2,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 5.0,
            ],
            't_b' => [
                'id' => 't_b',
                'name' => 'Test B',
                'sensitivity' => 0.81,
                'specificity' => 0.97,
                'turnaround_time' => 2,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 5.0,
            ],
        ];

        $sensitivityResult = $service->optimize($tests, [
            'objective' => 'maximize sensitivity',
        ], 0.08);
        $specificityResult = $service->optimize($tests, [
            'objective' => 'maximize specificity',
        ], 0.08);

        $this->assertSame('t_a', array_key_first($sensitivityResult['ranked_results'][0]['pathway']['tests']));
        $this->assertSame('t_b', array_key_first($specificityResult['ranked_results'][0]['pathway']['tests']));
    }

    public function test_optimize_builds_deterministic_named_rankings_and_allows_duplicate_winners(): void
    {
        $definitions = $this->createMock(PathwayDefinitionService::class);
        $definitions->method('validate')->willReturn([
            'valid' => true,
            'errors' => [],
            'warnings' => [],
        ]);

        $bridge = $this->createMock(PythonEngineBridge::class);
        $bridge->method('optimize')->willReturn([
            'ranked_results' => [
                [
                    'pathway' => ['metadata' => ['label' => 'Low cost option']],
                    'metrics' => [
                        'expected_cost_population' => 2.0,
                        'expected_turnaround_time_population' => 2.0,
                        'expected_true_positives_per_1000' => 80,
                        'sensitivity' => 0.8,
                        'specificity' => 0.9,
                    ],
                    'warnings' => [],
                ],
                [
                    'pathway' => ['metadata' => ['label' => 'Low cost tie slower']],
                    'metrics' => [
                        'expected_cost_population' => 2.0,
                        'expected_turnaround_time_population' => 3.0,
                        'expected_true_positives_per_1000' => 80,
                        'sensitivity' => 0.8,
                        'specificity' => 0.9,
                    ],
                    'warnings' => [],
                ],
                [
                    'pathway' => ['metadata' => ['label' => 'High accuracy']],
                    'metrics' => [
                        'expected_cost_population' => 5.0,
                        'expected_turnaround_time_population' => 1.0,
                        'expected_true_positives_per_1000' => 75,
                        'sensitivity' => 0.95,
                        'specificity' => 0.95,
                    ],
                    'warnings' => [],
                ],
            ],
        ]);

        $service = new OptimizationService($definitions, $bridge);
        $result = $service->optimize([
            't_a' => [
                'id' => 't_a',
                'name' => 'Test A',
                'sensitivity' => 0.8,
                'specificity' => 0.9,
                'turnaround_time' => 2,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 2.0,
            ],
        ], [], 0.08);

        $named = collect($result['named_rankings'])->keyBy('key');
        $ranked = collect($result['ranked_results']);

        $cheapest = $ranked[$named['cheapest']['candidate_index']];
        $highestSensitivity = $ranked[$named['highest_sensitivity']['candidate_index']];

        $this->assertSame($named['cheapest']['candidate_index'], $named['lowest_average_cost_per_patient']['candidate_index']);
        $this->assertSame($named['most_cost_effective']['candidate_index'], $named['least_cost_per_positive_test']['candidate_index']);
        $this->assertSame(2.0, $cheapest['metrics']['expected_cost_population']);
        $this->assertSame(2.0, $cheapest['metrics']['expected_turnaround_time_population']);
        $this->assertSame(0.95, $highestSensitivity['metrics']['sensitivity']);
        $this->assertSame(0.95, $highestSensitivity['metrics']['specificity']);
        $this->assertSame($named['highest_sensitivity']['candidate_index'], $named['highest_balanced_accuracy']['candidate_index']);
        $this->assertSame($named['highest_sensitivity']['candidate_index'], $named['highest_youden_index']['candidate_index']);
        $this->assertSame($named['highest_sensitivity']['candidate_index'], $named['highest_dor']['candidate_index']);
        $this->assertSame(2.0 / (80 / 1000), $named['most_cost_effective']['metric_value']);
    }
}
