<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Document extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'legacy_id', 'code', 'title', 'type', 'function_id', 'classification',
        'status', 'validity', 'version', 'revision_number', 'effective_date',
        'review_date', 'expiry_date', 'keywords', 'content', 'owner_id', 'created_by',
    ];

    /**
     * display_validity dihitung, bukan disimpan: kolom `validity` hanya
     * berubah lewat DocumentLifecycle::transition() (berlaku/tidak_berlaku/
     * belum_berlaku sesuai status). "Kadaluarsa" bukan status yang pernah
     * di-set eksplisit — itu kondisi tinjauan ulang yang sudah lewat tanggal
     * pada dokumen yang MASIH released, jadi harus selalu dihitung ulang
     * terhadap tanggal hari ini, bukan disimpan sebagai nilai statis.
     */
    protected $appends = ['display_validity'];

    protected function casts(): array
    {
        return [
            'keywords' => 'array',
            'effective_date' => 'date',
            'review_date' => 'date',
            'expiry_date' => 'date',
            'revision_number' => 'integer',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function standards(): BelongsToMany
    {
        return $this->belongsToMany(Standard::class, 'document_standard', 'document_id', 'standard_code');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(DocumentRevision::class)->orderByDesc('revision_number');
    }

    public function files(): HasMany
    {
        return $this->hasMany(DocumentFile::class);
    }

    public function documentRelations(): HasMany
    {
        return $this->hasMany(DocumentRelation::class);
    }

    /** Berkas utama yang mewakili dokumen ini (yang diunduh orang). */
    public function primaryFile()
    {
        return $this->hasOne(DocumentFile::class)->where('is_primary', true);
    }

    public function getDisplayValidityAttribute(): string
    {
        if ($this->status === 'released' && $this->review_date && $this->review_date->isPast()) {
            return 'kadaluarsa';
        }

        return $this->validity;
    }

    public function scopeReleased($query)
    {
        return $query->where('status', 'released');
    }

    /** Dokumen berlaku yang jatuh tempo tinjauan sebelum tanggal tertentu. */
    public function scopeDueForReview($query, string $before)
    {
        return $query->where('status', 'released')
            ->whereNotNull('review_date')
            ->where('review_date', '<=', $before);
    }
}
