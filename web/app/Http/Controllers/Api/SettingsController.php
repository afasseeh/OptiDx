<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        return Setting::query()->orderBy('key')->get();
    }

    public function update(Request $request)
    {
        $data = $request->validate([
            'scope' => ['nullable', 'string', 'max:255'],
            'key' => ['required', 'string', 'max:255'],
            'value' => ['nullable', 'array'],
        ]);

        $scope = $data['scope'] ?? 'workspace';
        $setting = Setting::updateOrCreate(
            ['scope' => $scope, 'key' => $data['key']],
            ['scope' => $scope, 'key' => $data['key'], 'value' => $data['value'] ?? null]
        );

        return response()->json($setting);
    }
}
