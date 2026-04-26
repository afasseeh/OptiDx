<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('first_name')->nullable()->after('name');
            $table->string('last_name')->nullable()->after('first_name');
            $table->string('organization')->nullable()->after('email');
            $table->string('title')->nullable()->after('organization');
            $table->string('timezone')->nullable()->after('title');
        });

        DB::table('users')
            ->select(['id', 'name'])
            ->orderBy('id')
            ->chunkById(100, function ($users): void {
                foreach ($users as $user) {
                    $name = trim((string) $user->name);
                    $parts = preg_split('/\s+/', $name) ?: [];
                    $firstName = $parts[0] ?? $name;
                    $lastName = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : null;

                    DB::table('users')
                        ->where('id', $user->id)
                        ->update([
                            'first_name' => $firstName !== '' ? $firstName : null,
                            'last_name' => $lastName !== '' ? $lastName : null,
                            'timezone' => config('app.timezone'),
                        ]);
                }
            }, 'id');
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['first_name', 'last_name', 'organization', 'title', 'timezone']);
        });
    }
};
