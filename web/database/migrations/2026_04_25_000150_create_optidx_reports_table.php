<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('pathway_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('optimization_run_id')->nullable()->constrained()->nullOnDelete();
            $table->string('format')->default('html');
            $table->string('html_path')->nullable();
            $table->string('pdf_path')->nullable();
            $table->string('json_path')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};

