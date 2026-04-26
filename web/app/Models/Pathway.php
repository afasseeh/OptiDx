<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAuthenticatedUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Pathway extends Model
{
    use BelongsToAuthenticatedUser, HasFactory;

    protected $fillable = [
        'created_by',
        'project_id',
        'name',
        'version',
        'schema_version',
        'start_node_id',
        'editor_definition',
        'engine_definition',
        'validation_status',
        'notes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'version' => 'integer',
            'editor_definition' => 'array',
            'engine_definition' => 'array',
            'metadata' => 'array',
        ];
    }

    public function evaluationResults()
    {
        return $this->hasMany(EvaluationResult::class);
    }

    public function latestEvaluationResult()
    {
        return $this->hasOne(EvaluationResult::class)->latestOfMany();
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
