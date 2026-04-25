<?php

namespace App\Services;

use Illuminate\Support\Arr;
use Illuminate\Validation\ValidationException;

class PathwayDefinitionService
{
    public function normalize(array $payload): array
    {
        $normalized = $payload;
        $normalized['tests'] = $this->normalizeCollection($payload['tests'] ?? [], 'id');
        $normalized['nodes'] = $this->normalizeCollection($payload['nodes'] ?? [], 'id');

        if (! isset($normalized['start_node']) && isset($payload['startNode'])) {
            $normalized['start_node'] = $payload['startNode'];
        }

        return $normalized;
    }

    public function validate(array $payload): array
    {
        $payload = $this->normalize($payload);
        $errors = [];
        $warnings = [];

        if (empty($payload['start_node'])) {
            $errors[] = 'Missing start_node.';
        }

        if (empty($payload['tests']) || ! is_array($payload['tests'])) {
            $errors[] = 'At least one diagnostic test is required.';
        }

        if (empty($payload['nodes']) || ! is_array($payload['nodes'])) {
            $errors[] = 'At least one pathway node is required.';
        }

        $nodes = $payload['nodes'] ?? [];
        $terminalPositive = false;
        $terminalNegative = false;

        foreach ($nodes as $nodeId => $node) {
            if (! is_array($node)) {
                $errors[] = "Node {$nodeId} must be an object.";
                continue;
            }

            $hasAction = array_key_exists('action', $node) && $node['action'] !== null;
            $hasTerminal = ! empty($node['final_classification']);
            if (! $hasAction && ! $hasTerminal) {
                $errors[] = "Node {$nodeId} must have either action or final_classification.";
            }

            if ($hasTerminal) {
                if ($node['final_classification'] === 'positive') {
                    $terminalPositive = true;
                }
                if ($node['final_classification'] === 'negative') {
                    $terminalNegative = true;
                }
            }

            if ($hasAction) {
                $testNames = Arr::get($node, 'action.test_names', []);
                foreach ($testNames as $testName) {
                    if (! array_key_exists($testName, $payload['tests'])) {
                        $errors[] = "Node {$nodeId} references missing test {$testName}.";
                    }
                }
            }

            foreach (($node['branches'] ?? []) as $branchIndex => $branch) {
                $target = $branch['next_node'] ?? null;
                if (! $target || ! array_key_exists($target, $nodes)) {
                    $errors[] = "Branch {$branchIndex} on node {$nodeId} targets a missing node.";
                }
            }
        }

        if (! empty($payload['start_node']) && ! array_key_exists($payload['start_node'], $nodes)) {
            $errors[] = 'start_node does not exist in nodes.';
        }

        if (! $terminalPositive) {
            $errors[] = 'Pathway must include a positive terminal.';
        }

        if (! $terminalNegative) {
            $errors[] = 'Pathway must include a negative terminal.';
        }

        if ($this->hasCycle($payload['start_node'] ?? null, $nodes)) {
            $errors[] = 'Pathway contains a cycle.';
        }

        if ($this->usesIndependenceFallback($payload)) {
            $warnings[] = 'Some joint or conditional probabilities are missing; independence fallback may be used.';
        }

        return [
            'valid' => empty($errors),
            'errors' => $errors,
            'warnings' => $warnings,
            'payload' => $payload,
        ];
    }

    private function normalizeCollection(array $value, string $idKey): array
    {
        if (Arr::isAssoc($value)) {
            return $value;
        }

        $normalized = [];
        foreach ($value as $item) {
            if (! is_array($item) || empty($item[$idKey])) {
                continue;
            }

            $normalized[$item[$idKey]] = $item;
        }

        return $normalized;
    }

    private function hasCycle(?string $startNodeId, array $nodes): bool
    {
        if (! $startNodeId || ! isset($nodes[$startNodeId])) {
            return false;
        }

        $visiting = [];
        $visited = [];

        $visit = function (string $nodeId) use (&$visit, &$visiting, &$visited, $nodes): bool {
            if (isset($visited[$nodeId])) {
                return false;
            }
            if (isset($visiting[$nodeId])) {
                return true;
            }

            $visiting[$nodeId] = true;
            foreach (($nodes[$nodeId]['branches'] ?? []) as $branch) {
                $nextNode = $branch['next_node'] ?? null;
                if ($nextNode && isset($nodes[$nextNode]) && $visit($nextNode)) {
                    return true;
                }
            }

            unset($visiting[$nodeId]);
            $visited[$nodeId] = true;

            return false;
        };

        return $visit($startNodeId);
    }

    private function usesIndependenceFallback(array $payload): bool
    {
        foreach (($payload['tests'] ?? []) as $test) {
            if (! empty($test['joint_probabilities']) || ! empty($test['conditional_probabilities'])) {
                return false;
            }
        }

        return true;
    }
}

