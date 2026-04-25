<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BenchmarkCase extends Model
{
    use HasFactory;

    protected $fillable = [
        'slug',
        'title',
        'disease_area',
        'citation',
        'expected_metrics',
        'pathway_payload',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'expected_metrics' => 'array',
            'pathway_payload' => 'array',
        ];
    }
}

