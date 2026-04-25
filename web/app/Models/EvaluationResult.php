<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EvaluationResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'pathway_id',
        'prevalence',
        'result_payload',
        'engine_version',
        'evaluation_mode',
    ];

    protected function casts(): array
    {
        return [
            'prevalence' => 'decimal:5',
            'result_payload' => 'array',
        ];
    }
}

