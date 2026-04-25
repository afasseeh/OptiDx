<?php

namespace Tests\Feature;

use App\Models\Pathway;
use App\Models\Setting;
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

    public function test_evaluate_updates_an_existing_pathway_record(): void
    {
        $payload = $this->canonicalPathwayPayload();

        $created = $this->postJson('/api/pathways', [
            'name' => 'Evaluation target',
            'editor_definition' => $payload,
        ])
            ->assertCreated()
            ->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $payload,
            'pathway_id' => $created['id'],
            'prevalence' => 0.12,
        ])
            ->assertOk()
            ->assertJsonPath('pathway.id', $created['id']);

        $this->assertSame(1, Pathway::query()->count());
        $this->assertNotNull(Pathway::query()->first()?->latestEvaluationResult);
    }

    public function test_settings_are_scoped_by_scope_and_key(): void
    {
        $this->putJson('/api/settings', [
            'scope' => 'workspace',
            'key' => 'workspace_profile',
            'value' => ['name' => 'Workspace A'],
        ])->assertOk();

        $this->putJson('/api/settings', [
            'scope' => 'pathway',
            'key' => 'workspace_profile',
            'value' => ['name' => 'Pathway B'],
        ])->assertOk();

        $this->assertDatabaseHas('settings', [
            'scope' => 'workspace',
            'key' => 'workspace_profile',
        ]);

        $this->assertDatabaseHas('settings', [
            'scope' => 'pathway',
            'key' => 'workspace_profile',
        ]);

        $this->assertSame(2, Setting::query()->count());
    }

    public function test_report_export_returns_downloadable_files(): void
    {
        $payload = $this->canonicalPathwayPayload();

        $created = $this->postJson('/api/pathways', [
            'name' => 'Report target',
            'editor_definition' => $payload,
        ])
            ->assertCreated()
            ->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $payload,
            'pathway_id' => $created['id'],
            'prevalence' => 0.08,
        ])->assertOk();

        $this->get("/api/pathways/{$created['id']}/export/report?format=pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->get("/api/pathways/{$created['id']}/export/report?format=docx")
            ->assertOk()
            ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    }

    public function test_store_import_and_export_use_canonical_graph_shape(): void
    {
        $payload = [
            'schema_version' => 'canvas-v1',
            'start_node' => 'start',
            'metadata' => [
                'label' => 'Canonical pathway',
                'source' => 'test',
            ],
            'tests' => [
                'A' => [
                    'id' => 'A',
                    'name' => 'Test A',
                    'sensitivity' => 0.91,
                    'specificity' => 0.84,
                    'turnaround_time' => 2,
                    'sample_types' => ['blood'],
                    'skill_level' => 2,
                    'cost' => 4,
                ],
            ],
            'nodes' => [
                'start' => [
                    'id' => 'start',
                    'type' => 'test',
                    'testId' => 'A',
                    'label' => 'Entry',
                    'x' => 40,
                    'y' => 80,
                ],
                'final_positive' => [
                    'id' => 'final_positive',
                    'type' => 'terminal',
                    'subtype' => 'pos',
                    'label' => 'Positive',
                    'x' => 260,
                    'y' => 20,
                ],
                'final_negative' => [
                    'id' => 'final_negative',
                    'type' => 'terminal',
                    'subtype' => 'neg',
                    'label' => 'Negative',
                    'x' => 260,
                    'y' => 140,
                ],
            ],
            'edges' => [
                ['id' => 'e1', 'from' => 'start', 'fromPort' => 'pos', 'to' => 'final_positive', 'kind' => 'pos', 'label' => 'Positive'],
                ['id' => 'e2', 'from' => 'start', 'fromPort' => 'neg', 'to' => 'final_negative', 'kind' => 'neg', 'label' => 'Negative'],
            ],
        ];

        $created = $this->postJson('/api/pathways', [
            'name' => 'Canonical pathway',
            'editor_definition' => $payload,
            'metadata' => ['owner' => 'Test'],
        ])
            ->assertCreated()
            ->json();

        $this->assertSame('start', $created['editor_definition']['start_node']);
        $this->assertSame('start', $created['start_node_id']);
        $this->assertSame('A', $created['engine_definition']['nodes']['start']['action']['test_names'][0]);

        $this->getJson("/api/pathways/{$created['id']}/export/json")
            ->assertOk()
            ->assertJsonPath('start_node', 'start')
            ->assertJsonPath('nodes.start.testId', 'A');

        $this->postJson('/api/pathways/import', ['pathway' => $payload])
            ->assertCreated()
            ->assertJsonPath('editor_definition.start_node', 'start')
            ->assertJsonPath('engine_definition.nodes.start.branches.0.next_node', 'final_positive');
    }

    public function test_optimize_accepts_ui_seed_test_shape(): void
    {
        $response = $this->postJson('/api/pathways/optimize', [
            'tests' => [
                [
                    'id' => 't_symp',
                    'name' => 'Symptom Screen (WHO-4)',
                    'sens' => 0.77,
                    'spec' => 0.68,
                    'tat' => 5,
                    'tatUnit' => 'min',
                    'sample' => 'none',
                    'skill' => 'CHW',
                    'cost' => 0.5,
                ],
                [
                    'id' => 't_xpert',
                    'name' => 'Xpert MTB/RIF Ultra',
                    'sens' => 0.88,
                    'spec' => 0.98,
                    'tat' => 2,
                    'tatUnit' => 'hr',
                    'sample' => 'sputum',
                    'skill' => 'Lab Tech',
                    'cost' => 9.98,
                ],
            ],
            'constraints' => [
                'minimum_sensitivity' => 0.85,
                'minimum_specificity' => 0.90,
                'maximum_total_cost' => 10,
            ],
            'prevalence' => 0.08,
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('candidate_count', 1)
            ->assertJsonPath('ranked_results.0.label', 'Single test')
            ->assertJsonStructure([
                'ranked_results' => [[
                    'metrics' => [
                        'balanced_accuracy',
                        'youden_index',
                        'diagnostic_odds_ratio',
                        'cost_per_detected_case',
                    ],
                ]],
                'named_rankings' => [[
                    'key',
                    'label',
                    'candidate_index',
                    'metric_name',
                    'metric_value',
                ]],
            ]);
    }

    private function canonicalPathwayPayload(): array
    {
        return [
            'schema_version' => 'canvas-v1',
            'start_node' => 'start',
            'metadata' => [
                'label' => 'Canonical pathway',
                'source' => 'test',
            ],
            'tests' => [
                'A' => [
                    'id' => 'A',
                    'name' => 'Test A',
                    'sensitivity' => 0.91,
                    'specificity' => 0.84,
                    'turnaround_time' => 2,
                    'sample_types' => ['blood'],
                    'skill_level' => 2,
                    'cost' => 4,
                ],
            ],
            'nodes' => [
                'start' => [
                    'id' => 'start',
                    'type' => 'test',
                    'testId' => 'A',
                    'label' => 'Entry',
                    'x' => 40,
                    'y' => 80,
                ],
                'final_positive' => [
                    'id' => 'final_positive',
                    'type' => 'terminal',
                    'subtype' => 'pos',
                    'label' => 'Positive',
                    'x' => 260,
                    'y' => 20,
                ],
                'final_negative' => [
                    'id' => 'final_negative',
                    'type' => 'terminal',
                    'subtype' => 'neg',
                    'label' => 'Negative',
                    'x' => 260,
                    'y' => 140,
                ],
            ],
            'edges' => [
                ['id' => 'e1', 'from' => 'start', 'fromPort' => 'pos', 'to' => 'final_positive', 'kind' => 'pos', 'label' => 'Positive'],
                ['id' => 'e2', 'from' => 'start', 'fromPort' => 'neg', 'to' => 'final_negative', 'kind' => 'neg', 'label' => 'Negative'],
            ],
        ];
    }
}
