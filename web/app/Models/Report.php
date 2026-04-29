<?php

namespace App\Models;

use App\Models\Concerns\BelongsToAuthenticatedUser;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    use BelongsToAuthenticatedUser, HasFactory;

    protected $fillable = [
        'created_by',
        'project_id',
        'pathway_id',
        'optimization_run_id',
        'format',
        'html_path',
        'pdf_path',
        'json_path',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function pathway()
    {
        return $this->belongsTo(Pathway::class);
    }

    public function optimizationRun()
    {
        return $this->belongsTo(OptimizationRun::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
