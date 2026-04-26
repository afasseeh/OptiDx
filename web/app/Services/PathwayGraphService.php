<?php

namespace App\Services;

use Illuminate\Support\Arr;

class PathwayGraphService
{
    public function canonicalizeCanvas(array $payload): array
    {
        $nodes = $this->normalizeCollection($payload['nodes'] ?? [], 'id');
        $edges = $this->normalizeEdges($payload['edges'] ?? []);
        $tests = $this->normalizeCollection($payload['tests'] ?? [], 'id');

        return [
            'schema_version' => $payload['schema_version'] ?? 'canvas-v1',
            'start_node' => $payload['start_node'] ?? $payload['startNode'] ?? $this->detectStartNode($nodes, $edges),
            'metadata' => $payload['metadata'] ?? [],
            'tests' => $tests,
            'nodes' => $nodes,
            'edges' => $edges,
        ];
    }

    public function hydrateCanvas(array $payload): array
    {
        $graph = $this->canonicalizeCanvas($payload);

        return [
            'schema_version' => $graph['schema_version'],
            'start_node' => $graph['start_node'],
            'metadata' => $graph['metadata'],
            'tests' => array_values($graph['tests']),
            'nodes' => array_values($graph['nodes']),
            'edges' => array_values($graph['edges']),
        ];
    }

    public function compileEngineDefinition(array $payload): array
    {
        $graph = $this->canonicalizeCanvas($payload);
        $nodes = $graph['nodes'];
        $edges = $graph['edges'];
        $parallelMembersByNode = $this->parallelMembersByNode($nodes, array_keys($graph['tests']));
        $engineNodes = [];

        foreach ($nodes as $nodeId => $node) {
            if (($node['type'] ?? null) === 'annotation') {
                continue;
            }

            if (($node['type'] ?? null) === 'terminal') {
                $engineNodes[$nodeId] = [
                    'final_classification' => $this->terminalClassification($node),
                    'description' => $this->terminalDescription($node),
                ];
                continue;
            }

            $action = $this->compileAction($node, $parallelMembersByNode[$nodeId] ?? []);
            $branches = $this->compileBranches($node, $edges, $parallelMembersByNode[$nodeId] ?? []);

            $engineNodes[$nodeId] = [
                'action' => $action,
                'branches' => $branches,
                'description' => $node['label'] ?? $node['description'] ?? null,
            ];
        }

        return [
            'schema_version' => $graph['schema_version'],
            'start_node' => $graph['start_node'],
            'tests' => $this->compileTests($graph['tests'], $parallelMembersByNode),
            'nodes' => $engineNodes,
            'metadata' => $graph['metadata'],
        ];
    }

    public function canonicalizeAndCompile(array $payload): array
    {
        $graph = $this->canonicalizeCanvas($payload);

        return [
            'editor_definition' => $graph,
            'engine_definition' => $this->compileEngineDefinition($graph),
        ];
    }

    private function compileTests(array $tests, array $parallelMembersByNode = []): array
    {
        $compiled = [];

        foreach ($tests as $testId => $test) {
            $skillLevel = $this->skillLevel($test['skill_level'] ?? null, $test['skill_label'] ?? null);
            $sampleTypes = $test['sample_types'] ?? [];
            if (is_string($sampleTypes)) {
                $sampleTypes = [$sampleTypes];
            }

            $compiled[$testId] = [
                'sensitivity' => (float) ($test['sensitivity'] ?? $test['sens'] ?? 0),
                'specificity' => (float) ($test['specificity'] ?? $test['spec'] ?? 0),
                'turnaround_time' => $this->numberOrNull($test['turnaround_time'] ?? $test['tat'] ?? null),
                'turnaround_time_unit' => $test['turnaround_time_unit'] ?? $test['tatUnit'] ?? null,
                'sample_types' => array_values(array_filter(array_map('strval', $sampleTypes), static fn ($value) => $value !== '')),
                'skill_level' => $skillLevel,
                'cost' => $this->numberOrNull($test['cost'] ?? null),
            ];

            if (! empty($test['joint_probabilities'])) {
                $compiled[$testId]['joint_probabilities'] = $test['joint_probabilities'];
            }

            if (! empty($test['conditional_probabilities'])) {
                $compiled[$testId]['conditional_probabilities'] = $test['conditional_probabilities'];
            }
        }

        foreach ($parallelMembersByNode as $members) {
            foreach ($members as $member) {
                $alias = $member['alias'] ?? null;
                $testId = $member['testId'] ?? null;
                if (! $alias || ! $testId || ! isset($tests[$testId]) || isset($compiled[$alias])) {
                    continue;
                }

                $compiled[$alias] = $compiled[$testId];
            }
        }

        return $compiled;
    }

    private function compileAction(array $node, array $parallelMembers = []): array
    {
        $testNames = [];

        if (! empty($node['type']) && $node['type'] === 'parallel') {
            foreach ($parallelMembers as $member) {
                if (! empty($member['alias'])) {
                    $testNames[] = $member['alias'];
                }
            }
        } elseif (! empty($node['testId'])) {
            $testNames[] = $node['testId'];
        }

        return [
            'test_names' => $testNames,
            'mode' => ($node['type'] ?? null) === 'parallel' ? 'parallel' : 'sequential',
            'parallel_time' => ($node['type'] ?? null) === 'parallel',
        ];
    }

    private function compileBranches(array $node, array $edges, array $parallelMembers = []): array
    {
        $branches = [];
        $nodeId = $node['id'] ?? null;
        if (! $nodeId) {
            return [];
        }

        foreach ($edges as $edge) {
            if (($edge['from'] ?? null) !== $nodeId) {
                continue;
            }

            $port = $edge['fromPort'] ?? $edge['from_port'] ?? null;
            $target = $edge['to'] ?? $edge['target'] ?? null;
            if (! $port || ! $target) {
                continue;
            }

            foreach ($this->branchConditionsForPort($node, $port, $parallelMembers) as $conditions) {
                $branches[] = [
                    'conditions' => $conditions,
                    'next_node' => $target,
                ];
            }
        }

        return $branches;
    }

    private function branchConditionsForPort(array $node, string $port, array $parallelMembers = []): array
    {
        if (($node['type'] ?? null) === 'parallel') {
            $members = array_values(array_filter(array_map(
                static fn (array $member): ?string => $member['alias'] ?? null,
                $parallelMembers
            )));

            return match ($port) {
                'both_pos' => [$this->uniformOutcomeConditions($members, 'pos')],
                'both_neg' => [$this->uniformOutcomeConditions($members, 'neg')],
                'discord', 'disc' => $this->mixedParallelConditions($members),
                default => [[]],
            };
        }

        $testId = $node['testId'] ?? null;
        if (! $testId) {
            return [[]];
        }

        return match ($port) {
            'pos' => [[ $testId => 'pos' ]],
            'neg' => [[ $testId => 'neg' ]],
            default => [[]],
        };
    }

    private function parallelMembersByNode(array $nodes, array $reservedTestIds = []): array
    {
        $aliasesByNode = [];
        $used = array_fill_keys(array_map('strval', $reservedTestIds), true);

        foreach ($nodes as $nodeId => $node) {
            if (($node['type'] ?? null) !== 'parallel') {
                continue;
            }

            $members = [];
            foreach (array_values($node['members'] ?? []) as $index => $member) {
                $testId = (string) ($member['testId'] ?? '');
                if ($testId === '') {
                    continue;
                }

                $baseAlias = (string) ($member['id'] ?? ($nodeId . '__member_' . ($index + 1) . '__' . $testId));
                $alias = $baseAlias;
                $suffix = 2;
                while (isset($used[$alias])) {
                    $alias = $baseAlias . '__' . $suffix;
                    $suffix++;
                }

                $used[$alias] = true;
                $members[] = [
                    'alias' => $alias,
                    'testId' => $testId,
                ];
            }

            if ($members !== []) {
                $aliasesByNode[(string) $nodeId] = $members;
            }
        }

        return $aliasesByNode;
    }

    private function uniformOutcomeConditions(array $testIds, string $outcome): array
    {
        $conditions = [];
        foreach ($testIds as $testId) {
            $conditions[$testId] = $outcome;
        }

        return $conditions;
    }

    private function mixedParallelConditions(array $testIds): array
    {
        if (count($testIds) < 2) {
            return [[]];
        }

        $branches = [];
        $this->buildMixedConditions($testIds, 0, [], false, false, $branches);

        return $branches;
    }

    private function buildMixedConditions(array $testIds, int $index, array $current, bool $hasPos, bool $hasNeg, array &$branches): void
    {
        if ($index >= count($testIds)) {
            if ($hasPos && $hasNeg) {
                $branches[] = $current;
            }
            return;
        }

        $testId = $testIds[$index];
        $current[$testId] = 'pos';
        $this->buildMixedConditions($testIds, $index + 1, $current, true, $hasNeg, $branches);

        $current[$testId] = 'neg';
        $this->buildMixedConditions($testIds, $index + 1, $current, $hasPos, true, $branches);
    }

    private function terminalClassification(array $node): string
    {
        return match ($node['subtype'] ?? null) {
            'pos' => 'positive',
            'neg' => 'negative',
            default => 'negative',
        };
    }

    private function terminalDescription(array $node): ?string
    {
        return match ($node['subtype'] ?? null) {
            'pos' => 'Visual terminal subtype: positive',
            'neg' => 'Visual terminal subtype: negative',
            'inc' => 'Visual terminal subtype: inconclusive',
            'ref' => 'Visual terminal subtype: refer',
            'rep' => 'Visual terminal subtype: repeat testing',
            default => $node['label'] ?? null,
        };
    }

    private function detectStartNode(array $nodes, array $edges): ?string
    {
        if ($nodes === []) {
            return null;
        }

        $incoming = array_fill_keys(array_keys($nodes), 0);
        foreach ($edges as $edge) {
            $to = $edge['to'] ?? null;
            if ($to !== null && array_key_exists($to, $incoming)) {
                $incoming[$to]++;
            }
        }

        foreach ($incoming as $nodeId => $count) {
            if ($count === 0 && ($nodes[$nodeId]['type'] ?? null) !== 'annotation') {
                return $nodeId;
            }
        }

        foreach ($nodes as $nodeId => $node) {
            if (($node['type'] ?? null) !== 'annotation') {
                return $nodeId;
            }
        }

        return array_key_first($nodes);
    }

    private function normalizeEdges(array $edges): array
    {
        if (Arr::isAssoc($edges)) {
            $edges = array_values($edges);
        }

        $normalized = [];
        $seen = [];
        foreach ($edges as $edge) {
            if (! is_array($edge) || empty($edge['from']) || empty($edge['to'])) {
                continue;
            }

            $resolved = [
                'id' => $edge['id'] ?? $edge['from'] . '->' . $edge['to'] . ':' . ($edge['fromPort'] ?? $edge['from_port'] ?? 'out'),
                'from' => (string) $edge['from'],
                'fromPort' => (string) ($edge['fromPort'] ?? $edge['from_port'] ?? 'out'),
                'to' => (string) $edge['to'],
                'kind' => $edge['kind'] ?? null,
                'label' => $edge['label'] ?? null,
            ];

            $signature = hash('sha256', json_encode([
                $resolved['from'],
                $resolved['fromPort'],
                $resolved['to'],
                $resolved['kind'],
                $resolved['label'],
            ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

            if (isset($seen[$signature])) {
                continue;
            }

            $seen[$signature] = true;
            $normalized[] = $resolved;
        }

        return $normalized;
    }

    private function normalizeCollection(array $value, string $idKey): array
    {
        $normalized = [];
        foreach ($value as $key => $item) {
            if (! is_array($item)) {
                continue;
            }

            $item = $this->normalizeNode($item);
            $resolvedId = $item[$idKey] ?? (is_string($key) ? $key : null);
            if (empty($resolvedId)) {
                continue;
            }

            $normalized[(string) $resolvedId] = $item;
        }

        return $normalized;
    }

    private function normalizeNode(array $node): array
    {
        $normalized = $node;

        if (isset($normalized['from_port']) && ! isset($normalized['fromPort'])) {
            $normalized['fromPort'] = $normalized['from_port'];
        }

        if (isset($normalized['skill']) && ! isset($normalized['skill_label'])) {
            $normalized['skill_label'] = $normalized['skill'];
        }

        if (isset($normalized['sample']) && ! isset($normalized['sample_types'])) {
            $normalized['sample_types'] = [$normalized['sample']];
        }

        if (isset($normalized['sens']) && ! isset($normalized['sensitivity'])) {
            $normalized['sensitivity'] = $normalized['sens'];
        }

        if (isset($normalized['spec']) && ! isset($normalized['specificity'])) {
            $normalized['specificity'] = $normalized['spec'];
        }

        if (isset($normalized['tat']) && ! isset($normalized['turnaround_time'])) {
            $normalized['turnaround_time'] = $normalized['tat'];
        }

        if (isset($normalized['tatUnit']) && ! isset($normalized['turnaround_time_unit'])) {
            $normalized['turnaround_time_unit'] = $normalized['tatUnit'];
        }

        return $normalized;
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
