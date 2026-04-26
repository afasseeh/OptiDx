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
        'run_mode',
        'status',
        'progress_percent',
        'progress_stage',
        'progress_message',
        'progress_payload',
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
            'run_mode' => 'string',
            'input_payload' => 'array',
            'constraints' => 'array',
            'objectives' => 'array',
            'progress_percent' => 'integer',
            'progress_payload' => 'array',
            'heuristic_mode' => 'boolean',
            'search_exhaustive' => 'boolean',
            'started_at' => 'datetime',
            'completed_at' => 'datetime',
            'notified_at' => 'datetime',
            'warnings' => 'array',
            'result_payload' => 'array',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
