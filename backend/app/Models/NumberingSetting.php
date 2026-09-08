<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Formula penomoran dokumen — bisa diatur sendiri lewat halaman Pengaturan
 * Penomoran (masterdata.manage), bukan dikunci hardcode seperti sebelumnya.
 */
class NumberingSetting extends Model
{
    protected $fillable = ['format', 'seq_padding', 'type_codes', 'updated_by'];

    /** Kode singkat bawaan kalau belum diatur — sama seperti perilaku sebelum fitur ini ada. */
    public const DEFAULT_TYPE_CODES = [
        'Kebijakan' => 'KBJ',
        'Manual' => 'MAN',
        'SOP' => 'SOP',
        'Work Instruction' => 'WI',
        'Formulir' => 'FRM',
    ];

    public const DEFAULT_FORMAT = '{type}-{function}-{seq}';

    protected function casts(): array
    {
        return ['type_codes' => 'array', 'seq_padding' => 'integer'];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function current(): self
    {
        return static::firstOrCreate(['id' => 1], [
            'format' => self::DEFAULT_FORMAT,
            'seq_padding' => 3,
            'type_codes' => self::DEFAULT_TYPE_CODES,
        ]);
    }

    public function typeCode(string $type): string
    {
        return $this->type_codes[$type] ?? self::DEFAULT_TYPE_CODES[$type] ?? 'DOC';
    }
}
