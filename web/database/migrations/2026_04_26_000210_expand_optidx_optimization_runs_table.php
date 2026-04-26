<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (! Schema::hasColumn('optimization_runs', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('id')->constrained('users')->nullOnDelete();
            }

            if (! Schema::hasColumn('optimization_runs', 'status')) {
                $table->string('status', 48)->default('queued')->after('project_id');
            }

            if (! Schema::hasColumn('optimization_runs', 'input_payload')) {
                $table->json('input_payload')->nullable()->after('status');
            }

            if (! Schema::hasColumn('optimization_runs', 'search_exhaustive')) {
                $table->boolean('search_exhaustive')->default(false)->after('input_payload');
            }

            if (! Schema::hasColumn('optimization_runs', 'started_at')) {
                $table->timestamp('started_at')->nullable()->after('search_exhaustive');
            }

            if (! Schema::hasColumn('optimization_runs', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('started_at');
            }

            if (! Schema::hasColumn('optimization_runs', 'warnings')) {
                $table->json('warnings')->nullable()->after('completed_at');
            }

            if (! Schema::hasColumn('optimization_runs', 'failure_reason')) {
                $table->text('failure_reason')->nullable()->after('warnings');
            }
        });
    }

    public function down(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (Schema::hasColumn('optimization_runs', 'failure_reason')) {
                $table->dropColumn('failure_reason');
            }
            if (Schema::hasColumn('optimization_runs', 'warnings')) {
                $table->dropColumn('warnings');
            }
            if (Schema::hasColumn('optimization_runs', 'completed_at')) {
                $table->dropColumn('completed_at');
            }
            if (Schema::hasColumn('optimization_runs', 'started_at')) {
                $table->dropColumn('started_at');
            }
            if (Schema::hasColumn('optimization_runs', 'search_exhaustive')) {
                $table->dropColumn('search_exhaustive');
            }
            if (Schema::hasColumn('optimization_runs', 'status')) {
                $table->dropColumn('status');
            }
            if (Schema::hasColumn('optimization_runs', 'input_payload')) {
                $table->dropColumn('input_payload');
            }
            if (Schema::hasColumn('optimization_runs', 'created_by')) {
                $table->dropConstrainedForeignId('created_by');
            }
        });
    }
};
