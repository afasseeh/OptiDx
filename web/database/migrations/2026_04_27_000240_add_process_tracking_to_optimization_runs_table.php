<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (! Schema::hasColumn('optimization_runs', 'process_pid')) {
                $table->integer('process_pid')->nullable()->after('search_exhaustive');
            }

            if (! Schema::hasColumn('optimization_runs', 'cancelled_at')) {
                $table->timestamp('cancelled_at')->nullable()->after('completed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('optimization_runs', function (Blueprint $table): void {
            if (Schema::hasColumn('optimization_runs', 'process_pid')) {
                $table->dropColumn('process_pid');
            }

            if (Schema::hasColumn('optimization_runs', 'cancelled_at')) {
                $table->dropColumn('cancelled_at');
            }
        });
    }
};
