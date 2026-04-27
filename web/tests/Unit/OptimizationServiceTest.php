<?php

namespace Tests\Unit;

use App\Models\OptimizationRun;
use App\Models\User;
use App\Notifications\OptimizationRunCompletedNotification;
use App\Services\OptimizationService;
use App\Services\PythonEngineBridge;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class OptimizationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_optimize_normalizes_canonical_payload_before_bridge_call(): void
    {
        $bridge = new class extends PythonEngineBridge {
            public array $payload = [];

            public function optimize(array $payload, ?callable $progressCallback = null): array
            {
                $this->payload = $payload;

                return [
                    'status' => 'success',
                    'search_exhaustive' => true,
                    'selected_outputs' => [],
                ];
            }
        };

        $service = new OptimizationService($bridge);
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
        ], [
            'prevalence' => 0.08,
            'allow_radiologist' => false,
        ], 0.08);

        $this->assertArrayHasKey('tests', $bridge->payload);
        $this->assertArrayHasKey('constraints', $bridge->payload);
        $this->assertArrayHasKey('search_config', $bridge->payload);
        $this->assertSame('light', $bridge->payload['run_mode']);
        $this->assertSame(0.08, $bridge->payload['constraints']['prevalence']);
        $this->assertSame(3, $bridge->payload['search_config']['max_stages']);
        $this->assertSame(300, $bridge->payload['search_config']['time_limit_seconds']);
        $this->assertSame(true, $bridge->payload['constraints']['blood_allowed']);
        $this->assertSame(false, $bridge->payload['constraints']['radiologist_allowed']);
        $this->assertSame('t_blood', $bridge->payload['tests']['t_blood']['id']);
        $this->assertSame('blood', $bridge->payload['tests']['t_blood']['sample_types'][0]);
        $this->assertSame(true, $bridge->payload['tests']['t_blood']['sample_blood']);
        $this->assertSame('success', $result['status']);
    }

    public function test_optimize_uses_extensive_search_preset_when_requested(): void
    {
        $bridge = new class extends PythonEngineBridge {
            public array $payload = [];

            public function optimize(array $payload, ?callable $progressCallback = null): array
            {
                $this->payload = $payload;

                return [
                    'status' => 'success',
                    'search_exhaustive' => true,
                    'selected_outputs' => [],
                ];
            }
        };

        $service = new OptimizationService($bridge);
        $service->optimize([
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
        ], [
            'prevalence' => 0.08,
        ], 0.08, [], 'extensive');

        $this->assertSame('extensive', $bridge->payload['run_mode']);
        $this->assertSame(4, $bridge->payload['search_config']['max_stages']);
        $this->assertSame(6, $bridge->payload['search_config']['max_tests_per_realized_path']);
        $this->assertSame(3, $bridge->payload['search_config']['max_parallel_block_size']);
        $this->assertSame(14400, $bridge->payload['search_config']['time_limit_seconds']);
    }

    public function test_normalize_constraints_recovers_percent_scaled_prevalence_values(): void
    {
        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));

        $constraints = $service->normalizeConstraints([
            'prevalence' => 800,
            'min_sensitivity' => 0.85,
            'min_specificity' => 0.90,
        ]);

        $this->assertSame(0.08, $constraints['prevalence']);
    }

    public function test_prepare_run_payload_keeps_numeric_test_ids(): void
    {
        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));

        $payload = $service->prepareRunPayload([
            [
                'id' => 17,
                'name' => 'Numeric id test',
                'sensitivity' => 0.91,
                'specificity' => 0.94,
                'turnaround_time' => 2,
                'sample_types' => ['blood'],
                'skill_level' => 2,
                'cost' => 5,
            ],
        ], [
            'prevalence' => 0.08,
        ]);

        $this->assertArrayHasKey('17', $payload['tests']);
        $this->assertSame('17', $payload['tests']['17']['id']);
    }

    public function test_record_run_result_persists_runtime_fields(): void
    {
        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));
        $run = OptimizationRun::create([
            'status' => 'queued',
            'run_mode' => 'light',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.1], 'search_config' => []],
            'constraints' => ['prevalence' => 0.1],
        ]);

        $result = [
            'status' => 'success',
            'search_exhaustive' => true,
            'candidate_count' => 12,
            'feasible_candidate_count' => 5,
            'warnings' => ['Joint probabilities were unavailable.'],
        ];

        $updated = $service->recordRunResult($run, $result);

        $this->assertSame('success', $updated->status);
        $this->assertTrue($updated->search_exhaustive);
        $this->assertSame(12, $updated->candidate_count);
        $this->assertSame(5, $updated->feasible_count);
        $this->assertSame(100, $updated->progress_percent);
        $this->assertSame('finalizing outputs', $updated->progress_stage);
        $this->assertSame($result, $updated->result_payload);
    }

    public function test_record_run_progress_updates_live_fields(): void
    {
        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));
        $run = OptimizationRun::create([
            'status' => 'running',
            'run_mode' => 'extensive',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.1], 'search_config' => []],
            'constraints' => ['prevalence' => 0.1],
        ]);

        $updated = $service->recordRunProgress($run, [
            'type' => 'progress',
            'stage' => 'searching',
            'progress_percent' => 42,
            'message' => 'Expanded 120 partial pathways.',
            'progress_payload' => [
                'expanded_count' => 120,
                'completed_count' => 8,
                'pruned_count' => 15,
                'frontier_size' => 3,
                'queue_size' => 12,
                'elapsed_seconds' => 17.5,
                'search_exhaustive' => true,
            ],
        ]);

        $this->assertSame(42, $updated->progress_percent);
        $this->assertSame('searching', $updated->progress_stage);
        $this->assertSame('Expanded 120 partial pathways.', $updated->progress_message);
        $this->assertSame(120, $updated->progress_payload['expanded_count']);
    }

    public function test_cancel_run_marks_run_cancelled_without_notification(): void
    {
        Notification::fake();

        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));
        $run = OptimizationRun::create([
            'created_by' => User::create([
                'name' => 'Owner',
                'email' => 'owner-cancel@example.com',
                'password' => Hash::make('password123'),
                'email_verified_at' => now(),
            ])->id,
            'status' => 'running',
            'run_mode' => 'extensive',
            'process_pid' => 999999,
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.1], 'search_config' => []],
            'constraints' => ['prevalence' => 0.1],
        ]);

        $cancelled = $service->cancelRun($run, 'Stopped by user.');

        $this->assertSame('cancelled', $cancelled->status);
        $this->assertSame('Stopped by user.', $cancelled->failure_reason);
        $this->assertNull($cancelled->process_pid);
        $this->assertNotNull($cancelled->completed_at);

        Notification::assertNothingSent();
    }

    public function test_notify_completion_sends_email_for_extensive_runs(): void
    {
        Notification::fake();

        $user = User::create([
            'name' => 'Run Owner',
            'email' => 'run-owner@example.com',
            'password' => Hash::make('password123'),
            'email_verified_at' => now(),
        ]);

        $run = OptimizationRun::create([
            'created_by' => $user->id,
            'status' => 'success',
            'run_mode' => 'extensive',
            'input_payload' => ['tests' => [], 'constraints' => ['prevalence' => 0.1], 'search_config' => []],
            'constraints' => ['prevalence' => 0.1],
            'candidate_count' => 2,
            'feasible_count' => 1,
            'result_payload' => ['status' => 'success'],
        ]);

        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));
        $service->notifyCompletionIfNeeded($run->refresh());

        Notification::assertSentTo($user, OptimizationRunCompletedNotification::class);
        $this->assertNotNull($run->fresh()->notified_at);
    }
}
