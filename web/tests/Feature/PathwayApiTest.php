<?php

namespace Tests\Feature;

use App\Models\Pathway;
use App\Models\DiagnosticTest;
use App\Models\OptimizationRun;
use App\Models\Project;
use App\Models\Report;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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

    public function test_pathway_index_includes_project_summary_when_present(): void
    {
        $this->actingAs($this->workspaceUser('workspace-project-summary@example.com'));

        $project = Project::create([
            'created_by' => auth()->id(),
            'title' => 'Report project',
        ]);

        $created = $this->postJson('/api/pathways', [
            'project_id' => $project->id,
            'name' => 'Project-linked pathway',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])
            ->assertCreated()
            ->json();

        $this->getJson('/api/pathways')
            ->assertOk()
            ->assertJsonPath('0.id', $created['id'])
            ->assertJsonPath('0.project.id', $project->id)
            ->assertJsonPath('0.project.title', 'Report project');
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

        if (extension_loaded('zip')) {
            $this->get("/api/pathways/{$created['id']}/export/report?format=docx")
                ->assertOk()
                ->assertHeader('content-type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        }
    }

    public function test_report_history_and_download_endpoints_are_scoped_to_the_authenticated_user(): void
    {
        $user = $this->workspaceUser('report-history@example.com');
        $otherUser = $this->workspaceUser('report-history-other@example.com');
        $this->actingAs($user);

        $project = Project::create([
            'title' => 'History project',
            'disease_area' => 'Tuberculosis',
            'intended_use' => 'Balanced MCDA',
            'target_population' => 'Adults 15+',
            'prevalence' => 0.08,
            'setting' => 'comm',
        ]);

        $pathway = $this->postJson('/api/pathways', [
            'project_id' => $project->id,
            'name' => 'History pathway',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])->assertCreated()->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $this->canonicalPathwayPayload(),
            'pathway_id' => $pathway['id'],
            'prevalence' => 0.08,
        ])->assertOk();

        $generated = $this->get("/api/pathways/{$pathway['id']}/export/report?format=pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $report = Report::query()->latest('id')->firstOrFail();
        $this->assertNotEmpty($report->html_path);
        $this->assertNotEmpty($report->pdf_path);
        $this->assertTrue(File::exists($report->html_path));
        $this->assertTrue(File::exists($report->pdf_path));

        $this->actingAs($otherUser);
        Report::withoutGlobalScopes()->create([
            'created_by' => $otherUser->id,
            'project_id' => $project->id,
            'pathway_id' => $pathway['id'],
            'optimization_run_id' => null,
            'format' => 'pdf',
            'html_path' => $report->html_path,
            'pdf_path' => $report->pdf_path,
            'json_path' => $report->json_path,
            'metadata' => [
                'title' => 'Foreign report',
                'subtitle' => 'Should not leak',
                'generated_at' => now()->toIso8601String(),
                'summary' => [],
            ],
        ]);

        $this->actingAs($user);

        $this->getJson("/api/pathways/{$pathway['id']}/reports")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $report->id);

        $this->getJson("/api/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('report.id', $report->id)
            ->assertJsonPath('data.title', 'Canonical pathway')
            ->assertJsonPath('data.settings.template', 'OptiDx decision report')
            ->assertJsonCount(11, 'data.sections');

        $this->putJson("/api/reports/{$report->id}", [
            'title' => 'Renamed report',
        ])
            ->assertOk()
            ->assertJsonPath('report.id', $report->id)
            ->assertJsonPath('report.title', 'Renamed report')
            ->assertJsonPath('data.title', 'Renamed report');

        $this->get("/api/reports/{$report->id}/download?format=pdf")
            ->assertOk()
            ->assertHeader('content-type', 'application/pdf');

        $this->deleteJson("/api/reports/{$report->id}")
            ->assertNoContent();

        $this->assertDatabaseMissing('reports', ['id' => $report->id]);
    }

    public function test_report_export_falls_back_when_the_browser_pdf_renderer_fails(): void
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->markTestSkipped('This regression is specific to the Windows report renderer fallback.');
        }

        $this->actingAs($this->workspaceUser('report-fallback@example.com'));

        $payload = $this->canonicalPathwayPayload();

        $created = $this->postJson('/api/pathways', [
            'name' => 'Fallback report target',
            'editor_definition' => $payload,
        ])
            ->assertCreated()
            ->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $payload,
            'pathway_id' => $created['id'],
            'prevalence' => 0.08,
        ])->assertOk();

        $renderer = tempnam(sys_get_temp_dir(), 'fake-node-') . '.cmd';
        File::put($renderer, "@echo off\r\nexit /b 1\r\n");

        $previousNodeExecutable = getenv('NODE_EXECUTABLE') ?: null;
        putenv('NODE_EXECUTABLE=' . $renderer);
        $_ENV['NODE_EXECUTABLE'] = $renderer;
        $_SERVER['NODE_EXECUTABLE'] = $renderer;

        try {
            $this->get("/api/pathways/{$created['id']}/export/report?format=pdf")
                ->assertOk()
                ->assertHeader('content-type', 'application/pdf');

            $report = Report::query()->latest('id')->firstOrFail();
            $this->assertTrue(File::exists($report->pdf_path));
        } finally {
            if ($previousNodeExecutable !== null && $previousNodeExecutable !== '') {
                putenv('NODE_EXECUTABLE=' . $previousNodeExecutable);
                $_ENV['NODE_EXECUTABLE'] = $previousNodeExecutable;
                $_SERVER['NODE_EXECUTABLE'] = $previousNodeExecutable;
            } else {
                putenv('NODE_EXECUTABLE');
                unset($_ENV['NODE_EXECUTABLE'], $_SERVER['NODE_EXECUTABLE']);
            }

            if (File::exists($renderer)) {
                File::delete($renderer);
            }
        }
    }

    public function test_generate_ai_report_persists_generated_sections_into_the_report_snapshot(): void
    {
        config()->set('services.openrouter.api_key', 'test-openrouter-key');
        config()->set('services.openrouter.model', '~anthropic/claude-sonnet-latest');

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'generated_sections' => [
                                'cover' => [
                                    'title' => 'Cover & executive summary',
                                    'content' => 'AI-generated executive summary.',
                                    'bullets' => ['Key takeaway'],
                                ],
                                'warnings' => [
                                    'title' => 'Warnings & assumptions',
                                    'content' => 'AI-generated warnings section.',
                                ],
                            ],
                        ], JSON_UNESCAPED_SLASHES),
                    ],
                ]],
            ], 200),
        ]);

        $this->actingAs($this->workspaceUser('ai-report-owner@example.com'));

        $created = $this->postJson('/api/pathways', [
            'name' => 'AI report target',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])->assertCreated()->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $this->canonicalPathwayPayload(),
            'pathway_id' => $created['id'],
            'prevalence' => 0.08,
        ])->assertOk();

        $response = $this->postJson("/api/pathways/{$created['id']}/report/generate-ai", [
            'settings' => [
                'audience' => ['selected' => 'technical'],
                'output' => ['selected_format' => 'pdf'],
                'sections' => [
                    ['id' => 'cover', 'label' => 'Cover & executive summary', 'enabled' => true],
                    ['id' => 'warnings', 'label' => 'Warnings & assumptions', 'enabled' => true],
                ],
            ],
        ])
            ->assertOk()
            ->assertJsonPath('data.generated_sections.cover.content', 'AI-generated executive summary.')
            ->assertJsonPath('data.ai_generation.model', '~anthropic/claude-sonnet-latest');

        $reportId = $response->json('report.id');
        $report = Report::query()->findOrFail($reportId);

        $this->assertSame('AI-generated executive summary.', $report->metadata['generated_sections']['cover']['content'] ?? null);
        $this->assertSame('~anthropic/claude-sonnet-latest', $report->metadata['ai_generation']['model'] ?? null);
    }

    public function test_generate_ai_report_is_scoped_to_the_authenticated_users_pathways(): void
    {
        config()->set('services.openrouter.api_key', 'test-openrouter-key');

        Http::fake([
            'https://openrouter.ai/api/v1/chat/completions' => Http::response([
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'generated_sections' => [
                                'cover' => [
                                    'title' => 'Cover & executive summary',
                                    'content' => 'AI-generated executive summary.',
                                ],
                            ],
                        ], JSON_UNESCAPED_SLASHES),
                    ],
                ]],
            ], 200),
        ]);

        $owner = $this->workspaceUser('ai-report-owner-scope@example.com');
        $otherUser = $this->workspaceUser('ai-report-other-scope@example.com');
        $this->actingAs($owner);

        $created = $this->postJson('/api/pathways', [
            'name' => 'Scoped AI report target',
            'editor_definition' => $this->canonicalPathwayPayload(),
        ])->assertCreated()->json();

        $this->postJson('/api/pathways/evaluate', [
            'pathway' => $this->canonicalPathwayPayload(),
            'pathway_id' => $created['id'],
            'prevalence' => 0.08,
        ])->assertOk();

        $this->actingAs($otherUser);

        $this->postJson("/api/pathways/{$created['id']}/report/generate-ai", [
            'settings' => [
                'sections' => [
                    ['id' => 'cover', 'label' => 'Cover & executive summary', 'enabled' => true],
                ],
            ],
        ])->assertNotFound();
    }

    public function test_openrouter_credentials_setting_is_masked_in_api_responses(): void
    {
        $this->actingAs($this->workspaceUser('openrouter-settings@example.com'));

        $saved = $this->putJson('/api/settings', [
            'scope' => 'workspace',
            'key' => 'openrouter_credentials',
            'value' => [
                'api_key' => 'sk-or-v1-test-secret',
                'model' => '~anthropic/claude-sonnet-latest',
            ],
        ])
            ->assertOk()
            ->assertJsonPath('value.model', '~anthropic/claude-sonnet-latest')
            ->assertJsonPath('value.has_api_key', true)
            ->assertJsonMissing(['api_key' => 'sk-or-v1-test-secret']);

        $setting = Setting::query()->firstOrFail();
        $this->assertNotSame('sk-or-v1-test-secret', $setting->value['api_key_encrypted'] ?? null);
        $this->assertArrayHasKey('api_key_encrypted', $setting->value ?? []);

        $this->getJson('/api/settings')
            ->assertOk()
            ->assertJsonPath('0.key', 'openrouter_credentials')
            ->assertJsonPath('0.value.has_api_key', true)
            ->assertJsonMissing(['api_key' => 'sk-or-v1-test-secret']);
    }

    public function test_pathway_crud_supports_standalone_records(): void
    {
        $this->actingAs($this->workspaceUser('standalone-pathway@example.com'));

        $created = $this->postJson('/api/pathways', [
            'project_id' => null,
            'name' => 'Standalone pathway',
            'editor_definition' => $this->canonicalPathwayPayload(),
            'metadata' => [
                'label' => 'Standalone pathway',
            ],
        ])
            ->assertCreated()
            ->json();

        $this->assertNull($created['project_id']);

        $updated = $this->putJson("/api/pathways/{$created['id']}", [
            'name' => 'Updated standalone pathway',
            'metadata' => [
                'label' => 'Updated standalone pathway',
            ],
        ])
            ->assertOk()
            ->json();

        $this->assertSame('Updated standalone pathway', $updated['name']);

        $this->deleteJson("/api/pathways/{$created['id']}")
            ->assertNoContent();

        $this->assertDatabaseMissing('pathways', [
            'id' => $created['id'],
        ]);
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
            'run_mode' => 'light',
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

        $run = OptimizationRun::query()->first();
        $this->assertNotNull($run);
        $this->assertSame('queued', $run?->status);
        $this->assertSame('light', $run?->run_mode);

        $this->getJson("/api/optimization-runs/{$run->id}")
            ->assertOk()
            ->assertJsonPath('id', $run->id)
            ->assertJsonPath('run_mode', 'light')
            ->assertJsonPath('progress_percent', null);
    }

    public function test_optimization_runs_latest_endpoint_returns_account_latest_run(): void
    {
        $user = $this->workspaceUser('optimizer-latest@example.com');
        $this->actingAs($user);

        OptimizationRun::create([
            'created_by' => $user->id,
            'project_id' => null,
            'run_mode' => 'light',
            'status' => 'success',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.08], 'search_config' => []],
            'constraints' => ['prevalence' => 0.08],
            'result_payload' => ['status' => 'success', 'message' => 'First run'],
        ]);

        $latest = OptimizationRun::create([
            'created_by' => $user->id,
            'project_id' => null,
            'run_mode' => 'extensive',
            'status' => 'success',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.08], 'search_config' => []],
            'constraints' => ['prevalence' => 0.08],
            'result_payload' => ['status' => 'success', 'message' => 'Latest run'],
        ]);

        $this->getJson('/api/optimization-runs/latest')
            ->assertOk()
            ->assertJsonPath('id', $latest->id)
            ->assertJsonPath('run_mode', 'extensive')
            ->assertJsonPath('message', 'Latest run');
    }

    public function test_optimization_runs_index_lists_scoped_history(): void
    {
        $user = $this->workspaceUser('optimizer-history@example.com');
        $otherUser = $this->workspaceUser('optimizer-history-other@example.com');
        $this->actingAs($user);

        $project = Project::create([
            'created_by' => $user->id,
            'title' => 'History project',
        ]);

        $older = OptimizationRun::create([
            'created_by' => $user->id,
            'project_id' => null,
            'run_mode' => 'light',
            'status' => 'running',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.08], 'search_config' => []],
            'constraints' => ['prevalence' => 0.08],
        ]);

        $latest = OptimizationRun::create([
            'created_by' => $user->id,
            'project_id' => $project->id,
            'run_mode' => 'extensive',
            'status' => 'success',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.08], 'search_config' => []],
            'constraints' => ['prevalence' => 0.08],
            'result_payload' => [
                'status' => 'success',
                'message' => 'Stored result',
                'selected_outputs' => [
                    'highest_youden_j' => ['label' => 'Highest Youden J'],
                ],
            ],
        ]);

        OptimizationRun::create([
            'created_by' => $otherUser->id,
            'project_id' => $project->id,
            'run_mode' => 'light',
            'status' => 'success',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.08], 'search_config' => []],
            'constraints' => ['prevalence' => 0.08],
        ]);

        $this->getJson('/api/optimization-runs?limit=25')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.id', $latest->id)
            ->assertJsonPath('data.0.project_name', 'History project')
            ->assertJsonPath('data.0.selected_output_count', 1)
            ->assertJsonPath('data.1.id', $older->id)
            ->assertJsonPath('data.1.run_mode', 'light');

        $this->getJson("/api/optimization-runs?project_id={$project->id}")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id', $latest->id);
    }

    public function test_optimize_run_can_be_cancelled_and_clears_active_state(): void
    {
        $this->actingAs($this->workspaceUser('optimizer-cancel@example.com'));

        $run = OptimizationRun::create([
            'project_id' => null,
            'run_mode' => 'extensive',
            'status' => 'running',
            'process_pid' => 999999,
            'input_payload' => [
                'tests' => [
                    't_xpert' => [
                        'id' => 't_xpert',
                        'name' => 'Xpert MTB/RIF Ultra',
                        'sensitivity' => 0.88,
                        'specificity' => 0.98,
                        'turnaround_time' => 2,
                        'turnaround_time_unit' => 'hr',
                        'sample_types' => ['sputum'],
                        'skill_level' => 2,
                        'cost' => 9.98,
                    ],
                ],
                'constraints' => ['prevalence' => 0.08],
                'search_config' => [],
                'run_mode' => 'extensive',
            ],
            'constraints' => ['prevalence' => 0.08],
        ]);

        $this->postJson("/api/optimization-runs/{$run->id}/cancel", [
            'reason' => 'Stopped by user.',
        ])
            ->assertOk()
            ->assertJsonPath('status', 'cancelled')
            ->assertJsonPath('failure_reason', 'Stopped by user.');

        $this->assertSame('cancelled', $run->fresh()->status);
        $this->assertNotNull($run->fresh()->completed_at);
        $this->assertNull($run->fresh()->process_pid);
    }

    public function test_optimize_falls_back_to_workspace_tests_and_normalizes_prevalence(): void
    {
        $user = $this->workspaceUser('optimizer-fallback@example.com');
        $this->actingAs($user);
        Queue::fake();

        DiagnosticTest::create([
            'created_by' => $user->id,
            'name' => 'Existing workspace test',
            'category' => 'clinical',
            'sensitivity' => 0.91,
            'specificity' => 0.93,
            'cost' => 4.5,
            'currency' => 'USD',
            'turnaround_time' => 2,
            'turnaround_time_unit' => 'hr',
            'sample_types' => ['blood'],
            'skill_level' => 2,
            'availability' => true,
        ]);

        $response = $this->postJson('/api/pathways/optimize', [
            'tests' => [],
            'constraints' => [
                'prevalence' => 800,
                'min_sensitivity' => 0.85,
                'min_specificity' => 0.90,
            ],
            'run_mode' => 'light',
        ]);

        $response
            ->assertAccepted()
            ->assertJsonPath('input_payload.constraints.prevalence', 0.08);

        $run = OptimizationRun::query()->latest('id')->first();
        $this->assertNotNull($run);
        $tests = $run->input_payload['tests'] ?? [];
        $this->assertCount(1, $tests);
        $this->assertSame('Existing workspace test', array_values($tests)[0]['name'] ?? null);
    }

    public function test_optimize_returns_validation_error_when_no_tests_are_available(): void
    {
        $this->actingAs($this->workspaceUser('optimizer-empty@example.com'));
        Queue::fake();

        $this->postJson('/api/pathways/optimize', [
            'tests' => [],
            'constraints' => [
                'prevalence' => 0.08,
                'min_sensitivity' => 0.85,
                'min_specificity' => 0.90,
            ],
            'run_mode' => 'light',
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'Add at least one diagnostic test before running the optimization.');
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
