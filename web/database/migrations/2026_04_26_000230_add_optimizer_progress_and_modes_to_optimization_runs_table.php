<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (! Schema::hasColumn('optimization_runs', 'run_mode')) {
                $table->string('run_mode', 24)->default('light')->after('project_id');
            }

            if (! Schema::hasColumn('optimization_runs', 'progress_percent')) {
                $table->unsignedTinyInteger('progress_percent')->nullable()->after('status');
            }

            if (! Schema::hasColumn('optimization_runs', 'progress_stage')) {
                $table->string('progress_stage', 96)->nullable()->after('progress_percent');
            }

            if (! Schema::hasColumn('optimization_runs', 'progress_message')) {
                $table->text('progress_message')->nullable()->after('progress_stage');
            }

            if (! Schema::hasColumn('optimization_runs', 'progress_payload')) {
                $table->json('progress_payload')->nullable()->after('progress_message');
            }

            if (! Schema::hasColumn('optimization_runs', 'notified_at')) {
                $table->timestamp('notified_at')->nullable()->after('completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (Schema::hasColumn('optimization_runs', 'notified_at')) {
                $table->dropColumn('notified_at');
            }
            if (Schema::hasColumn('optimization_runs', 'progress_payload')) {
                $table->dropColumn('progress_payload');
            }
            if (Schema::hasColumn('optimization_runs', 'progress_message')) {
                $table->dropColumn('progress_message');
            }
            if (Schema::hasColumn('optimization_runs', 'progress_stage')) {
                $table->dropColumn('progress_stage');
            }
            if (Schema::hasColumn('optimization_runs', 'progress_percent')) {
                $table->dropColumn('progress_percent');
            }
            if (Schema::hasColumn('optimization_runs', 'run_mode')) {
                $table->dropColumn('run_mode');
            }
        });
    }
};
