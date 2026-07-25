# 06. Dokumen Rencana Pengujian (Test Plan)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — cakupan pengujian 10 domain/30 modul) |
| Status | Wajib dilaksanakan & lulus sebelum deployment produksi (bertahap sesuai fase rilis modul) |

---

## 1. Strategi Pengujian

| Jenis Pengujian | Cakupan | Kapan |
|---|---|---|
| Unit Testing | Logika workflow, penomoran, versi, retensi, compliance mapping | Setiap commit (CI) |
| Integration Testing | API antar-layanan domain, database, notifikasi, AI proxy, search index | Sebelum merge ke staging |
| Functional / UAT | Seluruh modul dari sudut pandang pengguna lintas fungsi & aplikasi consumer | Sebelum go-live per fase |
| Security Testing | Autentikasi, RBAC/ABAC, information protection, injection, kebocoran kredensial | Sebelum go-live & berkala |
| Performance Testing | Beban repository skala enterprise, concurrent users, indexing search | Sebelum go-live |
| Regression Testing | Fitur lama tidak rusak setelah perubahan baru | Setiap rilis |
| Accessibility Testing | WCAG 2.1 AA | Sebelum go-live |

## 2. Skenario Uji per Domain

### 2.1 Domain 1 — Enterprise Document Repository
- [ ] Dokumen baru mendapat kode otomatis `JENIS-FUNGSI-NNN` tanpa duplikasi.
- [ ] Filter status/fungsi/jenis/standar/**klasifikasi**/kata kunci mengembalikan hasil benar.
- [ ] Performa muat register tetap responsif pada ≥10.000 dokumen.
- [ ] *(Roadmap)* Folder virtual, kategori, favorite/bookmark berfungsi sesuai hak akses.

### 2.2 Domain 2 — Document Lifecycle Management
- [ ] Workflow approval sequential berjalan sesuai urutan status yang sah; pengguna tanpa hak tidak dapat memicu transisi via API langsung.
- [ ] Version control: minor/major naik sesuai aturan; snapshot revisi lama tetap dapat dibuka utuh.
- [ ] *(Roadmap)* Parallel/conditional approval, escalation, delegation berjalan sesuai konfigurasi.
- [ ] *(Roadmap)* Compare Version menampilkan perbedaan antar revisi dengan akurat.
- [ ] *(Roadmap)* Upload berkas asli multi-format (Word/PDF/Excel/CAD/gambar) tersimpan & dapat diunduh kembali tanpa korup.

### 2.3 Domain 3 — Records Management *(roadmap)*
- [ ] Records register mencatat nomor rekaman, jenis, media, pemilik, departemen.
- [ ] Jadwal retensi terpasang otomatis berdasarkan jenis dokumen/standar.
- [ ] Transisi Archive (active→inactive→permanent) berjalan sesuai jadwal.
- [ ] Proses disposal/pemusnahan memerlukan approval berlapis dan tercatat di audit trail sebelum data benar-benar dihapus.

### 2.4 Domain 4 — Document Control
- [ ] Fitur distribusi & notifikasi "dibagikan" berfungsi.
- [ ] *(Roadmap)* Read confirmation & mandatory reading tercatat per penerima; distribution matrix akurat.
- [ ] *(Roadmap)* Check-in/check-out mencegah dua pengguna mengedit dokumen yang sama secara bersamaan (conflict detection).
- [ ] *(Roadmap)* Digital signature bersertifikat (PKI) — uji validitas sertifikat, timestamp, dan deteksi jika dokumen diubah setelah ditandatangani.

### 2.5 Domain 5 — Enterprise Search *(roadmap)*
- [ ] Full text search mengembalikan hasil relevan dari konten dokumen, bukan hanya metadata.
- [ ] OCR search dapat menemukan teks dalam dokumen hasil pindaian/gambar.
- [ ] Semantic/AI search mengembalikan dokumen relevan meski kata kunci tidak identik.
- [ ] Knowledge Discovery menampilkan dokumen serupa/terkait yang masuk akal secara kontekstual.

### 2.6 Domain 6 — Governance & Compliance
- [ ] Penomoran otomatis konsisten lintas fungsi.
- [ ] *(Roadmap)* Compliance Matrix: setiap klausul standar dapat ditautkan ke satu/lebih dokumen; status Terpenuhi/Sebagian/Belum Ada Dokumen akurat dan diperbarui otomatis saat status dokumen berubah.
- [ ] *(Roadmap)* Legal Register mencatat status berlaku regulasi dan memicu review dokumen terdampak saat regulasi berubah.

### 2.7 Domain 7 — Security Management
- [ ] RBAC: setiap dari 11 peran hanya dapat melakukan aksi sesuai matriks.
- [ ] *(Roadmap)* ABAC: pengguna tidak dapat mengakses dokumen di luar departemen/proyek/lokasi yang diizinkan meski perannya sama.
- [ ] *(Roadmap)* Watermark dinamis muncul benar pada unduhan/cetak dokumen Confidential ke atas; print/copy/download control berfungsi sesuai level klasifikasi.
- [ ] Audit trail mencatat login, upload, download, view, approval, delete, restore, export, print, sharing secara lengkap dan append-only.
- [ ] Uji kebocoran kunci API AI di response klien/network tab — harus nihil.

### 2.8 Domain 8 — Collaboration
- [ ] *(Roadmap)* Comment/mention/thread discussion berfungsi dan tunduk pada kontrol akses dokumen yang sama.
- [ ] *(Roadmap)* Task management: assignment & reminder review/approval terkirim tepat waktu.
- [ ] Notification Center in-app berfungsi; setelah integrasi backend, WA/Email/Telegram/Teams/Slack benar-benar terkirim ke penerima yang tepat.

### 2.9 Domain 9 — Analytics
- [ ] Dashboard menampilkan angka yang konsisten dengan data di Register Dokumen.
- [ ] Ekspor CSV/reporting sesuai filter yang diterapkan.
- [ ] *(Roadmap)* KPI Monitoring (SLA approval/review, kepatuhan distribusi, waktu siklus dokumen, persentase kedaluwarsa) terhitung akurat dan real-time/near-real-time.

### 2.10 Domain 10 — Enterprise Platform
- [ ] Manajemen pengguna: nonaktifkan pengguna langsung mencabut akses pada sesi berikutnya.
- [ ] *(Roadmap)* REST API/Webhook: aplikasi consumer dapat membaca/menerima event dokumen sesuai scope token OAuth2; tidak dapat mengakses di luar scope.
- [ ] *(Roadmap)* SSO/LDAP/AD: login pengguna melalui IdP korporat berhasil dan role/atribut ter-mapping benar.
- [ ] *(Roadmap)* Integrasi Microsoft 365/Google Workspace: sinkronisasi dokumen/notifikasi berjalan tanpa duplikasi data.
- [ ] *(Roadmap)* System administration: backup/restore, scheduler, monitoring, license management berfungsi sesuai prosedur `09_RUNBOOK.md`.

## 3. Pengujian Keamanan (ringkas — detail lihat `02_SECURITY.md`)

- [ ] Uji bypass RBAC/ABAC via manipulasi request API langsung.
- [ ] Uji akses dokumen terklasifikasi tanpa izin eksplisit.
- [ ] Uji XSS pada seluruh field input teks bebas (termasuk comment/discussion roadmap).
- [ ] Uji CSRF pada aksi state-changing.
- [ ] Uji rate limiting pada endpoint AI, search, dan integrasi API.

## 4. Pengujian Performa

| Skenario | Target |
|---|---|
| Muat Register Dokumen (10.000 dokumen) | < 2 detik |
| Full text/semantic search *(roadmap)* pada 100.000 dokumen terindeks | < 3 detik |
| Waktu respons Asisten AI | < 8 detik rekomendasi, < 20 detik draf lengkap |
| Compliance Gap Dashboard *(roadmap)* | < 5 detik untuk seluruh standar aktif |
| Concurrent users lintas fungsi & aplikasi consumer via API | Sesuai target kapasitas organisasi |

## 5. User Acceptance Testing (UAT)

- Peserta UAT mewakili seluruh fungsi pengguna (Mutu, K3, InfoSec, Anti-Suap, BCM, SDM, Legal, Finance, IT, dsb.) serta perwakilan tim yang mengoperasikan **aplikasi consumer** yang terintegrasi via API *(fase roadmap Domain 10)*.
- Kriteria lulus: seluruh skenario kritis pada Bagian 2 (sesuai modul yang sudah masuk fase rilis terkait) berhasil tanpa cacat blocking/major, dengan sign-off tertulis dari perwakilan setiap fungsi.

## 6. Kriteria Go/No-Go untuk Deployment (per Fase Rilis)

| Kriteria | Status Wajib |
|---|---|
| Seluruh test case kritis untuk modul dalam fase rilis terkait lulus | Wajib |
| Checklist keamanan `02_SECURITY.md` Bagian 12 lengkap | Wajib |
| UAT sign-off dari seluruh fungsi kunci pada fase terkait | Wajib |
| Tidak ada temuan security kritis/high yang terbuka | Wajib |
| Rencana rollback teruji | Wajib |
