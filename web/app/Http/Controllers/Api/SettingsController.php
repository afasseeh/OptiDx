<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Services\AiReportGenerationService;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(
        private readonly AiReportGenerationService $aiReports,
    ) {
    }

    public function index()
    {
        return Setting::query()
            ->orderBy('key')
            ->get()
            ->map(fn (Setting $setting) => $this->presentSetting($setting))
            ->values();
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'scope' => ['nullable', 'string', 'max:255'],
            'key' => ['required', 'string', 'max:255'],
            'value' => ['nullable', 'array'],
        ]);

        $scope = $data['scope'] ?? 'workspace';
        $userId = $request->user()?->id;
        $value = $this->normalizeSettingValue($data['key'], $data['value'] ?? null);

        $setting = Setting::updateOrCreate(
            ['created_by' => $userId, 'scope' => $scope, 'key' => $data['key']],
            ['created_by' => $userId, 'scope' => $scope, 'key' => $data['key'], 'value' => $value]
        );

        return response()->json($this->presentSetting($setting));
    }

    private function normalizeSettingValue(string $key, ?array $value): ?array
    {
        if ($key !== AiReportGenerationService::SETTINGS_KEY) {
            return $value;
        }

        $value = is_array($value) ? $value : [];
        $model = trim((string) ($value['model'] ?? config('services.openrouter.model', 'anthropic/claude-sonnet-latest')));
        $apiKey = trim((string) ($value['api_key'] ?? ''));
        $existingEncrypted = is_string($value['api_key_encrypted'] ?? null) ? $value['api_key_encrypted'] : null;

        return [
            'model' => $model !== '' ? $model : 'anthropic/claude-sonnet-latest',
            'api_key_encrypted' => $apiKey !== ''
                ? $this->aiReports->encryptApiKey($apiKey)
                : $existingEncrypted,
            'saved_at' => now()->toIso8601String(),
        ];
    }

    private function presentSetting(Setting $setting): array
    {
        $payload = $setting->toArray();

        if ($setting->key === AiReportGenerationService::SETTINGS_KEY) {
            $payload['value'] = $this->aiReports->sanitizeCredentialsSetting(is_array($setting->value) ? $setting->value : []);
        }

        return $payload;
    }
}
