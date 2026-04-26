<?php

namespace Tests\Unit;

use App\Services\PathwayGraphService;
use Tests\TestCase;

class PathwayGraphServiceTest extends TestCase
{
    public function test_parallel_blocks_allow_duplicate_test_members_without_collapsing_aliases(): void
    {
        $service = new PathwayGraphService();

        $definition = $service->compileEngineDefinition([
            'schema_version' => 'canvas-v1',
            'start_node' => 'parallel_block',
            'tests' => [
                't_xpert' => [
                    'id' => 't_xpert',
                    'name' => 'Xpert MTB/RIF Ultra',
                    'sensitivity' => 0.92,
                    'specificity' => 0.98,
                    'turnaround_time' => 120,
                    'sample_types' => ['sputum'],
                    'skill_level' => 3,
                    'cost' => 9.98,
                ],
            ],
            'nodes' => [
                'parallel_block' => [
                    'id' => 'parallel_block',
                    'type' => 'parallel',
                    'label' => 'Duplicate-friendly block',
                    'members' => [
                        ['id' => 'pm-1', 'testId' => 't_xpert'],
                        ['id' => 'pm-2', 'testId' => 't_xpert'],
                    ],
                ],
                'final_positive' => [
                    'id' => 'final_positive',
                    'type' => 'terminal',
                    'subtype' => 'pos',
                    'label' => 'Positive',
                ],
                'final_negative' => [
                    'id' => 'final_negative',
                    'type' => 'terminal',
                    'subtype' => 'neg',
                    'label' => 'Negative',
                ],
            ],
            'edges' => [
                [
                    'id' => 'e1',
                    'from' => 'parallel_block',
                    'fromPort' => 'both_pos',
                    'to' => 'final_positive',
                ],
                [
                    'id' => 'e2',
                    'from' => 'parallel_block',
                    'fromPort' => 'both_neg',
                    'to' => 'final_negative',
                ],
            ],
        ]);

        $this->assertSame(['pm-1', 'pm-2'], $definition['nodes']['parallel_block']['action']['test_names']);
        $this->assertSame([
            'pm-1' => 'pos',
            'pm-2' => 'pos',
        ], $definition['nodes']['parallel_block']['branches'][0]['conditions']);
        $this->assertArrayHasKey('pm-1', $definition['tests']);
        $this->assertArrayHasKey('pm-2', $definition['tests']);
        $this->assertSame($definition['tests']['t_xpert'], $definition['tests']['pm-1']);
        $this->assertSame($definition['tests']['t_xpert'], $definition['tests']['pm-2']);
    }

    public function test_parallel_discordant_branches_accept_disc_port_labels(): void
    {
        $service = new PathwayGraphService();

        $definition = $service->compileEngineDefinition([
            'schema_version' => 'canvas-v1',
            'start_node' => 'parallel_block',
            'tests' => [
                't_a' => [
                    'id' => 't_a',
                    'name' => 'Test A',
                    'sensitivity' => 0.91,
                    'specificity' => 0.95,
                    'turnaround_time' => 1,
                    'sample_types' => ['blood'],
                    'skill_level' => 2,
                    'cost' => 3,
                ],
                't_b' => [
                    'id' => 't_b',
                    'name' => 'Test B',
                    'sensitivity' => 0.88,
                    'specificity' => 0.94,
                    'turnaround_time' => 2,
                    'sample_types' => ['blood'],
                    'skill_level' => 2,
                    'cost' => 4,
                ],
            ],
            'nodes' => [
                'parallel_block' => [
                    'id' => 'parallel_block',
                    'type' => 'parallel',
                    'label' => 'Discordant block',
                    'members' => [
                        ['id' => 'member-a', 'testId' => 't_a'],
                        ['id' => 'member-b', 'testId' => 't_b'],
                    ],
                ],
                'referee' => [
                    'id' => 'referee',
                    'type' => 'test',
                    'testId' => 't_a',
                ],
                'final_positive' => [
                    'id' => 'final_positive',
                    'type' => 'terminal',
                    'subtype' => 'pos',
                    'label' => 'Positive',
                ],
                'final_negative' => [
                    'id' => 'final_negative',
                    'type' => 'terminal',
                    'subtype' => 'neg',
                    'label' => 'Negative',
                ],
            ],
            'edges' => [
                [
                    'id' => 'e1',
                    'from' => 'parallel_block',
                    'fromPort' => 'both_pos',
                    'to' => 'final_positive',
                ],
                [
                    'id' => 'e2',
                    'from' => 'parallel_block',
                    'fromPort' => 'both_neg',
                    'to' => 'final_negative',
                ],
                [
                    'id' => 'e3',
                    'from' => 'parallel_block',
                    'fromPort' => 'disc',
                    'to' => 'referee',
                ],
                [
                    'id' => 'e4',
                    'from' => 'parallel_block',
                    'fromPort' => 'disc',
                    'to' => 'referee',
                ],
                [
                    'id' => 'e5',
                    'from' => 'referee',
                    'fromPort' => 'pos',
                    'to' => 'final_positive',
                ],
                [
                    'id' => 'e6',
                    'from' => 'referee',
                    'fromPort' => 'neg',
                    'to' => 'final_negative',
                ],
            ],
        ]);

        $discordBranches = $definition['nodes']['parallel_block']['branches'] ?? [];

        $this->assertCount(4, $discordBranches);
        $this->assertSame([
            'member-a' => 'pos',
            'member-b' => 'neg',
        ], $discordBranches[2]['conditions']);
        $this->assertSame([
            'member-a' => 'neg',
            'member-b' => 'pos',
        ], $discordBranches[3]['conditions']);
        $this->assertSame('referee', $discordBranches[2]['next_node']);
        $this->assertSame('referee', $discordBranches[3]['next_node']);
    }
}
