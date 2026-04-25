<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PathwayApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_health_endpoint_returns_ok(): void
    {
        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonPath('status', 'ok');
    }

    public function test_validate_and_evaluate_simple_pathway(): void
    {
        $payload = [
            'start_node' => 'start',
            'tests' => [
                'A' => [
                    'sensitivity' => 0.9,
                    'specificity' => 0.8,
                    'turnaround_time' => 1,
                    'sample_types' => ['blood'],
                    'skill_level' => 1,
                    'cost' => 2,
                ],
                'B' => [
                    'sensitivity' => 0.95,
                    'specificity' => 0.9,
                    'turnaround_time' => 3,
                    'sample_types' => ['swab'],
                    'skill_level' => 3,
                    'cost' => 8,
                ],
            ],
            'nodes' => [
                'start' => [
                    'action' => [
                        'test_names' => ['A'],
                        'mode' => 'sequential',
                        'parallel_time' => false,
                    ],
                    'branches' => [
                        ['conditions' => ['A' => 'pos'], 'next_node' => 'confirm'],
                        ['conditions' => ['A' => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'confirm' => [
                    'action' => [
                        'test_names' => ['B'],
                        'mode' => 'sequential',
                        'parallel_time' => false,
                    ],
                    'branches' => [
                        ['conditions' => ['B' => 'pos'], 'next_node' => 'final_positive'],
                        ['conditions' => ['B' => 'neg'], 'next_node' => 'final_negative'],
                    ],
                ],
                'final_positive' => [
                    'final_classification' => 'positive',
                ],
                'final_negative' => [
                    'final_classification' => 'negative',
                ],
            ],
        ];

        $this->postJson('/api/pathways/validate', ['pathway' => $payload])
            ->assertOk()
            ->assertJsonPath('valid', true);

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $payload,
            'prevalence' => 0.1,
        ])
            ->assertOk()
            ->assertJsonStructure([
                'metrics' => [
                    'sensitivity',
                    'specificity',
                    'ppv',
                    'npv',
                    'expected_cost_population',
                    'expected_turnaround_time_population',
                ],
            ]);
    }
}

