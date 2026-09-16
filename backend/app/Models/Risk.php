<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Risk extends Model
{
    protected $fillable = [
        'code', 'title', 'description', 'category', 'function_id', 'owner',
        'inherent_likelihood', 'inherent_impact', 'inherent_level',
        'residual_likelihood', 'residual_impact', 'residual_level',
        'treatment', 'treatment_plan', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'inherent_likelihood' => 'integer',
            'inherent_impact' => 'integer',
            'residual_likelihood' => 'integer',
            'residual_impact' => 'integer',
        ];
    }

    public function orgFunction(): BelongsTo
    {
        return $this->belongsTo(OrgFunction::class, 'function_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function standards(): BelongsToMany
    {
        return $this->belongsToMany(Standard::class, 'risk_standard', 'risk_id', 'standard_code');
    }

    public function controls(): HasMany
    {
        return $this->hasMany(RiskControl::class)->orderByDesc('created_at');
    }

    /**
     * Kode berurut sederhana (RISK-0001, RISK-0002, ...) — bukan dikonfigurasi
     * per jenis/fungsi seperti nomor dokumen, karena risiko bukan dokumen
     * terbit yang butuh penomoran formal per departemen.
     *
     * Dipanggil di dalam DB::transaction() oleh RiskController — lockForUpdate()
     * di sini hanya benar-benar mengunci baris selama transaksi itu berjalan,
     * sama seperti pola DocumentNumbering::nextCode(), supaya dua permintaan
     * bersamaan tidak pernah mendapat kode kembar.
     */
    public static function nextCode(): string
    {
        $last = static::orderByDesc('code')->lockForUpdate()->value('code');

        $next = 1;
        if ($last !== null && preg_match('/(\d+)$/', $last, $m)) {
            $next = ((int) $m[1]) + 1;
        }

        return 'RISK-'.str_pad((string) $next, 4, '0', STR_PAD_LEFT);
    }
}
