<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

/**
 * Pengaturan perusahaan — selalu satu baris (id=1), mirip pola app_state di
 * purwarupa lama tapi khusus untuk identitas (nama & logo), bukan seluruh
 * data aplikasi.
 */
class CompanySetting extends Model
{
    protected $fillable = ['name', 'logo_original_name', 'logo_stored_path', 'logo_mime_type', 'updated_by'];

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], ['name' => 'DoGO']);
    }

    public function hasLogo(): bool
    {
        return $this->logo_stored_path !== null && Storage::disk('company')->exists($this->logo_stored_path);
    }
}
