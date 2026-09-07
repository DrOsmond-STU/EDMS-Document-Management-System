<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class DocumentFile extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'document_id', 'document_revision_id', 'original_name', 'disk', 'stored_path',
        'mime_type', 'size_bytes', 'checksum_sha256', 'is_primary', 'uploaded_by', 'uploaded_by_name',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'is_primary' => 'boolean',
        ];
    }

    // stored_path menunjuk ke disk privat; jangan pernah dikirim ke browser.
    protected $hidden = ['stored_path', 'disk'];

    public function document(): BelongsTo
    {
        return $this->belongsTo(Document::class);
    }

    public function revision(): BelongsTo
    {
        return $this->belongsTo(DocumentRevision::class, 'document_revision_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    /** Isi berkas sebagai stream — dipakai controller unduh setelah cek izin. */
    public function readStream()
    {
        return Storage::disk($this->disk)->readStream($this->stored_path);
    }

    public function exists(): bool
    {
        return Storage::disk($this->disk)->exists($this->stored_path);
    }

    /** Membuktikan berkas di disk masih sama dengan saat diunggah. */
    public function verifyChecksum(): bool
    {
        if (! $this->exists()) {
            return false;
        }

        return hash('sha256', Storage::disk($this->disk)->get($this->stored_path)) === $this->checksum_sha256;
    }

    public function getSizeForHumansAttribute(): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $size = (float) $this->size_bytes;
        $i = 0;
        while ($size >= 1024 && $i < count($units) - 1) {
            $size /= 1024;
            $i++;
        }

        return round($size, $i === 0 ? 0 : 1).' '.$units[$i];
    }
}
