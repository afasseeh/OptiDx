<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('optimization_runs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->json('constraints')->nullable();
            $table->json('objectives')->nullable();
            $table->unsignedInteger('candidate_count')->default(0);
            $table->unsignedInteger('feasible_count')->default(0);
            $table->boolean('heuristic_mode')->default(false);
            $table->json('result_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('optimization_runs');
    }
};

