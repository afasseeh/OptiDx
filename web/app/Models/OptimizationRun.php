<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OptimizationRun extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'constraints',
        'objectives',
        'candidate_count',
        'feasible_count',
        'heuristic_mode',
        'result_payload',
    ];

    protected function casts(): array
    {
        return [
            'constraints' => 'array',
            'objectives' => 'array',
            'heuristic_mode' => 'boolean',
            'result_payload' => 'array',
        ];
    }
}

