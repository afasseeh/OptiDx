<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    use HasFactory;

    protected $fillable = ['scope', 'key', 'value'];

    protected function casts(): array
    {
        return [
            'value' => 'array',
        ];
    }
}

