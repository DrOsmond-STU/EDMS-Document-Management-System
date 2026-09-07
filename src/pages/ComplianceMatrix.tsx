import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { AlertTriangle, CheckCircle2, MinusCircle, Plus, XCircle } from 'lucide-react'
import { Button, Card, Field, PageHeader, SectionTitle, inputClass } from '../components/ui'
import { useApp } from '../state/AppContext'
import { rolesHavePermission } from '../state/permissions'
import type { GapFollowUp, GapFollowUpStatus, GapFollowUpType } from '../types'

type Standard = 'ISO9001' | 'ISO14001' | 'ISO45001' | 'SMK3' | 'ISO27001' | 'ISO22301' | 'ISO37001'
type CoverageStatus = 'compliant' | 'partial' | 'gap' | 'na'

const STANDARDS: { key: Standard; label: string }[] = [
  { key: 'ISO9001', label: 'ISO 9001:2015 — Sistem Manajemen Mutu' },
  { key: 'ISO14001', label: 'ISO 14001:2015 — Sistem Manajemen Lingkungan' },
  { key: 'ISO45001', label: 'ISO 45001:2018 — Sistem Manajemen K3' },
  { key: 'SMK3', label: 'PP 50/2012 — SMK3' },
  { key: 'ISO27001', label: 'ISO 27001:2022 — Keamanan Informasi' },
  { key: 'ISO22301', label: 'ISO 22301:2019 — Business Continuity' },
  { key: 'ISO37001', label: 'ISO 37001:2016 — Anti Penyuapan' },
]

type Clause = { id: string; standard: Standard; code: string; title: string }

// Struktur klausul lengkap tiap standar (bukan sampel). ISO 9001/14001/45001/
// 27001/22301/37001 mengikuti struktur Annex SL (klausul 4-10, plus Lampiran
// A untuk 27001); SMK3 mengikuti 5 Prinsip Dasar PP 50/2012.
const CLAUSES: Clause[] = [
  { id: 'k1', standard: 'ISO9001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k16', standard: 'ISO9001', code: '4.2', title: 'Kebutuhan & Ekspektasi Pihak Berkepentingan' },
  { id: 'k17', standard: 'ISO9001', code: '4.3', title: 'Penetapan Ruang Lingkup SMM' },
  { id: 'k18', standard: 'ISO9001', code: '4.4', title: 'SMM dan Proses-prosesnya' },
  { id: 'k19', standard: 'ISO9001', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k2', standard: 'ISO9001', code: '5.2', title: 'Kebijakan Mutu' },
  { id: 'k20', standard: 'ISO9001', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k3', standard: 'ISO9001', code: '6.1', title: 'Tindakan Menangani Risiko & Peluang' },
  { id: 'k21', standard: 'ISO9001', code: '6.2', title: 'Sasaran Mutu dan Perencanaan Pencapaiannya' },
  { id: 'k22', standard: 'ISO9001', code: '6.3', title: 'Perencanaan Perubahan' },
  { id: 'k23', standard: 'ISO9001', code: '7.1', title: 'Sumber Daya' },
  { id: 'k24', standard: 'ISO9001', code: '7.2', title: 'Kompetensi' },
  { id: 'k25', standard: 'ISO9001', code: '7.3', title: 'Kepedulian' },
  { id: 'k26', standard: 'ISO9001', code: '7.4', title: 'Komunikasi' },
  { id: 'k4', standard: 'ISO9001', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k27', standard: 'ISO9001', code: '8.1', title: 'Perencanaan & Pengendalian Operasional' },
  { id: 'k28', standard: 'ISO9001', code: '8.2', title: 'Persyaratan Produk dan Jasa' },
  { id: 'k29', standard: 'ISO9001', code: '8.3', title: 'Desain dan Pengembangan' },
  { id: 'k30', standard: 'ISO9001', code: '8.4', title: 'Pengendalian Proses/Produk/Jasa dari Pihak Eksternal' },
  { id: 'k31', standard: 'ISO9001', code: '8.5', title: 'Produksi dan Penyediaan Jasa' },
  { id: 'k32', standard: 'ISO9001', code: '8.6', title: 'Pelepasan Produk dan Jasa' },
  { id: 'k33', standard: 'ISO9001', code: '8.7', title: 'Pengendalian Output Tidak Sesuai' },
  { id: 'k34', standard: 'ISO9001', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi' },
  { id: 'k5', standard: 'ISO9001', code: '9.2', title: 'Audit Internal' },
  { id: 'k35', standard: 'ISO9001', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k36', standard: 'ISO9001', code: '10.1', title: 'Umum (Peningkatan)' },
  { id: 'k37', standard: 'ISO9001', code: '10.2', title: 'Ketidaksesuaian dan Tindakan Korektif' },
  { id: 'k38', standard: 'ISO9001', code: '10.3', title: 'Peningkatan Berkelanjutan' },
  { id: 'k39', standard: 'ISO14001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k40', standard: 'ISO14001', code: '4.2', title: 'Kebutuhan & Ekspektasi Pihak Berkepentingan' },
  { id: 'k41', standard: 'ISO14001', code: '4.3', title: 'Ruang Lingkup SML' },
  { id: 'k42', standard: 'ISO14001', code: '4.4', title: 'Sistem Manajemen Lingkungan' },
  { id: 'k43', standard: 'ISO14001', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k44', standard: 'ISO14001', code: '5.2', title: 'Kebijakan Lingkungan' },
  { id: 'k45', standard: 'ISO14001', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k46', standard: 'ISO14001', code: '6.1.1', title: 'Umum (Tindakan Risiko & Peluang)' },
  { id: 'k6', standard: 'ISO14001', code: '6.1.2', title: 'Aspek Lingkungan' },
  { id: 'k47', standard: 'ISO14001', code: '6.1.3', title: 'Kewajiban Kepatuhan' },
  { id: 'k48', standard: 'ISO14001', code: '6.1.4', title: 'Perencanaan Tindakan' },
  { id: 'k49', standard: 'ISO14001', code: '6.2', title: 'Sasaran Lingkungan dan Perencanaan Pencapaiannya' },
  { id: 'k50', standard: 'ISO14001', code: '7.1', title: 'Sumber Daya' },
  { id: 'k51', standard: 'ISO14001', code: '7.2', title: 'Kompetensi' },
  { id: 'k52', standard: 'ISO14001', code: '7.3', title: 'Kepedulian' },
  { id: 'k53', standard: 'ISO14001', code: '7.4', title: 'Komunikasi' },
  { id: 'k54', standard: 'ISO14001', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k55', standard: 'ISO14001', code: '8.1', title: 'Perencanaan & Pengendalian Operasional' },
  { id: 'k7', standard: 'ISO14001', code: '8.2', title: 'Kesiapan & Tanggap Darurat' },
  { id: 'k56', standard: 'ISO14001', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi' },
  { id: 'k57', standard: 'ISO14001', code: '9.2', title: 'Audit Internal' },
  { id: 'k58', standard: 'ISO14001', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k59', standard: 'ISO14001', code: '10.1', title: 'Umum (Peningkatan)' },
  { id: 'k60', standard: 'ISO14001', code: '10.2', title: 'Ketidaksesuaian dan Tindakan Korektif' },
  { id: 'k61', standard: 'ISO14001', code: '10.3', title: 'Peningkatan Berkelanjutan' },
  { id: 'k62', standard: 'ISO45001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k63', standard: 'ISO45001', code: '4.2', title: 'Kebutuhan & Ekspektasi Pekerja & Pihak Berkepentingan' },
  { id: 'k64', standard: 'ISO45001', code: '4.3', title: 'Ruang Lingkup SM K3' },
  { id: 'k65', standard: 'ISO45001', code: '4.4', title: 'Sistem Manajemen K3' },
  { id: 'k66', standard: 'ISO45001', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k67', standard: 'ISO45001', code: '5.2', title: 'Kebijakan K3' },
  { id: 'k68', standard: 'ISO45001', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k69', standard: 'ISO45001', code: '5.4', title: 'Konsultasi dan Partisipasi Pekerja' },
  { id: 'k70', standard: 'ISO45001', code: '6.1.1', title: 'Umum (Tindakan Risiko & Peluang)' },
  { id: 'k8', standard: 'ISO45001', code: '6.1.2', title: 'Identifikasi Bahaya & Penilaian Risiko K3' },
  { id: 'k71', standard: 'ISO45001', code: '6.1.3', title: 'Penentuan Persyaratan Hukum & Lainnya' },
  { id: 'k72', standard: 'ISO45001', code: '6.1.4', title: 'Perencanaan Tindakan' },
  { id: 'k73', standard: 'ISO45001', code: '6.2', title: 'Sasaran K3 dan Perencanaan Pencapaiannya' },
  { id: 'k74', standard: 'ISO45001', code: '7.1', title: 'Sumber Daya' },
  { id: 'k75', standard: 'ISO45001', code: '7.2', title: 'Kompetensi' },
  { id: 'k76', standard: 'ISO45001', code: '7.3', title: 'Kepedulian' },
  { id: 'k9', standard: 'ISO45001', code: '7.4', title: 'Komunikasi K3' },
  { id: 'k77', standard: 'ISO45001', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k78', standard: 'ISO45001', code: '8.1.1', title: 'Umum (Perencanaan & Pengendalian Operasional)' },
  { id: 'k79', standard: 'ISO45001', code: '8.1.2', title: 'Eliminasi Bahaya & Penurunan Risiko K3' },
  { id: 'k80', standard: 'ISO45001', code: '8.1.3', title: 'Manajemen Perubahan' },
  { id: 'k81', standard: 'ISO45001', code: '8.1.4', title: 'Pengadaan (Procurement)' },
  { id: 'k82', standard: 'ISO45001', code: '8.2', title: 'Kesiapan & Tanggap Darurat' },
  { id: 'k83', standard: 'ISO45001', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi Kinerja' },
  { id: 'k84', standard: 'ISO45001', code: '9.2', title: 'Audit Internal' },
  { id: 'k85', standard: 'ISO45001', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k86', standard: 'ISO45001', code: '10.1', title: 'Umum (Peningkatan)' },
  { id: 'k10', standard: 'ISO45001', code: '10.2', title: 'Investigasi Insiden' },
  { id: 'k87', standard: 'ISO45001', code: '10.3', title: 'Peningkatan Berkelanjutan' },
  { id: 'k11', standard: 'SMK3', code: 'I', title: 'Penetapan Kebijakan K3' },
  { id: 'k88', standard: 'SMK3', code: 'II', title: 'Perencanaan K3' },
  { id: 'k89', standard: 'SMK3', code: 'III', title: 'Pelaksanaan Rencana K3' },
  { id: 'k90', standard: 'SMK3', code: 'IV', title: 'Pemantauan dan Evaluasi Kinerja K3' },
  { id: 'k91', standard: 'SMK3', code: 'V', title: 'Peninjauan dan Peningkatan Kinerja SMK3' },
  { id: 'k92', standard: 'ISO27001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k93', standard: 'ISO27001', code: '4.2', title: 'Kebutuhan & Ekspektasi Pihak Berkepentingan' },
  { id: 'k94', standard: 'ISO27001', code: '4.3', title: 'Ruang Lingkup SMKI' },
  { id: 'k95', standard: 'ISO27001', code: '4.4', title: 'Sistem Manajemen Keamanan Informasi' },
  { id: 'k96', standard: 'ISO27001', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k97', standard: 'ISO27001', code: '5.2', title: 'Kebijakan' },
  { id: 'k98', standard: 'ISO27001', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k99', standard: 'ISO27001', code: '6.1.1', title: 'Umum (Tindakan Risiko & Peluang)' },
  { id: 'k100', standard: 'ISO27001', code: '6.1.2', title: 'Penilaian Risiko Keamanan Informasi' },
  { id: 'k101', standard: 'ISO27001', code: '6.1.3', title: 'Penanganan Risiko Keamanan Informasi' },
  { id: 'k102', standard: 'ISO27001', code: '6.2', title: 'Sasaran Keamanan Informasi' },
  { id: 'k103', standard: 'ISO27001', code: '6.3', title: 'Perencanaan Perubahan' },
  { id: 'k104', standard: 'ISO27001', code: '7.1', title: 'Sumber Daya' },
  { id: 'k105', standard: 'ISO27001', code: '7.2', title: 'Kompetensi' },
  { id: 'k106', standard: 'ISO27001', code: '7.3', title: 'Kepedulian' },
  { id: 'k107', standard: 'ISO27001', code: '7.4', title: 'Komunikasi' },
  { id: 'k108', standard: 'ISO27001', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k109', standard: 'ISO27001', code: '8.1', title: 'Perencanaan & Pengendalian Operasional' },
  { id: 'k110', standard: 'ISO27001', code: '8.2', title: 'Penilaian Risiko Keamanan Informasi (Operasional)' },
  { id: 'k111', standard: 'ISO27001', code: '8.3', title: 'Penanganan Risiko Keamanan Informasi (Operasional)' },
  { id: 'k112', standard: 'ISO27001', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi' },
  { id: 'k113', standard: 'ISO27001', code: '9.2', title: 'Audit Internal' },
  { id: 'k114', standard: 'ISO27001', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k115', standard: 'ISO27001', code: '10.1', title: 'Peningkatan Berkelanjutan' },
  { id: 'k116', standard: 'ISO27001', code: '10.2', title: 'Ketidaksesuaian dan Tindakan Korektif' },
  { id: 'k12', standard: 'ISO27001', code: 'A.5.1', title: 'Kebijakan Keamanan Informasi' },
  { id: 'k117', standard: 'ISO27001', code: 'A.5.9', title: 'Inventarisasi Informasi & Aset Terkait' },
  { id: 'k118', standard: 'ISO27001', code: 'A.5.15', title: 'Kontrol Akses' },
  { id: 'k119', standard: 'ISO27001', code: 'A.5.23', title: 'Keamanan Informasi untuk Layanan Cloud' },
  { id: 'k120', standard: 'ISO27001', code: 'A.6.3', title: 'Kepedulian, Edukasi & Pelatihan Keamanan Informasi' },
  { id: 'k121', standard: 'ISO27001', code: 'A.7.1', title: 'Perimeter Keamanan Fisik' },
  { id: 'k122', standard: 'ISO27001', code: 'A.8.1', title: 'Perangkat Endpoint Pengguna' },
  { id: 'k13', standard: 'ISO27001', code: 'A.8.9', title: 'Manajemen Konfigurasi' },
  { id: 'k123', standard: 'ISO27001', code: 'A.8.16', title: 'Aktivitas Pemantauan' },
  { id: 'k124', standard: 'ISO27001', code: 'A.8.24', title: 'Penggunaan Kriptografi' },
  { id: 'k125', standard: 'ISO22301', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k126', standard: 'ISO22301', code: '4.2', title: 'Kebutuhan & Ekspektasi Pihak Berkepentingan' },
  { id: 'k127', standard: 'ISO22301', code: '4.3', title: 'Ruang Lingkup SMKB' },
  { id: 'k128', standard: 'ISO22301', code: '4.4', title: 'Sistem Manajemen Keberlangsungan Bisnis' },
  { id: 'k129', standard: 'ISO22301', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k130', standard: 'ISO22301', code: '5.2', title: 'Kebijakan' },
  { id: 'k131', standard: 'ISO22301', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k132', standard: 'ISO22301', code: '6.1', title: 'Tindakan Menangani Risiko & Peluang' },
  { id: 'k133', standard: 'ISO22301', code: '6.2', title: 'Sasaran Keberlangsungan Bisnis' },
  { id: 'k134', standard: 'ISO22301', code: '6.3', title: 'Perencanaan Perubahan' },
  { id: 'k135', standard: 'ISO22301', code: '7.1', title: 'Sumber Daya' },
  { id: 'k136', standard: 'ISO22301', code: '7.2', title: 'Kompetensi' },
  { id: 'k137', standard: 'ISO22301', code: '7.3', title: 'Kepedulian' },
  { id: 'k138', standard: 'ISO22301', code: '7.4', title: 'Komunikasi' },
  { id: 'k139', standard: 'ISO22301', code: '7.5', title: 'Informasi Terdokumentasi' },
  { id: 'k140', standard: 'ISO22301', code: '8.1', title: 'Perencanaan & Pengendalian Operasional' },
  { id: 'k14', standard: 'ISO22301', code: '8.2', title: 'Business Impact Analysis' },
  { id: 'k141', standard: 'ISO22301', code: '8.3', title: 'Strategi & Solusi Keberlangsungan Bisnis' },
  { id: 'k142', standard: 'ISO22301', code: '8.4', title: 'Rencana & Prosedur Keberlangsungan Bisnis' },
  { id: 'k143', standard: 'ISO22301', code: '8.5', title: 'Program Latihan (Exercise)' },
  { id: 'k144', standard: 'ISO22301', code: '8.6', title: 'Evaluasi Dokumentasi & Kapabilitas Keberlangsungan Bisnis' },
  { id: 'k145', standard: 'ISO22301', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi' },
  { id: 'k146', standard: 'ISO22301', code: '9.2', title: 'Audit Internal' },
  { id: 'k147', standard: 'ISO22301', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k148', standard: 'ISO22301', code: '10.1', title: 'Peningkatan Berkelanjutan' },
  { id: 'k149', standard: 'ISO22301', code: '10.2', title: 'Ketidaksesuaian dan Tindakan Korektif' },
  { id: 'k150', standard: 'ISO37001', code: '4.1', title: 'Konteks Organisasi' },
  { id: 'k151', standard: 'ISO37001', code: '4.2', title: 'Kebutuhan & Ekspektasi Pihak Berkepentingan' },
  { id: 'k152', standard: 'ISO37001', code: '4.3', title: 'Ruang Lingkup SMAP' },
  { id: 'k153', standard: 'ISO37001', code: '4.4', title: 'Sistem Manajemen Anti Penyuapan' },
  { id: 'k154', standard: 'ISO37001', code: '4.5', title: 'Penilaian Risiko Penyuapan' },
  { id: 'k155', standard: 'ISO37001', code: '5.1', title: 'Kepemimpinan dan Komitmen' },
  { id: 'k15', standard: 'ISO37001', code: '5.2', title: 'Kebijakan Anti Penyuapan' },
  { id: 'k156', standard: 'ISO37001', code: '5.3', title: 'Peran, Tanggung Jawab & Wewenang Organisasi' },
  { id: 'k157', standard: 'ISO37001', code: '5.4', title: 'Badan Pengelola (Governing Body)' },
  { id: 'k158', standard: 'ISO37001', code: '5.5', title: 'Manajemen Puncak' },
  { id: 'k159', standard: 'ISO37001', code: '6.1', title: 'Tindakan Menangani Risiko & Peluang' },
  { id: 'k160', standard: 'ISO37001', code: '6.2', title: 'Sasaran Anti Penyuapan' },
  { id: 'k161', standard: 'ISO37001', code: '7.1', title: 'Sumber Daya' },
  { id: 'k162', standard: 'ISO37001', code: '7.2', title: 'Kompetensi' },
  { id: 'k163', standard: 'ISO37001', code: '7.3', title: 'Pelatihan' },
  { id: 'k164', standard: 'ISO37001', code: '7.4', title: 'Kepedulian' },
  { id: 'k165', standard: 'ISO37001', code: '7.5', title: 'Komunikasi' },
  { id: 'k166', standard: 'ISO37001', code: '7.6', title: 'Informasi Terdokumentasi' },
  { id: 'k167', standard: 'ISO37001', code: '8.1', title: 'Perencanaan & Pengendalian Operasional' },
  { id: 'k168', standard: 'ISO37001', code: '8.2', title: 'Uji Kelayakan (Due Diligence)' },
  { id: 'k169', standard: 'ISO37001', code: '8.3', title: 'Kontrol Keuangan' },
  { id: 'k170', standard: 'ISO37001', code: '8.4', title: 'Kontrol Non-Keuangan' },
  { id: 'k171', standard: 'ISO37001', code: '8.5', title: 'Penerapan Kontrol Anti Penyuapan pada Mitra & Rekanan Bisnis' },
  { id: 'k172', standard: 'ISO37001', code: '8.6', title: 'Komitmen Anti Penyuapan' },
  { id: 'k173', standard: 'ISO37001', code: '8.7', title: 'Hadiah, Jamuan, Donasi & Manfaat Serupa' },
  { id: 'k174', standard: 'ISO37001', code: '8.8', title: 'Penanganan Ketidakcukupan Kontrol Anti Penyuapan' },
  { id: 'k175', standard: 'ISO37001', code: '8.9', title: 'Pelaporan Kekhawatiran (Whistleblowing)' },
  { id: 'k176', standard: 'ISO37001', code: '8.10', title: 'Investigasi & Penanganan Penyuapan' },
  { id: 'k177', standard: 'ISO37001', code: '9.1', title: 'Pemantauan, Pengukuran, Analisis & Evaluasi' },
  { id: 'k178', standard: 'ISO37001', code: '9.2', title: 'Audit Internal' },
  { id: 'k179', standard: 'ISO37001', code: '9.3', title: 'Tinjauan Manajemen' },
  { id: 'k180', standard: 'ISO37001', code: '9.4', title: 'Tinjauan oleh Fungsi Kepatuhan Anti Penyuapan' },
  { id: 'k181', standard: 'ISO37001', code: '10.1', title: 'Ketidaksesuaian dan Tindakan Korektif' },
  { id: 'k182', standard: 'ISO37001', code: '10.2', title: 'Peningkatan Berkelanjutan' },
]

const DOCUMENTS = [
  { id: 'dc1', code: 'MM-01', title: 'Manual Mutu Terintegrasi' },
  { id: 'dc2', code: 'KEB-001', title: 'Kebijakan Mutu, K3, Lingkungan' },
  { id: 'dc3', code: 'SOP-QMS-002', title: 'SOP Pengendalian Dokumen' },
  { id: 'dc4', code: 'SOP-QMS-004', title: 'SOP Audit Internal' },
  { id: 'dc5', code: 'SOP-HSE-001', title: 'SOP Investigasi Kecelakaan' },
  { id: 'dc6', code: 'SOP-HSE-006', title: 'SOP JSA & HIRADC' },
  { id: 'dc7', code: 'SOP-IT-010', title: 'SOP Keamanan Informasi' },
  { id: 'dc8', code: 'KEB-005', title: 'Kebijakan Anti Penyuapan' },
]

// Coverage matrix keyed by `${clauseId}:${docId}`
const COVERAGE: Record<string, CoverageStatus> = {
  'k1:dc1': 'compliant', 'k1:dc2': 'partial',
  'k2:dc1': 'compliant', 'k2:dc2': 'compliant',
  'k3:dc1': 'partial', 'k3:dc3': 'compliant',
  'k4:dc3': 'compliant', 'k4:dc1': 'compliant',
  'k5:dc4': 'compliant', 'k5:dc1': 'partial',
  'k6:dc1': 'partial', 'k6:dc6': 'gap',
  'k7:dc5': 'compliant', 'k7:dc6': 'partial',
  'k8:dc6': 'compliant', 'k8:dc5': 'partial',
  'k9:dc6': 'partial', 'k9:dc2': 'compliant',
  'k10:dc5': 'compliant',
  'k11:dc2': 'compliant', 'k11:dc6': 'partial',
  'k12:dc7': 'compliant', 'k12:dc2': 'partial',
  'k13:dc7': 'partial',
  'k14:dc1': 'gap', 'k14:dc7': 'gap',
  'k15:dc8': 'compliant', 'k15:dc2': 'compliant',
  // Klausul tambahan (lihat komentar di atas CLAUSES) — sebagian sengaja
  // dibiarkan tanpa entri di sini (artinya "Belum Dinilai") karena belum ada
  // dokumen di DOCUMENTS yang relevan, sama seperti gap analysis sungguhan.
  'k16:dc1': 'partial',
  'k17:dc1': 'partial',
  'k18:dc1': 'partial',
  'k19:dc1': 'partial',
  'k20:dc1': 'partial',
  'k39:dc1': 'partial',
  'k40:dc1': 'partial',
  'k41:dc1': 'partial',
  'k42:dc1': 'partial',
  'k43:dc1': 'partial',
  'k44:dc2': 'compliant',
  'k45:dc1': 'partial',
  'k46:dc6': 'gap',
  'k47:dc6': 'gap',
  'k48:dc6': 'gap',
  'k54:dc3': 'compliant',
  'k57:dc4': 'compliant',
  'k62:dc1': 'partial',
  'k63:dc1': 'partial',
  'k64:dc1': 'partial',
  'k65:dc1': 'partial',
  'k66:dc1': 'partial',
  'k67:dc2': 'compliant',
  'k68:dc1': 'partial',
  'k69:dc1': 'partial',
  'k70:dc6': 'partial',
  'k71:dc6': 'partial',
  'k72:dc6': 'partial',
  'k77:dc3': 'compliant',
  'k84:dc4': 'compliant',
  'k92:dc1': 'partial',
  'k93:dc1': 'partial',
  'k94:dc1': 'partial',
  'k95:dc1': 'partial',
  'k96:dc1': 'partial',
  'k97:dc2': 'compliant',
  'k98:dc1': 'partial',
  'k99:dc1': 'partial',
  'k101:dc1': 'partial',
  'k108:dc3': 'compliant',
  'k113:dc4': 'compliant',
  'k117:dc7': 'partial',
  'k118:dc7': 'partial',
  'k119:dc7': 'partial',
  'k120:dc7': 'partial',
  'k121:dc7': 'partial',
  'k122:dc7': 'partial',
  'k123:dc7': 'partial',
  'k124:dc7': 'partial',
  'k125:dc1': 'partial',
  'k126:dc1': 'partial',
  'k127:dc1': 'partial',
  'k128:dc1': 'partial',
  'k129:dc1': 'partial',
  'k130:dc2': 'compliant',
  'k131:dc1': 'partial',
  'k139:dc3': 'compliant',
  'k146:dc4': 'compliant',
  'k150:dc1': 'partial',
  'k151:dc1': 'partial',
  'k152:dc1': 'partial',
  'k153:dc1': 'partial',
  'k154:dc1': 'partial',
  'k155:dc1': 'partial',
  'k156:dc1': 'partial',
  'k157:dc1': 'partial',
  'k158:dc1': 'partial',
  'k166:dc3': 'compliant',
  'k167:dc8': 'gap',
  'k168:dc8': 'gap',
  'k169:dc8': 'gap',
  'k170:dc8': 'gap',
  'k171:dc8': 'gap',
  'k172:dc8': 'gap',
  'k173:dc8': 'gap',
  'k174:dc8': 'gap',
  'k175:dc8': 'gap',
  'k176:dc8': 'gap',
  'k178:dc4': 'compliant',
}

type Gap = { id: string; clause: Clause; priority: 'high' | 'medium' | 'low'; note: string }
const GAPS: Gap[] = [
  { id: 'g1', clause: CLAUSES.find((c) => c.id === 'k14')!, priority: 'high', note: 'BIA belum tersusun secara formal — target penyelesaian Q4 2026.' },
  { id: 'g2', clause: CLAUSES.find((c) => c.id === 'k6')!, priority: 'high', note: 'Register aspek lingkungan perlu ditelaah ulang & disinkronkan dengan JSA.' },
  { id: 'g3', clause: CLAUSES.find((c) => c.id === 'k13')!, priority: 'medium', note: 'Baseline konfigurasi belum lengkap untuk server produksi.' },
  { id: 'g4', clause: CLAUSES.find((c) => c.id === 'k11')!, priority: 'medium', note: 'Bukti komitmen manajemen perlu diformalkan lewat rapat P2K3 rutin.' },
  { id: 'g5', clause: CLAUSES.find((c) => c.id === 'k3')!, priority: 'low', note: 'Register risiko sudah ada tapi mapping ke peluang perbaikan minim.' },
]

function CoverageCell({ s }: { s?: CoverageStatus }) {
  if (!s) return <span className="text-[var(--color-neutral-soft)]">—</span>
  if (s === 'compliant') return <CheckCircle2 size={16} className="mx-auto text-[#1d6e48]" />
  if (s === 'partial') return <AlertTriangle size={16} className="mx-auto text-[#b9791c]" />
  if (s === 'gap') return <XCircle size={16} className="mx-auto text-[#b23b3a]" />
  return <MinusCircle size={16} className="mx-auto text-[var(--color-neutral-soft)]" />
}

function PriorityChip({ p }: { p: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-[#fbe7e6] text-[#b23b3a] border-[#f4c8c6]',
    medium: 'bg-[#fdf1dc] text-[#b9791c] border-[#f4dfae]',
    low: 'bg-[#eaf3fb] text-[#2a6fb3] border-[#c9e0f3]',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${map[p]}`}>
      {p}
    </span>
  )
}

const GAP_TYPE_LABEL: Record<GapFollowUpType, string> = {
  documentation: 'Dokumentasi',
  implementation: 'Implementasi',
  competency: 'Kompetensi',
  system: 'Sistem/Infrastruktur',
}

const GAP_STATUS_LABEL: Record<GapFollowUpStatus, string> = {
  open: 'Belum Ditindaklanjuti',
  in_progress: 'Dalam Proses',
  closed: 'Selesai (Closed)',
}

function GapTypeChip({ t }: { t: GapFollowUpType }) {
  return (
    <span className="rounded-full border border-[#c9e0f3] bg-[#eaf3fb] px-2 py-0.5 text-[10.5px] font-semibold text-[#2a6fb3]">
      {GAP_TYPE_LABEL[t]}
    </span>
  )
}

function FollowUpStatusChip({ s }: { s: GapFollowUpStatus }) {
  const map: Record<GapFollowUpStatus, string> = {
    open: 'border-[#f4c8c6] bg-[#fbe7e6] text-[#b23b3a]',
    in_progress: 'border-[#f4dfae] bg-[#fdf1dc] text-[#b9791c]',
    closed: 'border-[#c3e3d2] bg-[#e3f1ea] text-[#1d6e48]',
  }
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${map[s]}`}>
      {GAP_STATUS_LABEL[s]}
    </span>
  )
}

function isOverdue(deadline: string, status: GapFollowUpStatus): boolean {
  return status !== 'closed' && deadline < new Date().toISOString().slice(0, 10)
}

function AddFollowUpForm({ gapId, onDone }: { gapId: string; onDone: () => void }) {
  const { currentUser, dispatch } = useApp()
  const [type, setType] = useState<GapFollowUpType>('documentation')
  const [pic, setPic] = useState('')
  const [deadline, setDeadline] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [actionText, setActionText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!pic.trim() || !deadline || !reviewer.trim() || !actionText.trim()) return
    setSubmitting(true)
    await dispatch({
      type: 'ADD_GAP_FOLLOWUP',
      input: { gapId, type, pic: pic.trim(), deadline, action: actionText.trim(), reviewer: reviewer.trim() },
      actor: currentUser.name,
    })
    setSubmitting(false)
    onDone()
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-col gap-2 rounded-lg border border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Type GAP">
          <select className={inputClass} value={type} onChange={(e) => setType(e.target.value as GapFollowUpType)}>
            {(Object.keys(GAP_TYPE_LABEL) as GapFollowUpType[]).map((t) => (
              <option key={t} value={t}>{GAP_TYPE_LABEL[t]}</option>
            ))}
          </select>
        </Field>
        <Field label="PIC">
          <input className={inputClass} value={pic} onChange={(e) => setPic(e.target.value)} placeholder="Nama penanggung jawab" required />
        </Field>
        <Field label="Deadline">
          <input type="date" className={inputClass} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
        </Field>
        <Field label="Reviewer">
          <input className={inputClass} value={reviewer} onChange={(e) => setReviewer(e.target.value)} placeholder="Nama reviewer" required />
        </Field>
      </div>
      <Field label="Tindak Lanjut">
        <textarea
          className={inputClass}
          rows={2}
          value={actionText}
          onChange={(e) => setActionText(e.target.value)}
          placeholder="Deskripsi tindakan yang akan/sudah dilakukan untuk menutup gap ini"
          required
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>Batal</Button>
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting ? 'Menyimpan…' : 'Simpan Tindak Lanjut'}
        </Button>
      </div>
    </form>
  )
}

function GapFollowUpCard({ followUp, canManage }: { followUp: GapFollowUp; canManage: boolean }) {
  const { currentUser, dispatch } = useApp()
  const [updating, setUpdating] = useState(false)
  const overdue = isOverdue(followUp.deadline, followUp.status)

  async function setStatus(status: GapFollowUpStatus) {
    setUpdating(true)
    await dispatch({ type: 'UPDATE_GAP_FOLLOWUP_STATUS', followUpId: followUp.id, status, actor: currentUser.name })
    setUpdating(false)
  }

  return (
    <div className="mt-2 rounded-lg border border-[var(--color-neutral-border)] bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <GapTypeChip t={followUp.type} />
        <FollowUpStatusChip s={followUp.status} />
        {overdue && (
          <span className="rounded-full border border-[#f4c8c6] bg-[#fbe7e6] px-2 py-0.5 text-[10.5px] font-semibold text-[#b23b3a]">
            Lewat Deadline
          </span>
        )}
      </div>
      <p className="mt-2 text-[12px] leading-relaxed text-[var(--color-neutral-dark)]">{followUp.action}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-[var(--color-neutral-medium)] sm:grid-cols-4">
        <div><span className="font-semibold text-[var(--color-neutral-dark)]">PIC:</span> {followUp.pic}</div>
        <div><span className="font-semibold text-[var(--color-neutral-dark)]">Deadline:</span> {followUp.deadline}</div>
        <div><span className="font-semibold text-[var(--color-neutral-dark)]">Reviewer:</span> {followUp.reviewer}</div>
        <div>
          <span className="font-semibold text-[var(--color-neutral-dark)]">Closed:</span>{' '}
          {followUp.status === 'closed' ? (followUp.closedAt ?? '—') : 'Belum'}
        </div>
      </div>
      {canManage && followUp.status !== 'closed' && (
        <div className="mt-2.5 flex gap-1.5">
          {followUp.status === 'open' && (
            <Button variant="outline" size="sm" disabled={updating} onClick={() => setStatus('in_progress')}>
              Tandai Dalam Proses
            </Button>
          )}
          <Button variant="primary" size="sm" disabled={updating} onClick={() => setStatus('closed')}>
            Tandai Selesai (Close)
          </Button>
        </div>
      )}
    </div>
  )
}

export function ComplianceMatrixPage() {
  const { state, currentUser } = useApp()
  const [standard, setStandard] = useState<'' | Standard>('')
  const [addFormGapId, setAddFormGapId] = useState<string | null>(null)
  const canManage = rolesHavePermission(currentUser.roles, 'compliance.manage')

  const followUpsByGap = useMemo(() => {
    const map = new Map<string, GapFollowUp[]>()
    for (const gf of state.gapFollowUps) {
      const list = map.get(gf.gapId) ?? []
      list.push(gf)
      map.set(gf.gapId, list)
    }
    return map
  }, [state.gapFollowUps])

  const filteredClauses = useMemo(
    () => (standard ? CLAUSES.filter((c) => c.standard === standard) : CLAUSES),
    [standard]
  )

  const stats = useMemo(() => {
    let compliant = 0, partial = 0, gap = 0, empty = 0
    for (const cl of filteredClauses) {
      for (const doc of DOCUMENTS) {
        const s = COVERAGE[`${cl.id}:${doc.id}`]
        if (s === 'compliant') compliant++
        else if (s === 'partial') partial++
        else if (s === 'gap') gap++
        else empty++
      }
    }
    return { compliant, partial, gap, empty, total: filteredClauses.length * DOCUMENTS.length }
  }, [filteredClauses])

  return (
    <div>
      <PageHeader
        eyebrow="Governance"
        title="Compliance Matrix"
        subtitle="Peta pemenuhan klausul standar terhadap dokumen internal. Menampilkan gap analysis lintas ISO & regulasi."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f1ea] text-[#1d6e48]">
            <CheckCircle2 size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.compliant}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Compliant</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fdf1dc] text-[#b9791c]">
            <AlertTriangle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.partial}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Partial</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fbe7e6] text-[#b23b3a]">
            <XCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.gap}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Gap</div>
          </div>
        </Card>
        <Card className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-neutral-bg)] text-[var(--color-neutral-medium)]">
            <MinusCircle size={17} />
          </div>
          <div>
            <div className="text-[22px] font-bold leading-none tabular-nums">{stats.empty}</div>
            <div className="mt-1 text-[11px] font-medium text-[var(--color-neutral-medium)]">Belum Dinilai</div>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <SectionTitle
          hint={`Menampilkan ${filteredClauses.length} klausul × ${DOCUMENTS.length} dokumen`}
          action={
            <select className={inputClass + ' w-56'} value={standard} onChange={(e) => setStandard(e.target.value as Standard | '')}>
              <option value="">Semua Standar</option>
              {STANDARDS.map((s) => <option key={s.key} value={s.key}>{s.label.split(' — ')[0]}</option>)}
            </select>
          }
        >
          Matriks Klausul × Dokumen
        </SectionTitle>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 border-b border-r border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-2 py-2 text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                  Klausul
                </th>
                {DOCUMENTS.map((d) => (
                  <th key={d.id} className="border-b border-[var(--color-neutral-border)] bg-[var(--color-neutral-bg-soft)] px-1 py-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-neutral-medium)]">
                    <div className="font-mono">{d.code}</div>
                    <div className="mt-0.5 truncate text-[10px] font-normal normal-case text-[var(--color-neutral-soft)]" style={{ maxWidth: 100 }}>{d.title}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredClauses.map((cl) => (
                <tr key={cl.id} className="hover:bg-[var(--color-neutral-bg-soft)]">
                  <td className="sticky left-0 z-10 border-b border-r border-[var(--color-neutral-border)] bg-white px-2 py-2 text-left">
                    <div className="flex flex-wrap items-baseline gap-1">
                      <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{cl.standard}</span>
                      <span className="font-mono text-[11px] font-bold">{cl.code}</span>
                    </div>
                    <div className="text-[11.5px] font-semibold text-[var(--color-neutral-dark)]">{cl.title}</div>
                  </td>
                  {DOCUMENTS.map((d) => (
                    <td key={d.id} className="border-b border-[var(--color-neutral-border)] px-1 py-2 text-center">
                      <CoverageCell s={COVERAGE[`${cl.id}:${d.id}`]} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--color-neutral-medium)]">
          <span className="flex items-center gap-1"><CheckCircle2 size={13} className="text-[#1d6e48]" /> Compliant</span>
          <span className="flex items-center gap-1"><AlertTriangle size={13} className="text-[#b9791c]" /> Partial</span>
          <span className="flex items-center gap-1"><XCircle size={13} className="text-[#b23b3a]" /> Gap</span>
          <span className="flex items-center gap-1"><MinusCircle size={13} className="text-[var(--color-neutral-soft)]" /> Belum dinilai</span>
        </div>
      </Card>

      <Card>
        <SectionTitle hint={`${GAPS.length} gap teridentifikasi — tiap gap dilengkapi tindak lanjut (type, PIC, deadline, reviewer, status)`}>
          Gap Analysis & Tindak Lanjut
        </SectionTitle>
        <ul className="divide-y divide-[var(--color-neutral-border)]">
          {GAPS.map((g) => {
            const followUps = followUpsByGap.get(g.id) ?? []
            return (
              <li key={g.id} className="py-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5"><PriorityChip p={g.priority} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="rounded border border-[var(--color-neutral-border)] px-1 font-mono text-[10px] text-[var(--color-neutral-medium)]">{g.clause.standard}</span>
                      <span className="font-mono text-[12px] font-bold">{g.clause.code}</span>
                      <span className="text-[12.5px] font-semibold text-[var(--color-neutral-dark)]">{g.clause.title}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--color-neutral-medium)]">{g.note}</p>

                    {followUps.map((fu) => (
                      <GapFollowUpCard key={fu.id} followUp={fu} canManage={canManage} />
                    ))}

                    {canManage && (
                      addFormGapId === g.id ? (
                        <AddFollowUpForm gapId={g.id} onDone={() => setAddFormGapId(null)} />
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2"
                          onClick={() => setAddFormGapId(g.id)}
                        >
                          <Plus size={12} /> Tambah Tindak Lanjut
                        </Button>
                      )
                    )}
                    {!canManage && followUps.length === 0 && (
                      <p className="mt-2 text-[11.5px] italic text-[var(--color-neutral-soft)]">Belum ada tindak lanjut.</p>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>
    </div>
  )
}
