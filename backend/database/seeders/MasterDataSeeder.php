<?php

namespace Database\Seeders;

use App\Models\OrgFunction;
use App\Models\Role;
use App\Models\Standard;
use Illuminate\Database\Seeder;

/**
 * Master data yang harus ada agar sistem bisa jalan sama sekali: peran,
 * fungsi/departemen, dan standar acuan. Memakai updateOrCreate supaya aman
 * dijalankan berulang di server produksi tanpa menggandakan atau menimpa
 * perubahan nama yang sudah dilakukan operator.
 */
class MasterDataSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            ['id' => 'requester', 'label' => 'Requester', 'summary' => 'Mengajukan permintaan pembuatan dokumen dari fungsi mana pun'],
            ['id' => 'drafter', 'label' => 'Document Drafter', 'summary' => 'Menyusun draf, mengelola rapat pembahasan'],
            ['id' => 'reviewer', 'label' => 'Reviewer', 'summary' => 'Meninjau dan memberi catatan pada draf dokumen'],
            ['id' => 'approver', 'label' => 'Approver', 'summary' => 'Menyetujui dokumen untuk dirilis'],
            ['id' => 'controller', 'label' => 'Document Controller', 'summary' => 'Mengelola register, status, dan records dokumen lintas fungsi'],
            ['id' => 'ratifier', 'label' => 'Ratifier', 'summary' => 'Mengesahkan dokumen final, memimpin tinjauan manajemen'],
            ['id' => 'function_head', 'label' => 'Function/Department Head', 'summary' => 'Mengawasi dokumen fungsinya, mengelola risiko dan temuan/CAPA'],
            ['id' => 'compliance_admin', 'label' => 'Compliance & Risk Admin', 'summary' => 'Mengelola compliance matrix, risiko, legal register, audit, temuan, dan records'],
            ['id' => 'sysadmin', 'label' => 'System Administrator', 'summary' => 'Mengelola pengguna, master data, dan konfigurasi sistem'],
            ['id' => 'auditor', 'label' => 'Auditor', 'summary' => 'Merencanakan dan melaksanakan audit, mencatat temuan, melihat audit trail'],
            ['id' => 'viewer', 'label' => 'Viewer', 'summary' => 'Melihat dokumen berstatus Released sesuai hak akses'],
        ];

        foreach ($roles as $i => $role) {
            Role::updateOrCreate(
                ['id' => $role['id']],
                ['label' => $role['label'], 'summary' => $role['summary'], 'sort_order' => $i],
            );
        }

        $functions = [
            'qa' => 'Quality Assurance',
            'hsse' => 'Health, Safety & Environment',
            'infosec' => 'Information Security',
            'hc' => 'Human Capital',
            'legal' => 'Legal & Compliance',
            'finance' => 'Finance',
            'procurement' => 'Procurement',
            'it' => 'Information Technology',
            'engineering' => 'Engineering',
            'ops' => 'Operations',
        ];

        foreach ($functions as $id => $name) {
            OrgFunction::updateOrCreate(['id' => $id], ['name' => $name]);
        }

        $standards = [
            'ISO9001' => 'ISO 9001 — Quality Management',
            'ISO14001' => 'ISO 14001 — Environmental Management',
            'ISO45001' => 'ISO 45001 — Occupational Health & Safety',
            'ISO27001' => 'ISO/IEC 27001 — Information Security',
            'ISO22301' => 'ISO 22301 — Business Continuity',
            'ISO37001' => 'ISO 37001 — Anti-Bribery',
            'ISO31000' => 'ISO 31000 — Risk Management',
            'ISO15489' => 'ISO 15489 — Records Management',
            'SMK3' => 'SMK3 (PP 50/2012)',
        ];

        foreach ($standards as $code => $name) {
            Standard::updateOrCreate(['code' => $code], ['name' => $name]);
        }
    }
}
