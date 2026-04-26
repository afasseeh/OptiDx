<?php

namespace Tests\Unit;

use App\Models\OptimizationRun;
use App\Services\OptimizationService;
use App\Services\PythonEngineBridge;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OptimizationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_optimize_normalizes_canonical_payload_before_bridge_call(): void
    {
        $bridge = new class extends PythonEngineBridge {
            public array $payload = [];

            public function optimize(array $payload): array
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
        $this->assertSame(0.08, $bridge->payload['constraints']['prevalence']);
        $this->assertSame(true, $bridge->payload['constraints']['blood_allowed']);
        $this->assertSame(false, $bridge->payload['constraints']['radiologist_allowed']);
        $this->assertSame('t_blood', $bridge->payload['tests']['t_blood']['id']);
        $this->assertSame('blood', $bridge->payload['tests']['t_blood']['sample_types'][0]);
        $this->assertSame(true, $bridge->payload['tests']['t_blood']['sample_blood']);
        $this->assertSame('success', $result['status']);
    }

    public function test_record_run_result_persists_runtime_fields(): void
    {
        $service = new OptimizationService($this->createMock(PythonEngineBridge::class));
        $run = OptimizationRun::create([
            'status' => 'queued',
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
        $this->assertSame($result, $updated->result_payload);
    }
}
