# 01. Product Requirements Document (PRD)
## Enterprise Document Management System (EDMS) — Platform Enterprise Document Governance

| Item | Keterangan |
|---|---|
| Nama Produk | Enterprise Document Management System (EDMS) |
| Versi Dokumen | 2.0 (revisi besar — mengikuti arsitektur target 10 domain / 30 modul) |
| Status | Draft untuk review pra-deployment |
| Pemilik Produk | (isi nama PIC) |
| Terakhir Diperbarui | 25 Juli 2026 |

> **Catatan revisi 2.0**: Versi 1.1 memperbaiki positioning EDMS sebagai aplikasi independen lintas fungsi (bukan turunan QHSE), tetapi ruang lingkup fiturnya masih terbatas pada apa yang sudah dibangun di prototipe. Versi ini menetapkan **arsitektur target enterprise penuh**: 10 domain fungsional berisi 30 modul, sebagai peta jalan resmi EDMS jangka panjang. Setiap modul diberi status implementasi agar jelas mana yang sudah ada di prototipe, mana yang menjadi roadmap pengembangan.

---

## 1. Definisi & Tujuan

EDMS berfungsi sebagai **pusat pengelolaan informasi terdokumentasi (Single Source of Truth)** yang mengendalikan seluruh siklus hidup dokumen organisasi — mulai dari pembuatan, peninjauan, persetujuan, distribusi, penggunaan, revisi, pengarsipan, retensi, hingga pemusnahan — sesuai standar internasional dan peraturan perundang-undangan yang berlaku.

**Tujuan produk:**
1. Menjadi satu sumber kebenaran (single source of truth) untuk seluruh dokumen resmi organisasi.
2. Mengendalikan siklus hidup dokumen secara penuh dan terkontrol sejak dibuat hingga dimusnahkan.
3. Menegakkan tata kelola (governance) dokumen sesuai kebijakan organisasi, struktur klasifikasi, dan standar.
4. Memenuhi persyaratan kepatuhan (compliance) berbagai standar internasional dan regulasi sejak tahap desain.
5. Menjadi platform integrasi terbuka yang dapat dikonsumsi aplikasi lain melalui API tanpa kehilangan fungsi sebagai pusat pengendali dokumen.

## 2. Standar & Regulasi Cakupan

EDMS dirancang untuk memenuhi persyaratan berbagai standar sistem manajemen, antara lain:

- **ISO 15489** — Records Management
- **ISO 30301** — Management Systems for Records
- **ISO 9001** — Quality Management System
- **ISO 14001** — Environmental Management System
- **ISO 45001** — Occupational Health and Safety Management System
- **ISO/IEC 27001** — Information Security Management System
- **ISO 22301** — Business Continuity Management System
- **ISO 37001** — Anti-Bribery Management System
- **ISO 31000** — Risk Management Guidelines
- **PP Nomor 50 Tahun 2012** — tentang SMK3
- **Regulasi Kementerian Ketenagakerjaan**
- Regulasi pemerintah lainnya yang mewajibkan pengendalian dokumen
- Standar/regulasi tambahan yang dapat ditambahkan organisasi di kemudian hari melalui Master Data Standar, tanpa perubahan struktur aplikasi

---

## 3. Positioning Produk

EDMS **bukan** aplikasi khusus QHSE, dan **bukan** modul dari satu fungsi tertentu. EDMS adalah **platform Enterprise Document Governance** yang dimanfaatkan oleh seluruh fungsi organisasi, antara lain: Direksi, Quality Assurance, Human Capital, Information Technology, Legal & Compliance, Finance, Procurement, Engineering, Operasional, Project Management, Manufacturing, Government Institution, Healthcare, Pendidikan, BUMN/BUMD, dan Perusahaan Swasta.

Seluruh aplikasi lain (ERP, HRIS, sistem proyek, dsb.) berlaku sebagai **consumer** yang memanfaatkan layanan EDMS melalui API/integrasi, sementara seluruh dokumen tetap dikelola dalam satu repositori terpusat.

### 3.1 Prinsip Arsitektur

1. **Single Source of Truth** — seluruh dokumen resmi organisasi dikelola dalam satu repositori terpusat.
2. **Document Lifecycle Management** — setiap dokumen memiliki siklus hidup terkontrol sejak dibuat hingga dimusnahkan.
3. **Enterprise Governance** — pengelolaan dokumen mengikuti kebijakan organisasi, struktur klasifikasi, dan standar tata kelola.
4. **Compliance by Design** — fitur dirancang agar memenuhi persyaratan standar internasional dan regulasi sejak awal.
5. **Open Integration Platform** — EDMS dapat diintegrasikan dengan aplikasi lain melalui API tanpa kehilangan fungsi sebagai pusat pengendalian dokumen.

---

## 4. Ruang Lingkup Fungsional — 10 Domain / 30 Modul

Status: ✅ Ada di prototipe · ⚠️ Sebagian ada di prototipe · ⏳ Roadmap (belum diimplementasikan)

### Domain 1 — Enterprise Document Repository
| # | Modul | Status | Catatan |
|---|---|---|---|
| 1 | Document Repository | ⚠️ | Penyimpanan terpusat & register ada; folder virtual, thumbnail, favorite, bookmark, multi-format file asli belum ada |
| 2 | Document Register | ✅ | Nomor, judul, jenis, kategori, pemilik, unit kerja, status, versi, revisi, tanggal efektif/review/berlaku, kata kunci |
| 3 | Document Classification | ⚠️ | Baru 2 level (Internal/Rahasia); 6 level penuh (Public–Top Secret) + watermark/download/print/copy restriction = roadmap |

### Domain 2 — Document Lifecycle Management
| # | Modul | Status | Catatan |
|---|---|---|---|
| 4 | Document Authoring | ⏳ | Saat ini hanya ringkasan teks; rich text editor, upload Word/PDF/Excel/CAD/gambar, template, header/footer/watermark = roadmap |
| 5 | Version Management | ⚠️ | Major/minor version, revision history, rollback via snapshot sudah ada; compare version & change log terstruktur = roadmap |
| 6 | Document Review | ⚠️ | Status Review ada; jadwal review terstruktur, reminder otomatis, review notes formal = roadmap |
| 7 | Approval Workflow | ⚠️ | Alur Draft→Review→Approval→Released→Obsolete (sequential) sudah ada; parallel/conditional approval, escalation, delegation = roadmap. Tahap Archive/Destroy pada siklus penuh belum ada |

### Domain 3 — Records Management (ISO 15489 / ISO 30301)
| # | Modul | Status | Catatan |
|---|---|---|---|
| 8 | Records Register | ⏳ | Belum ada — roadmap |
| 9 | Retention Management | ⚠️ | Field retensi (tahun) ada di model data; jadwal retensi, archive, transfer, disposal & approval pemusnahan = roadmap |
| 10 | Archive Management | ⏳ | Active/Inactive/Permanent/Electronic/Physical Archive — roadmap |

### Domain 4 — Document Control
| # | Modul | Status | Catatan |
|---|---|---|---|
| 11 | Distribution Management | ⚠️ | Fitur "Bagikan Dokumen" & notifikasi ada; read confirmation, mandatory reading, acknowledgement, distribution matrix = roadmap |
| 12 | Check In / Check Out | ⏳ | Belum ada — penting untuk mencegah konflik edit simultan, roadmap |
| 13 | Digital Signature | ⚠️ | Tanda tangan kanvas untuk kehadiran rapat ada; tanda tangan elektronik bersertifikat (PKI), timestamp, certificate validation untuk pengesahan dokumen = roadmap |

### Domain 5 — Enterprise Search
| # | Modul | Status | Catatan |
|---|---|---|---|
| 14 | Full Text Search | ⚠️ | Pencarian kata kunci pada metadata ada; OCR search, semantic search, AI search penuh = roadmap |
| 15 | Knowledge Discovery | ⏳ | Similar document, related document, frequently accessed, recommendation — roadmap (di luar deteksi duplikasi sederhana Asisten AI saat ini) |

### Domain 6 — Governance & Compliance
| # | Modul | Status | Catatan |
|---|---|---|---|
| 16 | Document Governance | ⚠️ | Penomoran otomatis ada; template standar, naming convention formal, taxonomy = roadmap |
| 17 | Compliance Mapping | ⏳ | Pemetaan dokumen ↔ klausul ISO/regulasi — roadmap (fase lanjutan, lihat Bagian 6) |
| 18 | Legal Register | ⏳ | Register regulasi, status berlaku, review & distribusi regulasi — roadmap |

### Domain 7 — Security Management
| # | Modul | Status | Catatan |
|---|---|---|---|
| 19 | Identity & Access Management | ⚠️ | RBAC 11 peran ada; ABAC, multi-role, department/project/site access granular = roadmap |
| 20 | Information Protection | ⏳ | Encryption, watermark, DRM, print/copy/download control — wajib backend produksi, lihat `02_SECURITY.md` |
| 21 | Audit Trail | ✅ | Login, create, transisi status, hapus, perubahan master data tercatat; cakupan upload/download/view/export/print/sharing penuh = perluasan roadmap |

### Domain 8 — Collaboration
| # | Modul | Status | Catatan |
|---|---|---|---|
| 22 | Comment & Discussion | ⏳ | Inline comment, mention user, thread discussion — roadmap |
| 23 | Task Management | ⚠️ | Review/approval task tersirat dari notifikasi; assignment & reminder terstruktur = roadmap |
| 24 | Notification Center | ⚠️ | In-app ✅; dispatch WA/Email/Telegram sudah berkerangka (perlu backend); Microsoft Teams/Slack = roadmap |

### Domain 9 — Analytics
| # | Modul | Status | Catatan |
|---|---|---|---|
| 25 | Dashboard | ✅ | Total dokumen, per status, per fungsi, aktivitas terbaru |
| 26 | Reporting | ⚠️ | Ringkasan & ekspor CSV ada; laporan kepatuhan review, distribusi, retensi arsip penuh = roadmap |
| 27 | KPI Monitoring | ⚠️ | Sebagian KPI di Bagian 9 PRD ini; SLA approval/review terukur otomatis = roadmap |

### Domain 10 — Enterprise Platform
| # | Modul | Status | Catatan |
|---|---|---|---|
| 28 | Integration | ⏳ | REST API, webhook, LDAP/AD, SSO (SAML/OAuth2/OIDC), Microsoft 365, Google Workspace — seluruhnya roadmap, wajib backend produksi |
| 29 | Master Data | ⚠️ | Fungsi/departemen & daftar standar ada; organisasi, unit kerja, jabatan, lokasi, bahasa penuh = roadmap |
| 30 | System Administration | ⚠️ | User management ada; backup, restore, scheduler, storage management, monitoring, license management, API management, email server, logging = roadmap backend |

> **Catatan kritis untuk deployment:** Modul berstatus ⏳ dan sebagian besar ⚠️ pada Domain 3, 4, 7, 8, 10 **wajib** diselesaikan melalui backend produksi sebelum sistem digunakan sebagai EDMS resmi organisasi. Lihat `02_SECURITY.md` dan `07_DEPLOYMENT.md`.

---

## 5. Fitur yang Sudah Berjalan di Prototipe Saat Ini (Ringkasan Operasional)

| Fitur | Deskripsi |
|---|---|
| Dashboard | Ringkasan dokumen per status, per fungsi, aktivitas terbaru |
| Register Dokumen | Tabel dokumen dengan filter status/fungsi/jenis/standar/kata kunci |
| Penomoran Otomatis | Format `JENIS-FUNGSI-NNN` |
| Workflow Approval | Draft → Review → Approval → Released → Obsolete (kanban, sequential) |
| Version Control | Revisi 0,1,2,...; major/minor (0.1→1.0→1.1→2.0); snapshot riwayat dapat dibuka kembali |
| Relasi Antar Dokumen | Menggantikan, mereferensikan, terhubung, bagian dari (parent) |
| Status Validitas | Berlaku / Kadaluarsa / Tidak Berlaku / Belum Berlaku |
| RBAC | 11 peran dengan matriks hak akses |
| Audit Trail | Create, transisi status, hapus, perubahan master data |
| Master Data | Fungsi/departemen, daftar standar |
| Reporting | Ringkasan per jenis/fungsi/standar, ekspor CSV |
| Pusat Notifikasi | Bell in-app: approval tertunda, dokumen mendekati kedaluwarsa |
| Tracking Penyusunan Dokumen | 8 tahap: permintaan → undangan rapat → rapat multi-sesi (anggaran, foto) → bukti notulen → daftar hadir & TTD kanvas → finalisasi → pengesahan → masuk register utama |
| Asisten AI – Pencarian & Regulasi | Topik → deteksi duplikasi sederhana → rekomendasi regulasi/standar, fungsi, jenis dokumen |
| Asisten AI – Rancang Dokumen Baru | Standar + jenis + fungsi + konteks → draf lengkap dengan pemetaan klausul |
| Manajemen Pengguna & Hak Akses | Daftar pengguna, tambah/nonaktifkan/hapus, matriks akses |
| Notifikasi Multi-kanal (struktur) | Dispatch WA/Email/Telegram sudah disiapkan di kode, perlu backend |

## 6. Jenis Dokumen yang Didukung

EDMS harus mampu mengelola berbagai jenis informasi terdokumentasi, antara lain: Kebijakan (Policy), Manual Sistem Manajemen, SOP, Work Instruction, Prosedur, Pedoman, Standar Internal, Formulir, Template, Rekaman (Records), Notulen Rapat, Surat Keputusan, Surat Edaran, Kontrak, Perjanjian, Dokumen Hukum, Dokumen Proyek, Gambar Teknik (CAD), Dokumen Keuangan, Dokumen SDM, Dokumen TI, Dokumen Audit, Dokumen Regulasi, Dokumen Vendor, Dokumen Pelanggan, Dokumen Arsip Elektronik, dan Arsip Fisik (metadata & lokasi penyimpanan).

> Prototipe saat ini baru mendukung jenis dokumen kendali standar (Kebijakan, Manual, SOP, WI, Formulir) dengan konten ringkasan teks. Dukungan penuh untuk seluruh jenis dokumen di atas — termasuk upload berkas asli multi-format dan gambar teknik CAD — merupakan bagian dari roadmap Domain 1 & 2.

---

## 7. Peran Pengguna (RBAC) — 11 Peran (Generik, Lintas Fungsi)

| Peran | Ringkasan Kewenangan |
|---|---|
| Requester / Pemohon | Mengajukan permintaan pembuatan dokumen dari fungsi mana pun |
| Document Drafter / Penyusun | Menyusun draf, mengelola rapat pembahasan |
| Reviewer | Meninjau dan memberi catatan pada draf dokumen |
| Approver | Menyetujui dokumen untuk dirilis |
| Document Controller | Mengelola penomoran, register, dan status dokumen lintas fungsi |
| Ratifier / Pengesah | Mengesahkan dokumen final menjadi dokumen resmi |
| Function/Department Head | Melihat dan mengawasi dokumen fungsinya |
| Compliance & Risk Admin | Mengelola pemetaan kepatuhan multi-standar dan keterkaitan risiko |
| System Administrator | Mengelola pengguna, master data, dan konfigurasi sistem |
| Auditor (Read-only) | Melihat seluruh dokumen dan audit trail tanpa mengubah |
| Viewer / Pengguna Umum | Melihat dokumen berstatus Released sesuai hak akses fungsinya |

> Roadmap RBAC menambahkan peran **Records Manager** (mengelola retensi & pemusnahan arsip, Domain 3) dan memperluas model akses dari RBAC murni menjadi RBAC + **ABAC** (akses berbasis atribut: departemen, proyek, lokasi/site — Modul 19).

---

## 8. Model Data Inti (Ringkasan)

- **Dokumen**: kode, judul, jenis, fungsi/departemen, daftar standar terkait (multi-value), klasifikasi (roadmap: 6 level), status siklus hidup, status validitas, versi, tanggal berlaku/kedaluwarsa/review, konten/berkas, retensi.
- **Revisi**: nomor revisi, versi, tanggal, editor, catatan, status, snapshot konten.
- **Relasi Dokumen**: `supersedes`/`supersededBy`, `references`, `relatedTo`, `parentDocument`.
- **Pemetaan Kepatuhan**: dokumen ↔ klausul standar (many-to-many), status pemenuhan *(roadmap)*.
- **Record** *(roadmap)*: nomor rekaman, jenis, media penyimpanan, pemilik, departemen, jadwal retensi.
- **Risiko** *(roadmap)*: register risiko ↔ dokumen kontrol mitigasi.
- **Proyek Penyusunan**: nomor permintaan, pemohon, rapat-rapat, finalisasi, pengesahan.
- **Pengguna**: nama, email, fungsi/departemen, peran, status aktif.
- **Notifikasi**: jenis, kanal, status baca, dokumen terkait.
- **Audit Log**: aktor, aksi, entitas, waktu, keterangan.

---

## 9. KPI

1. **Waktu siklus persetujuan (SLA Approval/Review)** — rata-rata hari dari Draft ke Released, per standar.
2. **Cakupan kepatuhan** — persentase klausul standar dengan dokumen pendukung terverifikasi *(roadmap Compliance Mapping)*.
3. **Dokumen kedaluwarsa tak tertangani** — target mendekati nol.
4. **Tingkat pemanfaatan dokumen** — frekuensi akses/pencarian dokumen terkendali.
5. **Kepatuhan distribusi** — persentase dokumen released dengan acknowledgement lengkap *(roadmap Distribution Management)*.
6. **Adopsi Asisten AI** — jumlah rekomendasi yang ditindaklanjuti menjadi dokumen.
7. **Kelengkapan jejak penyusunan** — persentase dokumen baru melalui proses tracking penuh sebelum disahkan.
8. **Insiden keamanan** — nol insiden kebocoran kredensial/data dokumen terkendali.

---

## 10. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Kunci API AI terekspos di klien | Penyalahgunaan kuota/biaya, kebocoran data | Pindahkan pemanggilan AI ke backend (wajib sebelum go-live publik) |
| Ketergantungan single source of truth lintas fungsi | Downtime memengaruhi seluruh sistem manajemen organisasi | Strategi backup, replikasi, dan DR (lihat `09_RUNBOOK.md`) |
| Gap besar antara roadmap 30 modul dan prototipe saat ini | Ekspektasi stakeholder tidak sesuai realitas rilis awal | Komunikasikan roadmap fase per fase (Bagian 11) secara eksplisit ke seluruh fungsi |
| Records Management & retensi belum ada modul dedicated | Risiko ketidaksesuaian ISO 15489/30301 dan kebijakan pemusnahan arsip | Prioritaskan Domain 3 pada fase produksi awal, bukan fase akhir |
| Informasi Protection (DRM/watermark/enkripsi) belum ada | Kebocoran dokumen rahasia/terklasifikasi | Wajibkan Domain 7 selesai sebelum dokumen berklasifikasi tinggi dipakai di produksi |
| Sistem dipersepsikan "milik" satu fungsi tertentu | Fungsi lain enggan mengadopsi | Tata kelola & sponsor proyek di tingkat manajemen puncak/Corporate |

---

## 11. Roadmap Implementasi (Berbasis 10 Domain)

| Fase | Fokus Domain |
|---|---|
| Fase 1 (Selesai) | Domain 2 (sebagian): register, workflow approval sequential, version control dasar; Domain 7 (sebagian): RBAC, audit trail dasar |
| Fase 2 (Selesai) | Domain 2 (Tracking Penyusunan Dokumen 8 tahap), Domain 8 (sebagian): notifikasi terpusat, Asisten AI (Domain 5 & 6 sebagian) |
| Fase 3 (Pra-deployment — dokumen ini) | Hardening keamanan Domain 7, arsitektur produksi Domain 10, pengujian menyeluruh |
| Fase 4 (Produksi Awal) | Backend nyata, SSO/LDAP (Domain 10), Information Protection dasar (Domain 7), Distribution Management dasar (Domain 4) |
| Fase 5 (Perluasan Governance & Compliance) | Compliance Mapping, Legal Register (Domain 6), Digital Signature bersertifikat, Check-in/Check-out (Domain 4) |
| Fase 6 (Perluasan Records & Search) | Records Register, Retention & Archive Management (Domain 3), Full Text/OCR/Semantic Search, Knowledge Discovery (Domain 5) |
| Fase 7 (Perluasan Collaboration & Integration) | Comment & Discussion, Task Management penuh (Domain 8), Integration API/Webhook/M365/Google Workspace (Domain 10) |

---

## 12. Lampiran — Daftar Standar & Regulasi Cakupan

ISO 15489, ISO 30301, ISO 9001, ISO 14001, ISO 45001, ISO/IEC 27001, ISO 22301, ISO 37001, ISO 31000, SMK3 (PP 50/2012), regulasi Kementerian Ketenagakerjaan, serta standar/regulasi tambahan yang dapat ditambahkan organisasi melalui Master Data Standar tanpa memerlukan perubahan struktur aplikasi.
