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
    }
}
