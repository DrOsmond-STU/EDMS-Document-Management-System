<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// CRUD lengkap: "hapus" di register-register sistem manajemen adalah soft
// delete — baris disembunyikan dari semua tampilan & perhitungan, tetapi
// tetap ada di database dan tercatat di Audit Trail (siapa, kapan, apa).
// Untuk users, deleted_at dipakai langsung (bukan trait SoftDeletes) supaya
// nama penyusun/penyetuju di riwayat lama tetap tampil.
return new class extends Migration
{
    private const TABLES = [
        'risks', 'risk_controls', 'record_series', 'records', 'legal_requirements', 'audits',
        'mgmt_reviews', 'mgmt_review_actions', 'findings', 'finding_actions', 'drafting_projects',
        'drafting_meetings', 'drafting_meeting_attendees', 'ai_generations', 'users',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $name) {
            if (! Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->softDeletes());
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $name) {
            if (Schema::hasColumn($name, 'deleted_at')) {
                Schema::table($name, fn (Blueprint $table) => $table->dropSoftDeletes());
            }
        }
    }
};
