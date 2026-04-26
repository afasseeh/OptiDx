<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAuthenticatedUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OptimizationRun extends Model
{
    use BelongsToAuthenticatedUser, HasFactory;

    protected $fillable = [
        'created_by',
        'project_id',
        'status',
        'input_payload',
        'constraints',
        'objectives',
        'candidate_count',
        'feasible_count',
        'heuristic_mode',
        'search_exhaustive',
        'started_at',
        'completed_at',
        'warnings',
        'failure_reason',
        'result_payload',
    ];

    protected function casts(): array
    {
        return [
            'input_payload' => 'array',
            'constraints' => 'array',
            'objectives' => 'array',
            'heuristic_mode' => 'boolean',
            'search_exhaustive' => 'boolean',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'warnings' => 'array',
            'result_payload' => 'array',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
