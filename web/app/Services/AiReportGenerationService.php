<?php

namespace App\Services;

use App\Models\Pathway;
use App\Models\Report;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class AiReportGenerationService
{
    public const SETTINGS_SCOPE = 'workspace';
    public const SETTINGS_KEY = 'openrouter_credentials';

    public function resolveCredentials(?User $user = null): array
    {
        $envApiKey = trim((string) Config::get('services.openrouter.api_key', ''));
        $envModel = $this->normalizeModel((string) Config::get('services.openrouter.model', '~anthropic/claude-sonnet-latest'));

        $resolved = [
            'api_key' => $envApiKey !== '' ? $envApiKey : null,
            'model' => $envModel !== '' ? $envModel : '~anthropic/claude-sonnet-latest',
            'source' => $envApiKey !== '' ? 'env' : 'missing',
            'has_override' => false,
        ];

        if (! $user?->id) {
            return $resolved;
        }

        $setting = Setting::withoutGlobalScopes()
            ->where('created_by', $user->id)
            ->where('scope', self::SETTINGS_SCOPE)
            ->where('key', self::SETTINGS_KEY)
            ->first();

        if (! $setting) {
            return $resolved;
        }

        $value = is_array($setting->value) ? $setting->value : [];
        $overrideModel = $this->normalizeModel((string) ($value['model'] ?? ''));
        $encryptedApiKey = $value['api_key_encrypted'] ?? null;
        $decryptedApiKey = $this->decryptApiKey($encryptedApiKey);

        if ($overrideModel !== '') {
            $resolved['model'] = $overrideModel;
        }

        if ($decryptedApiKey !== null) {
            $resolved['api_key'] = $decryptedApiKey;
            $resolved['source'] = 'user_setting';
            $resolved['has_override'] = true;
        }

        return $resolved;
    }

    public function buildPrompt(Pathway $pathway, array $snapshot, array $settings): array
    {
        $enabledSections = array_values(array_filter(
            is_array($settings['sections'] ?? null) ? $settings['sections'] : [],
            fn ($section): bool => ($section['enabled'] ?? true) !== false
        ));

        $project = is_array($snapshot['project'] ?? null) ? $snapshot['project'] : [];
        $summary = is_array($snapshot['summary'] ?? null) ? $snapshot['summary'] : [];
        $metrics = is_array($snapshot['metrics'] ?? null) ? $snapshot['metrics'] : [];
        $warnings = array_values(array_map(
            fn ($warning) => is_array($warning) ? ($warning['text'] ?? null) : $warning,
            is_array($snapshot['warnings'] ?? null) ? $snapshot['warnings'] : []
        ));

        $context = [
            'report_request' => [
                'pathway_id' => $pathway->id,
                'pathway_name' => $snapshot['pathway']['name'] ?? $pathway->name,
                'project_title' => $project['title'] ?? null,
                'audience' => $settings['audience']['selected'] ?? 'technical',
                'output_format' => $settings['output']['selected_format'] ?? 'pdf',
                'enabled_sections' => array_map(function (array $section): array {
                    return [
                        'id' => $section['id'] ?? null,
                        'label' => $section['label'] ?? null,
                        'description' => $section['description'] ?? null,
                        'page' => $section['page'] ?? null,
                    ];
                }, $enabledSections),
            ],
            'project_context' => [
                'disease_area' => $project['disease_area'] ?? null,
                'intended_use' => $project['intended_use'] ?? null,
                'target_population' => $project['target_population'] ?? null,
                'setting' => $project['setting'] ?? null,
                'prevalence' => $summary['prevalence'] ?? ($project['prevalence'] ?? null),
            ],
            'pathway_context' => [
                'metadata' => $snapshot['pathway']['metadata'] ?? [],
                'start_node_id' => $snapshot['pathway']['start_node_id'] ?? null,
                'validation' => $snapshot['validation'] ?? [],
            ],
            'evaluation_summary' => [
                'summary' => $summary,
                'metrics' => $metrics,
                'paths' => $snapshot['paths'] ?? [],
                'tests' => $snapshot['tests'] ?? [],
                'warnings' => array_values(array_filter($warnings)),
            ],
        ];

        $system = <<<'TEXT'
You are writing a professional diagnostic pathway report for OptiDx.
Return only valid JSON.
Never invent evidence, references, metrics, pathway structure, costs, timings, warnings, or comparator results that are not present in the provided context.
If information is missing, say that it was not available in the current pathway snapshot and use appropriately cautious uncertainty language.
Keep the tone suitable for formal HTA and ministry reporting.
TEXT;

        $user = <<<TEXT
Generate section drafts for the enabled report sections.

Requirements:
1. Respect the selected audience and output format.
2. Use only the supplied pathway snapshot and settings context.
3. Write comprehensive but concise section prose.
4. Where useful, include bullet lists and compact tables.
5. Output JSON with this shape:
{
  "generated_sections": {
    "<section_id>": {
      "title": "Section title",
      "content": "Main narrative as plain text",
      "bullets": ["optional bullet", "..."],
      "tables": [
        {
          "title": "Optional table title",
          "columns": ["Column A", "Column B"],
          "rows": [
            ["value a1", "value b1"]
          ]
        }
      ]
    }
  }
}

Pathway report context:
{$this->encodeJson($context)}
TEXT;

        return [
            ['role' => 'system', 'content' => $system],
            ['role' => 'user', 'content' => $user],
        ];
    }

    public function generateSections(Pathway $pathway, array $snapshot, array $settings, ?User $user = null): array
    {
        if (function_exists('set_time_limit')) {
            @set_time_limit(180);
        }

        $credentials = $this->resolveCredentials($user);
        if (! $credentials['api_key']) {
            throw new \RuntimeException('OpenRouter is not configured. Add an API key in the server environment or saved workspace settings.');
        }

        $response = Http::baseUrl((string) Config::get('services.openrouter.base_url', 'https://openrouter.ai/api/v1'))
            ->timeout(120)
            ->withToken($credentials['api_key'])
            ->withHeaders([
                'HTTP-Referer' => rtrim((string) config('app.url'), '/'),
                'X-Title' => config('app.name', 'OptiDx'),
            ])
            ->post('/chat/completions', [
                'model' => $credentials['model'],
                'messages' => $this->buildPrompt($pathway, $snapshot, $settings),
                'temperature' => 0.2,
                'response_format' => ['type' => 'json_object'],
            ]);

        if ($response->failed()) {
            throw new \RuntimeException('OpenRouter request failed: ' . $response->status() . ' ' . Str::limit($response->body(), 300));
        }

        $content = Arr::get($response->json(), 'choices.0.message.content');
        if (! is_string($content) || trim($content) === '') {
            throw new \RuntimeException('OpenRouter returned an empty report payload.');
        }

        $enabledSections = array_values(array_filter(
            is_array($settings['sections'] ?? null) ? $settings['sections'] : [],
            fn ($section): bool => ($section['enabled'] ?? true) !== false
        ));

        $normalizedSections = $this->normalizeGeneratedSections($content, $enabledSections);

        if ($normalizedSections === []) {
            throw new \RuntimeException('OpenRouter returned no valid report sections.');
        }

        return [
            'generated_sections' => $normalizedSections,
            'ai_generation' => [
                'provider' => 'openrouter',
                'model' => $credentials['model'],
                'generated_at' => now()->toIso8601String(),
                'source' => 'settings+snapshot',
                'section_count' => count($normalizedSections),
            ],
        ];
    }

    public function normalizeGeneratedSections(string|array $payload, array $enabledSections): array
    {
        $decoded = is_array($payload) ? $payload : $this->decodeResponsePayload($payload);
        $sectionMap = is_array($decoded['generated_sections'] ?? null)
            ? $decoded['generated_sections']
            : (is_array($decoded['sections'] ?? null) ? $decoded['sections'] : []);

        $normalized = [];
        foreach ($enabledSections as $section) {
            $sectionId = (string) ($section['id'] ?? '');
            if ($sectionId === '') {
                continue;
            }

            $candidate = $sectionMap[$sectionId] ?? $this->findSectionCandidate($sectionMap, $sectionId);
            if (! is_array($candidate)) {
                continue;
            }

            $content = trim((string) ($candidate['content'] ?? $candidate['body'] ?? ''));
            if ($content === '') {
                continue;
            }

            $bullets = array_values(array_filter(array_map(
                fn ($bullet) => is_scalar($bullet) ? trim((string) $bullet) : '',
                is_array($candidate['bullets'] ?? null) ? $candidate['bullets'] : []
            )));

            $tables = [];
            foreach (is_array($candidate['tables'] ?? null) ? $candidate['tables'] : [] as $table) {
                if (! is_array($table)) {
                    continue;
                }

                $columns = array_values(array_filter(array_map(
                    fn ($column) => is_scalar($column) ? trim((string) $column) : '',
                    is_array($table['columns'] ?? null) ? $table['columns'] : []
                )));
                $rows = array_values(array_filter(array_map(function ($row) {
                    if (! is_array($row)) {
                        return null;
                    }

                    $normalizedRow = array_values(array_map(
                        fn ($value) => is_scalar($value) ? trim((string) $value) : json_encode($value, JSON_UNESCAPED_SLASHES),
                        $row
                    ));

                    return $normalizedRow === [] ? null : $normalizedRow;
                }, is_array($table['rows'] ?? null) ? $table['rows'] : [])));

                if ($columns === [] && $rows === []) {
                    continue;
                }

                $tables[] = [
                    'title' => trim((string) ($table['title'] ?? '')),
                    'columns' => $columns,
                    'rows' => $rows,
                ];
            }

            $normalized[$sectionId] = [
                'title' => trim((string) ($candidate['title'] ?? $section['label'] ?? $sectionId)) ?: ($section['label'] ?? $sectionId),
                'content' => $content,
                'bullets' => $bullets,
                'tables' => $tables,
            ];
        }

        return $normalized;
    }

    public function sanitizeCredentialsSetting(?array $value): array
    {
        $value = is_array($value) ? $value : [];

        return [
            'model' => $this->normalizeModel((string) ($value['model'] ?? Config::get('services.openrouter.model', '~anthropic/claude-sonnet-latest'))),
            'has_api_key' => ! empty($value['api_key_encrypted']),
            'saved_at' => $value['saved_at'] ?? null,
            'source' => 'workspace_setting',
        ];
    }

    public function encryptApiKey(string $apiKey): string
    {
        return Crypt::encryptString(trim($apiKey));
    }

    private function decryptApiKey(mixed $encrypted): ?string
    {
        if (! is_string($encrypted) || trim($encrypted) === '') {
            return null;
        }

        try {
            $decrypted = trim(Crypt::decryptString($encrypted));
            return $decrypted !== '' ? $decrypted : null;
        } catch (\Throwable) {
            return null;
        }
    }

    private function decodeResponsePayload(string $payload): array
    {
        $decoded = json_decode($payload, true);
        if (is_array($decoded)) {
            return $decoded;
        }

        if (preg_match('/\{.*\}/s', $payload, $matches) === 1) {
            $decoded = json_decode($matches[0], true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        throw new \RuntimeException('OpenRouter returned malformed JSON for the report draft.');
    }

    private function findSectionCandidate(array $sectionMap, string $sectionId): ?array
    {
        if (array_is_list($sectionMap)) {
            foreach ($sectionMap as $candidate) {
                if (! is_array($candidate)) {
                    continue;
                }

                if (($candidate['id'] ?? null) === $sectionId) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function encodeJson(array $value): string
    {
        return (string) json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    }

    private function normalizeModel(string $model): string
    {
        $normalized = trim($model);
        if ($normalized === '' || $normalized === 'anthropic/claude-sonnet-latest') {
            return '~anthropic/claude-sonnet-latest';
        }

        return $normalized;
    }
}
