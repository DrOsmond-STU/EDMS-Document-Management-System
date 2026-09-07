<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class Role extends Model
{
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['id', 'label', 'summary', 'sort_order'];

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }
}
