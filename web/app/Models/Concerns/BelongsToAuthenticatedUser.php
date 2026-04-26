<?php

namespace App\Models\Concerns;

use Illuminate\Database\Eloquent\Builder;

trait BelongsToAuthenticatedUser
{
    /**
     * Scope workspace records to the signed-in account and stamp ownership
     * on create so every saved row stays attached to the user that created it.
     */
    protected static function bootBelongsToAuthenticatedUser(): void
    {
        static::addGlobalScope('authenticated_user_workspace', function (Builder $builder): void {
            if (! auth()->check()) {
                return;
            }

            $builder->where($builder->getModel()->getTable() . '.created_by', auth()->id());
        });

        static::creating(function ($model): void {
            if (auth()->check() && empty($model->created_by)) {
                $model->created_by = auth()->id();
            }
        });
    }
}
