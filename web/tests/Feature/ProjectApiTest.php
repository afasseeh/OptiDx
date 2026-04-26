<?php

namespace Tests\Feature;

use App\Models\Project;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProjectApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_persists_project_metadata_and_prevalence(): void
    {
        $response = $this->postJson('/api/projects', [
            'title' => 'Pulmonary tuberculosis',
            'disease_area' => 'Tuberculosis',
            'intended_use' => 'Balanced MCDA',
            'target_population' => 'Adults 15+',
            'prevalence' => 0.08,
            'setting' => 'comm',
            'metadata' => [
                'objective' => 'Balanced MCDA',
                'minimum_sensitivity' => 0.85,
                'minimum_specificity' => 0.90,
                'maximum_total_cost' => 10.0,
                'maximum_turnaround_time' => 72,
                'maximum_skill_level' => 3,
                'allowed_sample_types' => ['Blood', 'Sputum'],
                'sample_types' => ['Blood', 'Sputum'],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('title', 'Pulmonary tuberculosis')
            ->assertJsonPath('metadata.objective', 'Balanced MCDA')
            ->assertJsonPath('metadata.allowed_sample_types.0', 'Blood');

        $project = Project::query()->firstOrFail();

        $this->assertSame('Pulmonary tuberculosis', $project->title);
        $this->assertSame('Balanced MCDA', $project->metadata['objective']);
        $this->assertSame(['Blood', 'Sputum'], $project->metadata['allowed_sample_types']);
        $this->assertEqualsWithDelta(0.08, (float) $project->prevalence, 0.00001);
    }

    public function test_update_keeps_project_metadata_in_sync(): void
    {
        $project = Project::create([
            'title' => 'Pulmonary tuberculosis',
            'disease_area' => 'Tuberculosis',
            'intended_use' => 'Balanced MCDA',
            'target_population' => 'Adults 15+',
            'prevalence' => 0.08,
            'setting' => 'comm',
            'metadata' => [
                'objective' => 'Balanced MCDA',
                'minimum_sensitivity' => 0.85,
                'minimum_specificity' => 0.90,
                'maximum_total_cost' => 10.0,
                'maximum_turnaround_time' => 72,
                'maximum_skill_level' => 3,
                'allowed_sample_types' => ['Blood', 'Sputum'],
                'sample_types' => ['Blood', 'Sputum'],
            ],
        ]);

        $response = $this->putJson("/api/projects/{$project->id}", [
            'title' => 'New project title',
            'disease_area' => 'Tuberculosis',
            'intended_use' => 'Minimize cost',
            'target_population' => 'Adults 15+',
            'prevalence' => 0.12,
            'setting' => 'hospital',
            'metadata' => [
                'objective' => 'Minimize cost',
                'minimum_sensitivity' => 0.90,
                'minimum_specificity' => 0.88,
                'maximum_total_cost' => 8.5,
                'maximum_turnaround_time' => 48,
                'maximum_skill_level' => 4,
                'allowed_sample_types' => ['Blood'],
                'sample_types' => ['Blood'],
            ],
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('title', 'New project title')
            ->assertJsonPath('metadata.objective', 'Minimize cost')
            ->assertJsonPath('metadata.allowed_sample_types.0', 'Blood');

        $updated = $project->fresh();

        $this->assertSame('New project title', $updated->title);
        $this->assertSame('Minimize cost', $updated->metadata['objective']);
        $this->assertSame(['Blood'], $updated->metadata['allowed_sample_types']);
        $this->assertEqualsWithDelta(0.12, (float) $updated->prevalence, 0.00001);
    }
}
