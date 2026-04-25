<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('diagnostic_tests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->string('category')->nullable();
            $table->decimal('sensitivity', 8, 5);
            $table->decimal('specificity', 8, 5);
            $table->decimal('cost', 12, 2)->nullable();
            $table->string('currency', 8)->nullable();
            $table->decimal('turnaround_time', 12, 3)->nullable();
            $table->string('turnaround_time_unit', 16)->nullable();
            $table->json('sample_types')->nullable();
            $table->unsignedTinyInteger('skill_level')->nullable();
            $table->string('threshold')->nullable();
            $table->boolean('availability')->default(true);
            $table->unsignedInteger('capacity_limit')->nullable();
            $table->text('notes')->nullable();
            $table->json('provenance')->nullable();
            $table->json('joint_probabilities')->nullable();
            $table->json('conditional_probabilities')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diagnostic_tests');
    }
};

