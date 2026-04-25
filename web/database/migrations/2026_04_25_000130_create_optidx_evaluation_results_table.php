<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('evaluation_results', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pathway_id')->constrained()->cascadeOnDelete();
            $table->decimal('prevalence', 8, 5)->nullable();
            $table->json('result_payload');
            $table->string('engine_version')->nullable();
            $table->string('evaluation_mode')->default('server');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('evaluation_results');
    }
};

