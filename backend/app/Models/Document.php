<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Support\Permissions;

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

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(DocumentCategory::class, 'document_category', 'document_id', 'category_id');
    }

    public function folders(): BelongsToMany
    {
        return $this->belongsToMany(DocumentFolder::class, 'document_folder_items', 'document_id', 'folder_id');
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

    /**
     * Status yang PERNAH resmi dirilis — berkas utamanya wajib PDF (lihat
     * DocumentLifecycle::assertReadyForRelease) dan karena itu wajib
     * ditempeli watermark "uncontrolled copy" saat dilihat/diunduh siapa
     * pun selain Document Controller (lihat DocumentFileController).
     */
    public const CONTROLLED_STATUSES = ['released', 'frozen', 'revoked', 'obsolete'];

    public function isControlled(): bool
    {
        return in_array($this->status, self::CONTROLLED_STATUSES, true);
    }

    public function getDisplayValidityAttribute(): string
    {
        if ($this->status === 'released' && $this->review_date && $this->review_date->isPast()) {
            return 'kadaluarsa';
        }

        // $appends berlaku untuk SETIAP instance model ini, termasuk yang
        // dimuat lewat select kolom terbatas (mis. documentRelations.target
        // yang sengaja hanya memilih id,code,title,status,validity) — kalau
        // suatu saat ada pemuatan yang lupa menyertakan validity, jangan
        // sampai seluruh respons API gagal karena TypeError.
        return $this->validity ?? '';
    }

    /** Peran yang terlibat siklus dokumen boleh melihat semua status; selainnya hanya Released. */
    public const LIFECYCLE_PERMISSIONS = [
        Permissions::DOCUMENT_DRAFT, Permissions::DOCUMENT_REVIEW,
        Permissions::DOCUMENT_APPROVE, Permissions::DOCUMENT_CONTROL,
        Permissions::DOCUMENT_RATIFY, Permissions::AUDIT_VIEW,
    ];

    /**
     * Aturan visibilitas yang sama dengan daftar Register Dokumen
     * (DocumentController::index) — dipakai modul lain yang ikut
     * menampilkan dokumen (folder virtual, pencarian, diskusi) supaya
     * tidak ada jalur samping untuk melihat draft yang bukan haknya.
     */
    public function scopeVisibleTo($query, User $user)
    {
        // Klasifikasi selalu berlaku — juga bagi peran yang terlibat siklus dokumen.
        $query->classifiedFor($user);

        foreach (self::LIFECYCLE_PERMISSIONS as $permission) {
            if ($user->hasPermission($permission)) {
                return $query;
            }
        }

        // Tanpa hak lihat dokumen terbit pun, tidak ada yang boleh terlihat —
        // selaras dengan DocumentPolicy::view().
        if (! $user->hasPermission(Permissions::DOCUMENT_VIEW_RELEASED)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->where('status', 'released');
    }

    /**
     * Saring berdasarkan izin klasifikasi pengguna (Permissions::ROLE_CLEARANCE):
     * tingkat peran, +1 tingkat untuk dokumen fungsinya sendiri, dan pemilik/
     * pembuat selalu boleh melihat dokumennya.
     */
    public function scopeClassifiedFor($query, User $user)
    {
        $roleIds = $user->roleIds();
        $general = Permissions::classificationsUpTo(Permissions::clearanceFor($roleIds));
        $ownFunction = Permissions::classificationsUpTo(Permissions::clearanceFor($roleIds, ownFunction: true));

        return $query->where(function ($q) use ($user, $general, $ownFunction) {
            $q->whereIn('classification', $general)
                ->orWhere('owner_id', $user->id)
                ->orWhere('created_by', $user->id);
            if ($user->function_id) {
                $q->orWhere(fn ($w) => $w->where('function_id', $user->function_id)->whereIn('classification', $ownFunction));
            }
        });
    }

    /** Versi satu-dokumen dari scopeClassifiedFor — dipakai DocumentPolicy. */
    public function classificationAllows(User $user): bool
    {
        if (($this->owner_id !== null && (int) $this->owner_id === (int) $user->id)
            || ($this->created_by !== null && (int) $this->created_by === (int) $user->id)) {
            return true;
        }
        $level = Permissions::CLASSIFICATION_LEVELS[$this->classification] ?? Permissions::CLASSIFICATION_LEVELS['top_secret'];
        $own = $user->function_id !== null && $user->function_id === $this->function_id;

        return $level <= Permissions::clearanceFor($user->roleIds(), ownFunction: $own);
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
