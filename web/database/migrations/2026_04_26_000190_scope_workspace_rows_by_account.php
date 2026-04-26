<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('pathways', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        Schema::table('diagnostic_tests', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->foreignId('created_by')->nullable()->after('id')->constrained('users')->nullOnDelete();
        });

        $defaultOwnerId = DB::table('users')->orderBy('id')->value('id');

        if ($defaultOwnerId !== null) {
            DB::table('projects')->whereNull('created_by')->update(['created_by' => $defaultOwnerId]);
            DB::table('settings')->whereNull('created_by')->update(['created_by' => $defaultOwnerId]);
        }

        // Preserve the workspace history that already belongs to a project by
        // attributing those child rows to the owning account before the new
        // account-scoped query layer starts filtering records. The row-by-row
        // approach keeps the migration portable across SQLite, MySQL, and
        // PostgreSQL test/runtime databases.
        $projectOwners = DB::table('projects')->pluck('created_by', 'id');

        foreach (DB::table('pathways')->whereNull('created_by')->get(['id', 'project_id']) as $pathway) {
            $ownerId = $pathway->project_id ? ($projectOwners[$pathway->project_id] ?? null) : null;
            if ($ownerId === null) {
                $ownerId = $defaultOwnerId;
            }

            if ($ownerId === null) {
                continue;
            }

            DB::table('pathways')->where('id', $pathway->id)->update(['created_by' => $ownerId]);
        }

        foreach (DB::table('diagnostic_tests')->whereNull('created_by')->get(['id', 'project_id']) as $test) {
            $ownerId = $test->project_id ? ($projectOwners[$test->project_id] ?? null) : null;
            if ($ownerId === null) {
                $ownerId = $defaultOwnerId;
            }

            if ($ownerId === null) {
                continue;
            }

            DB::table('diagnostic_tests')->where('id', $test->id)->update(['created_by' => $ownerId]);
        }

        Schema::table('settings', function (Blueprint $table) {
            $table->dropUnique('settings_scope_key_unique');
            $table->unique(['created_by', 'scope', 'key'], 'settings_created_by_scope_key_unique');
        });
    }

    public function down(): void
    {
        Schema::table('settings', function (Blueprint $table) {
            $table->dropUnique('settings_created_by_scope_key_unique');
            $table->unique(['scope', 'key'], 'settings_scope_key_unique');
        });

        Schema::table('settings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });

        Schema::table('diagnostic_tests', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });

        Schema::table('pathways', function (Blueprint $table) {
            $table->dropConstrainedForeignId('created_by');
        });
    }
};
