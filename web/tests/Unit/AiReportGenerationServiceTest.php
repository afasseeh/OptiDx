<?php

namespace Tests\Unit;

use App\Models\Setting;
use App\Models\User;
use App\Services\AiReportGenerationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AiReportGenerationServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_resolve_credentials_falls_back_to_env_defaults(): void
    {
        config()->set('services.openrouter.api_key', 'env-openrouter-key');
        config()->set('services.openrouter.model', '~anthropic/claude-sonnet-latest');

        $service = app(AiReportGenerationService::class);
        $resolved = $service->resolveCredentials();

        $this->assertSame('env-openrouter-key', $resolved['api_key']);
        $this->assertSame('~anthropic/claude-sonnet-latest', $resolved['model']);
        $this->assertSame('env', $resolved['source']);
        $this->assertFalse($resolved['has_override']);
    }

    public function test_resolve_credentials_prefers_the_saved_encrypted_user_override(): void
    {
        config()->set('services.openrouter.api_key', 'env-openrouter-key');
        config()->set('services.openrouter.model', '~anthropic/claude-sonnet-latest');

        $user = $this->workspaceUser('openrouter-override@example.com');
        $service = app(AiReportGenerationService::class);

        Setting::withoutGlobalScopes()->create([
            'created_by' => $user->id,
            'scope' => AiReportGenerationService::SETTINGS_SCOPE,
            'key' => AiReportGenerationService::SETTINGS_KEY,
            'value' => [
                'api_key_encrypted' => $service->encryptApiKey('user-openrouter-key'),
                'model' => 'anthropic/claude-3.7-sonnet',
                'saved_at' => now()->toIso8601String(),
            ],
        ]);

        $resolved = $service->resolveCredentials($user);

        $this->assertSame('user-openrouter-key', $resolved['api_key']);
        $this->assertSame('anthropic/claude-3.7-sonnet', $resolved['model']);
        $this->assertSame('user_setting', $resolved['source']);
        $this->assertTrue($resolved['has_override']);
    }

    public function test_resolve_credentials_keeps_env_key_when_override_only_changes_model(): void
    {
        config()->set('services.openrouter.api_key', 'env-openrouter-key');
        config()->set('services.openrouter.model', '~anthropic/claude-sonnet-latest');

        $user = $this->workspaceUser('openrouter-model-only@example.com');
        Setting::withoutGlobalScopes()->create([
            'created_by' => $user->id,
            'scope' => AiReportGenerationService::SETTINGS_SCOPE,
            'key' => AiReportGenerationService::SETTINGS_KEY,
            'value' => [
                'model' => 'anthropic/claude-3.7-sonnet',
                'saved_at' => now()->toIso8601String(),
            ],
        ]);

        $service = app(AiReportGenerationService::class);
        $resolved = $service->resolveCredentials($user);

        $this->assertSame('env-openrouter-key', $resolved['api_key']);
        $this->assertSame('anthropic/claude-3.7-sonnet', $resolved['model']);
        $this->assertSame('env', $resolved['source']);
        $this->assertFalse($resolved['has_override']);
    }

    public function test_prompt_builder_includes_selected_settings_and_pathway_context(): void
    {
        $service = app(AiReportGenerationService::class);
        $pathway = new \App\Models\Pathway([
            'id' => 14,
            'name' => 'TB Community Screening Pathway',
        ]);

        $snapshot = [
            'project' => [
                'title' => 'TB Screening Project',
                'disease_area' => 'Tuberculosis',
                'target_population' => 'Adults 15+',
            ],
            'pathway' => [
                'name' => 'TB Community Screening Pathway',
                'start_node_id' => 'start',
                'metadata' => ['label' => 'TB pathway'],
            ],
            'summary' => [
                'prevalence' => 0.08,
                'sensitivity' => 0.842,
                'specificity' => 0.946,
            ],
            'metrics' => [
                'ppv' => 0.61,
                'npv' => 0.98,
            ],
            'paths' => [
                ['id' => 'p1', 'sequence' => 'Screen -> Xpert'],
            ],
            'tests' => [
                ['id' => 'xpert', 'name' => 'Xpert MTB/RIF Ultra'],
            ],
            'warnings' => [
                ['text' => 'Sensitivity falls below the configured minimum.'],
            ],
        ];

        $settings = [
            'audience' => ['selected' => 'technical'],
            'output' => ['selected_format' => 'pdf'],
            'sections' => [
                ['id' => 'cover', 'label' => 'Cover', 'enabled' => true],
                ['id' => 'comparators', 'label' => 'Comparators', 'enabled' => false],
            ],
        ];

        $prompt = $service->buildPrompt($pathway, $snapshot, $settings);
        $userMessage = $prompt[1]['content'] ?? '';

        $this->assertStringContainsString('"audience": "technical"', $userMessage);
        $this->assertStringContainsString('"output_format": "pdf"', $userMessage);
        $this->assertStringContainsString('"pathway_name": "TB Community Screening Pathway"', $userMessage);
        $this->assertStringContainsString('"warnings"', $userMessage);
        $this->assertStringContainsString('"cover"', $userMessage);
        $this->assertStringNotContainsString('"comparators"', $userMessage);
    }

    public function test_normalize_generated_sections_accepts_valid_json_and_filters_missing_sections(): void
    {
        $service = app(AiReportGenerationService::class);
        $enabledSections = [
            ['id' => 'cover', 'label' => 'Cover & executive summary', 'enabled' => true],
            ['id' => 'warnings', 'label' => 'Warnings & assumptions', 'enabled' => true],
        ];

        $normalized = $service->normalizeGeneratedSections(json_encode([
            'generated_sections' => [
                'cover' => [
                    'title' => 'Cover & executive summary',
                    'content' => 'Generated cover summary.',
                    'bullets' => ['First bullet'],
                ],
                'warnings' => [
                    'title' => 'Warnings & assumptions',
                    'content' => 'Generated warnings section.',
                ],
                'comparators' => [
                    'title' => 'Should be ignored',
                    'content' => 'This section is disabled.',
                ],
            ],
        ], JSON_UNESCAPED_SLASHES), $enabledSections);

        $this->assertArrayHasKey('cover', $normalized);
        $this->assertArrayHasKey('warnings', $normalized);
        $this->assertArrayNotHasKey('comparators', $normalized);
        $this->assertSame('Generated cover summary.', $normalized['cover']['content']);
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
