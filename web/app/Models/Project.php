<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAuthenticatedUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    use BelongsToAuthenticatedUser, HasFactory;

    protected $fillable = [
        'created_by',
        'title',
        'disease_area',
        'intended_use',
        'target_population',
        'prevalence',
        'country',
        'setting',
        'notes',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'prevalence' => 'decimal:5',
            'metadata' => 'array',
        ];
    }

    public function pathways()
    {
        return $this->hasMany(Pathway::class);
    }

    public function diagnosticTests()
    {
        return $this->hasMany(DiagnosticTest::class);
    }
}
