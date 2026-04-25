<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiagnosticTest extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id',
        'name',
        'category',
        'sensitivity',
        'specificity',
        'cost',
        'currency',
        'turnaround_time',
        'turnaround_time_unit',
        'sample_types',
        'skill_level',
        'threshold',
        'availability',
        'capacity_limit',
        'notes',
        'provenance',
        'joint_probabilities',
        'conditional_probabilities',
    ];

    protected function casts(): array
    {
        return [
            'sensitivity' => 'decimal:5',
            'specificity' => 'decimal:5',
            'cost' => 'decimal:2',
            'turnaround_time' => 'decimal:3',
            'sample_types' => 'array',
            'availability' => 'boolean',
            'provenance' => 'array',
            'joint_probabilities' => 'array',
            'conditional_probabilities' => 'array',
        ];
    }
}

