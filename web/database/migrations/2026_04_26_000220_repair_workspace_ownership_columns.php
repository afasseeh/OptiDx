<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $this->ensureCreatedByColumn('pathways');
        $this->ensureCreatedByColumn('diagnostic_tests');
        $this->ensureCreatedByColumn('settings');

        $defaultOwnerId = DB::table('users')->orderBy('id')->value('id');
        $projectOwners = Schema::hasColumn('projects', 'created_by')
            ? DB::table('projects')->pluck('created_by', 'id')
            : collect();

        if ($defaultOwnerId !== null && Schema::hasColumn('projects', 'created_by')) {
            DB::table('projects')->whereNull('created_by')->update(['created_by' => $defaultOwnerId]);
        }

        $this->backfillChildOwnership('pathways', $projectOwners, $defaultOwnerId);
        $this->backfillChildOwnership('diagnostic_tests', $projectOwners, $defaultOwnerId);

        if (Schema::hasColumn('settings', 'created_by') && $defaultOwnerId !== null) {
            DB::table('settings')->whereNull('created_by')->update(['created_by' => $defaultOwnerId]);
        }
    }

    public function down(): void
    {
        // This migration is intentionally repair-only. Older environments may
        // already depend on the ownership columns once repaired.
    }

    private function ensureCreatedByColumn(string $tableName): void
    {
        if (Schema::hasColumn($tableName, 'created_by')) {
            return;
        }

        Schema::table($tableName, function (Blueprint $table): void {
            $table->foreignId('created_by')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });
    }

    private function backfillChildOwnership(string $tableName, $projectOwners, ?int $defaultOwnerId): void
    {
        if (! Schema::hasColumn($tableName, 'created_by')) {
            return;
        }

        foreach (DB::table($tableName)->whereNull('created_by')->get(['id', 'project_id']) as $row) {
            $ownerId = $row->project_id ? ($projectOwners[$row->project_id] ?? null) : null;
            if ($ownerId === null) {
                $ownerId = $defaultOwnerId;
            }

            if ($ownerId === null) {
                continue;
            }

            DB::table($tableName)->where('id', $row->id)->update(['created_by' => $ownerId]);
        }
    }
};
