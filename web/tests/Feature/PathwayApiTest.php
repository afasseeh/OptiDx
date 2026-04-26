<?php

namespace Tests\Feature;

use App\Models\Pathway;
use App\Models\OptimizationRun;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Queue;
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
        $this->actingAs($this->workspaceUser('evaluator@example.com'));

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
        $this->actingAs($this->workspaceUser('pathway-owner@example.com'));

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

    public function test_pathway_index_includes_latest_evaluation_summary(): void
    {
        $this->actingAs($this->workspaceUser('workspace-summary@example.com'));

        $payload = $this->canonicalPathwayPayload();

        $created = $this->postJson('/api/pathways', [
            'name' => 'Summary target',
            'editor_definition' => $payload,
        ])
            ->assertCreated()
            ->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $payload,
            'pathway_id' => $created['id'],
            'prevalence' => 0.1,
        ])->assertOk();

        $this->getJson('/api/pathways')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonStructure([
                0 => [
                    'latest_evaluation_result' => [
                        'id',
                        'result_payload',
                    ],
                ],
            ]);
    }

    public function test_pathway_update_can_rename_workspace_entry(): void
    {
        $this->actingAs($this->workspaceUser('rename-owner@example.com'));

        $created = $this->postJson('/api/pathways', [
            'name' => 'Original pathway name',
            'editor_definition' => $this->canonicalPathwayPayload(),
            'metadata' => [
                'label' => 'Original pathway name',
            ],
        ])
            ->assertCreated()
            ->json();

        $updated = $this->putJson("/api/pathways/{$created['id']}", [
            'name' => 'Readable pathway name',
            'metadata' => [
                'label' => 'Readable pathway name',
                'source' => 'Workspace home rename',
            ],
        ])
            ->assertOk()
            ->json();

        $this->assertSame('Readable pathway name', $updated['name']);
        $this->assertSame('Readable pathway name', $updated['metadata']['label']);

        $this->getJson('/api/pathways')
            ->assertOk()
            ->assertJsonPath('0.name', 'Readable pathway name');
    }

    public function test_settings_are_scoped_by_scope_and_key(): void
    {
        $this->actingAs($this->workspaceUser('settings-owner@example.com'));

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

    public function test_workspace_records_stay_isolated_between_accounts(): void
    {
        $owner = $this->workspaceUser('owner@example.com');
        $otherUser = $this->workspaceUser('other@example.com');

        $this->actingAs($owner);

        $ownedProject = $this->postJson('/api/projects', [
            'title' => 'Owner project',
        ])->assertCreated()->json();

        $ownedPathway = $this->postJson('/api/pathways', [
            'name' => 'Owner pathway',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])->assertCreated()->json();

        $ownedTest = $this->postJson('/api/evidence/tests', [
            'name' => 'Owner test',
            'sensitivity' => 0.91,
            'specificity' => 0.88,
        ])->assertCreated()->json();

        $this->putJson('/api/settings', [
            'scope' => 'workspace',
            'key' => 'workspace_profile',
            'value' => ['name' => 'Owner workspace'],
        ])->assertOk();

        $this->actingAs($otherUser);

        $otherProject = $this->postJson('/api/projects', [
            'title' => 'Other project',
        ])->assertCreated()->json();

        $otherPathway = $this->postJson('/api/pathways', [
            'name' => 'Other pathway',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])->assertCreated()->json();

        $otherTest = $this->postJson('/api/evidence/tests', [
            'name' => 'Other test',
            'sensitivity' => 0.89,
            'specificity' => 0.86,
        ])->assertCreated()->json();

        $this->putJson('/api/settings', [
            'scope' => 'workspace',
            'key' => 'workspace_profile',
            'value' => ['name' => 'Other workspace'],
        ])->assertOk();

        $this->getJson('/api/pathways')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Other pathway');

        $this->getJson('/api/projects')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.title', 'Other project');

        $this->getJson('/api/evidence/tests')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Other test');

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.value.name', 'Other workspace');

        $this->getJson("/api/pathways/{$ownedPathway['id']}")
            ->assertNotFound();

        $this->getJson("/api/projects/{$ownedProject['id']}")
            ->assertNotFound();

        $this->getJson("/api/evidence/tests/{$ownedTest['id']}")
            ->assertNotFound();

        $this->getJson("/api/projects/{$otherProject['id']}")
            ->assertOk()
            ->assertJsonPath('id', $otherProject['id']);

        $this->getJson("/api/pathways/{$otherPathway['id']}")
            ->assertOk()
            ->assertJsonPath('id', $otherPathway['id']);

        $this->getJson("/api/evidence/tests/{$otherTest['id']}")
            ->assertOk()
            ->assertJsonPath('id', $otherTest['id']);
    }

    public function test_report_export_returns_downloadable_files(): void
    {
        $this->actingAs($this->workspaceUser('report-owner@example.com'));

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
        $this->actingAs($this->workspaceUser('import-owner@example.com'));

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

    public function test_optimize_creates_a_queued_run_and_returns_run_metadata(): void
    {
        $this->actingAs($this->workspaceUser('optimizer@example.com'));
        Queue::fake();

        $response = $this->postJson('/api/pathways/optimize', [
            'project_id' => null,
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
                'prevalence' => 0.08,
                'min_sensitivity' => 0.85,
                'min_specificity' => 0.90,
                'max_cost_per_patient_usd' => 10,
                'max_turnaround_time_hours' => 72,
                'lab_technician_allowed' => true,
                'radiologist_allowed' => false,
                'specialist_physician_allowed' => false,
                'none_allowed' => true,
                'blood_allowed' => true,
                'urine_allowed' => true,
                'stool_allowed' => true,
                'sputum_allowed' => true,
                'nasal_swab_allowed' => true,
                'imaging_allowed' => false,
            ],
            'search_config' => [
                'max_candidates' => 100,
            ],
        ]);

        $response
            ->assertAccepted()
            ->assertJsonPath('status', 'queued')
            ->assertJsonPath('input_payload.constraints.prevalence', 0.08)
            ->assertJsonStructure([
                'input_payload' => [
                    'tests',
                    'constraints',
                    'search_config',
                ],
            ]);

        Queue::assertPushed(\App\Jobs\ExecuteOptimizationRun::class);
        $run = OptimizationRun::query()->first();
        $this->assertNotNull($run);
        $this->assertSame('queued', $run?->status);

        $this->getJson("/api/optimization-runs/{$run->id}")
            ->assertOk()
            ->assertJsonPath('id', $run->id);
    }

    public function test_evidence_test_import_persists_created_by_after_migrations(): void
    {
        $user = $this->workspaceUser('evidence-import@example.com');
        $this->actingAs($user);

        $response = $this->postJson('/api/evidence/tests', [
            'project_id' => null,
            'name' => 'Xpert MTB/RIF Ultra',
            'category' => 'molecular',
            'sensitivity' => 0.88,
            'specificity' => 0.98,
            'cost' => 9.98,
            'currency' => 'USD',
            'turnaround_time' => 90,
            'turnaround_time_unit' => 'min',
            'sample_types' => ['Sputum'],
            'skill_level' => 3,
            'availability' => true,
            'notes' => 'Imported from evidence library.',
            'provenance' => [
                'source' => 'Zifodya et al., Cochrane 2021',
                'country' => 'Global',
                'year' => 2021,
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('created_by', $user->id);

        $this->assertDatabaseHas('diagnostic_tests', [
            'name' => 'Xpert MTB/RIF Ultra',
            'created_by' => $user->id,
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

    private function workspaceUser(string $email): User
    {
        return User::create([
            'name' => 'Workspace User',
            'email' => $email,
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);
    }
}
