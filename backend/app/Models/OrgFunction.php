<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OrgFunction extends Model
{
    protected $table = 'org_functions';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = ['id', 'name', 'active'];

    protected function casts(): array
    {
        return ['active' => 'boolean'];
    }

    public function documents(): HasMany
    {
        return $this->hasMany(Document::class, 'function_id');
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'function_id');
    }
}
