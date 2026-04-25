<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pathways', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');
            $table->unsignedInteger('version')->default(1);
            $table->string('schema_version')->nullable();
            $table->string('start_node_id')->nullable();
            $table->json('editor_definition');
            $table->json('engine_definition')->nullable();
            $table->string('validation_status')->default('draft');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pathways');
    }
};

