# 08. Dokumen Instruksi Tugas (Task Instruction / SOP Penggunaan)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — menambahkan peran & modul roadmap) |
| Status | Panduan operasional untuk pengguna akhir per peran, lintas fungsi & aplikasi |

---

## 1. Tujuan

Memberikan instruksi langkah demi langkah bagi setiap peran dalam menjalankan tugasnya di EDMS, berlaku untuk seluruh fungsi organisasi (Mutu, Lingkungan, K3, Keamanan Informasi, Anti-Suap, Business Continuity, Manajemen Risiko, SDM/Ketenagakerjaan, Legal, Finance, IT, dsb.) serta tim yang mengelola aplikasi consumer yang terintegrasi via API.

## 2. Instruksi per Peran

### 2.1 Requester (Pemohon)
1. Buka menu **Tracking Penyusunan Dokumen → Permintaan Baru**.
2. Isi judul, jenis dokumen, fungsi/departemen pengaju, satu atau lebih standar terkait, **level klasifikasi awal**, dan alasan kebutuhan.
3. Simpan — sistem menerbitkan nomor permintaan otomatis (`REQ-YYYY-NNN`).
4. Pantau status permintaan melalui Pusat Notifikasi.

### 2.2 Document Drafter (Penyusun)
1. Terima permintaan yang ditugaskan di menu **Tracking Penyusunan Dokumen**.
2. (Opsional) Gunakan **Asisten AI → Pencarian & Regulasi** untuk memastikan tidak ada dokumen serupa dan mendapat rekomendasi regulasi/standar terkait.
3. Jadwalkan **Undangan Rapat Pembahasan**, catat anggaran & foto dokumentasi, unggah bukti notulen, dan rekam tanda tangan kehadiran — ulangi untuk Rapat 2, 3, dst. bila perlu.
4. (Opsional) Gunakan **Asisten AI → Rancang Dokumen Baru** untuk draf awal; tinjau dan sesuaikan sebelum digunakan.
5. Setelah rapat selesai, klik **Finalisasi Dokumen**, isi konten final, kategori, klasifikasi, dan konfirmasi standar yang dipenuhi.
6. *(Roadmap)* Untuk dokumen berformat asli (Word/PDF/Excel/CAD), unggah berkas melalui modul **Document Authoring**; gunakan template & header/footer standar organisasi.

### 2.3 Reviewer
1. Terima notifikasi dokumen berstatus **Review**.
2. Tinjau isi, struktur, dan kesesuaian dengan klausul standar terkait.
3. *(Roadmap)* Gunakan panel **Comment & Discussion** untuk memberi catatan inline, mention Drafter bila perlu klarifikasi.
4. Berikan catatan perbaikan, atau teruskan ke tahap **Approval**.

### 2.4 Approver
1. Terima notifikasi dokumen berstatus **Approval**.
2. Tinjau dokumen dan riwayat revisinya.
3. Setujui (lanjut ke Released) atau tolak (kembali ke Draft) disertai alasan.
4. *(Roadmap)* Untuk dokumen yang memerlukan alur **Parallel/Conditional Approval**, sistem menampilkan status persetujuan dari seluruh approver terkait sebelum status dapat berpindah.

### 2.5 Document Controller
1. Pastikan penomoran dokumen (`JENIS-FUNGSI-NNN`) sesuai konvensi.
2. Kelola Register Dokumen lintas fungsi: pastikan status, klasifikasi, dan metadata standar sudah benar sebelum dirilis.
3. Pantau dokumen mendekati kedaluwarsa melalui Pusat Notifikasi.
4. *(Roadmap)* Kelola **Distribution Matrix**: tentukan siapa wajib menerima & mengonfirmasi pembacaan (mandatory reading) untuk dokumen tertentu.

### 2.6 Ratifier (Pengesah)
1. Buka proyek penyusunan dokumen berstatus **Finalisasi**.
2. Verifikasi kelengkapan: seluruh rapat memiliki notulen, daftar hadir & tanda tangan lengkap.
3. Klik **Pengesahan Dokumen** untuk menerbitkan dokumen resmi ke **Daftar Dokumen Utama**.
4. *(Roadmap)* Untuk dokumen yang mensyaratkan kekuatan hukum, gunakan modul **Digital Signature** bersertifikat (PKI) alih-alih tanda tangan kanvas.

### 2.7 Function/Department Head
1. Pantau dokumen fungsinya melalui filter Register Dokumen.
2. Tinjau laporan ringkasan per jenis dokumen dan per standar pada menu **Reporting**.

### 2.8 Compliance & Risk Admin
1. Kelola **Master Data Standar** (ISO 15489, 30301, 9001, 14001, 45001, 27001, 22301, 37001, 31000, SMK3, regulasi Kemenaker, dll.).
2. *(Roadmap)* Kelola pemetaan kepatuhan (**Compliance Matrix**) antara dokumen dan klausul standar; pantau **Compliance Gap Dashboard**.
3. *(Roadmap)* Kelola **Legal Register ´ status berlaku regulasi, jadwal review, dan distribusi perubahan regulasi ke fungsi terdampak.
4. *(Roadmap)* Kaitkan register risiko dengan dokumen kontrol mitigasi terkait.

### 2.9 Records Manager *(peran roadmap — Domain 3)*
1. Kelola **Records Register**: nomor rekaman, jenis, media penyimpanan, pemilik, departemen.
2. Tetapkan/tinjau **jadwal retensi** per jenis dokumen/rekaman.
3. Kelola transisi arsip (Active → Inactive → Permanent Archive) dan proses **disposal/pemusnahan** dengan approval berlapis.

### 2.10 System Administrator
1. Kelola pengguna: tambah, nonaktifkan, atau hapus pengguna dari fungsi manapun di menu **Manajemen Pengguna & Hak Akses**.
2. Kelola master data (fungsi/departemen, daftar standar, unit kerja, lokasi) di menu **Master Data**.
3. Pantau Audit Trail secara berkala untuk aktivitas anomali lintas fungsi.
4. *(Roadmap)* Kelola **System Administration**: backup/restore, scheduler, storage management, monitoring, license management, API management, email server, logging.

### 2.11 Auditor
1. Akses seluruh dokumen dan Audit Trail dalam mode read-only, lintas seluruh fungsi dan standar.
2. Ekspor laporan/CSV per standar untuk keperluan audit eksternal masing-masing sertifikasi melalui menu **Reporting**.

### 2.12 Viewer
1. Cari dan baca dokumen berstatus **Released** sesuai hak akses fungsinya dan level klasifikasi yang diizinkan.
2. Gunakan fitur pencarian/filter untuk menemukan dokumen relevan dengan cepat; *(roadmap)* manfaatkan **Full Text/Semantic Search** dan rekomendasi **Knowledge Discovery**.

### 2.13 Integrator / Pemilik Aplikasi Consumer *(peran roadmap — Domain 10)*
1. Ajukan kebutuhan integrasi ke System Administrator/Platform team.
2. Terima kredensial OAuth2 client (scope terbatas sesuai kebutuhan aplikasi).
3. Konsumsi **REST API**/berlangganan **Webhook** EDMS sesuai dokumentasi API; seluruh pemanggilan tercatat di Audit Trail.

## 3. Instruksi Fitur Lintas Peran

### 3.1 Menggunakan Asisten AI — Pencarian & Regulasi
1. Buka **Asisten AI → Pencarian & Regulasi**.
2. Ketik topik kebutuhan.
3. Tinjau hasil: peringatan duplikasi dokumen lintas fungsi, rekomendasi regulasi/standar, fungsi terkait, dan jenis dokumen yang disarankan.
4. Klik **Buat Dokumen** pada rekomendasi yang relevan.

### 3.2 Menggunakan Asisten AI — Rancang Dokumen Baru
1. Buka **Asisten AI → Rancang Dokumen Baru**.
2. Pilih standar (dapat lebih dari satu), jenis dokumen, fungsi, lalu jelaskan konteks kebutuhan.
3. Tinjau rancangan yang dihasilkan.
4. Klik **Gunakan Rancangan Ini** untuk membuat dokumen sebagai Draft.

> **Penting:** Seluruh hasil Asisten AI adalah rekomendasi, bukan keputusan final. Reviewer/Approver tetap wajib meninjau sebelum dokumen dirilis resmi.

### 3.3 Menggunakan Compliance Matrix *(fase lanjutan)*
1. Buka **Compliance Matrix**, pilih standar yang ingin ditinjau.
2. Lihat daftar klausul dan status pemenuhannya.
3. Klik klausul untuk melihat dokumen yang menaunginya, atau buat permintaan dokumen baru langsung dari klausul yang belum terpenuhi.

### 3.4 Menggunakan Check-in/Check-out *(fase lanjutan)*
1. Klik **Check Out** sebelum mengedit dokumen — dokumen ditandai "Locked by [nama Anda]" bagi pengguna lain.
2. Setelah selesai, klik **Check In** untuk melepas kunci dan menyimpan perubahan sebagai revisi baru.

## 4. Eskalasi

Jika terdapat kendala teknis (login gagal, notifikasi tidak terkirim, dokumen tidak dapat diakses, integrasi API bermasalah), hubungi PIC IT/Helpdesk korporat sesuai kontak yang tercantum pada `09_RUNBOOK.md`.
