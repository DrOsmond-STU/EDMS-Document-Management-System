# 03. Dokumen Desain (UI/UX Design Document)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.1 (chrome navigasi navy gelap ala dashboard QHSE/governance korporat — lihat `05_BRAND.md` §3 catatan referensi) |
| Status | Referensi implementasi UI saat ini + panduan pengembangan lanjutan |

---

## 1. Prinsip Desain

1. **Netral lintas fungsi & lintas aplikasi** — EDMS adalah platform enterprise yang dikonsumsi banyak fungsi dan aplikasi lain via API; tampilan/istilah tidak boleh terasa "milik" satu fungsi tertentu.
2. **Kejelasan status, validitas, & klasifikasi** — setiap dokumen menampilkan status siklus hidup, validitas, standar terkait, **dan level klasifikasi (Public–Top Secret)** secara jelas.
3. **Kepercayaan & kepatuhan** — tampilan tenang, profesional, minim dekorasi, cocok untuk konteks audit lintas standar dan records management.
4. **Peran-sadar (role-aware)** — UI menyesuaikan aksi berdasarkan peran, fungsi, dan (roadmap) atribut ABAC (proyek/lokasi) pengguna.
5. **Keterlacakan terlihat** — riwayat revisi, audit trail, relasi dokumen, pemetaan kepatuhan, dan (roadmap) status retensi/arsip mudah ditemukan.
6. **Governance-first, bukan sekadar gudang file** — navigasi menonjolkan domain: Repository, Lifecycle, Records, Control, Search, Governance & Compliance, Security, Collaboration, Analytics, Platform.

## 2. Struktur Navigasi (Information Architecture)

```
Dashboard (Analytics — ringkasan lintas fungsi, standar, & KPI)
├── Document Repository
│   ├── Register Dokumen
│   ├── Folder Virtual & Kategori [roadmap]
│   └── Favorite / Bookmark [roadmap]
├── Papan Approval (Kanban: Draft/Review/Approval/Released/Obsolete)
├── Tracking Penyusunan Dokumen
│   ├── Permintaan Baru
│   ├── Rapat Pembahasan (per proyek)
│   ├── Finalisasi & Pengesahan
├── Records Management [roadmap]
│   ├── Records Register
│   ├── Retention & Archive
├── Compliance Matrix [roadmap]
├── Legal Register [roadmap]
├── Register Risiko [roadmap]
├── Knowledge Base & Discovery [roadmap]
├── Asisten AI
│   ├── Pencarian & Regulasi
│   └── Rancang Dokumen Baru
├── Collaboration [roadmap]
│   ├── Comment & Discussion
│   └── Task Management
├── Pusat Notifikasi
├── Reporting & KPI Monitoring
├── Manajemen Pengguna & Hak Akses (IAM)
├── Master Data (Fungsi/Departemen, Standar, Unit Kerja, Lokasi, dsb.)
├── Integration & API Management [roadmap]
├── System Administration [roadmap: backup, storage, license, logging]
└── Audit Trail
```

## 3. Pola Komponen Utama

| Komponen | Fungsi | Catatan Desain |
|---|---|---|
| Badge Status | Status siklus hidup dokumen | Warna konsisten: abu (Draft), kuning (Review), oranye (Approval), hijau (Released), merah (Obsolete); tahap Archive/Destroy [roadmap] memakai warna netral gelap |
| Badge Validitas | Berlaku/Kadaluarsa/Tidak Berlaku/Belum Berlaku | Terpisah dari badge status |
| Badge Standar (multi-chip) | Satu/lebih standar yang dipenuhi dokumen | Chip kecil netral |
| **Badge Klasifikasi** | Public/Internal/Restricted/Confidential/Secret/Top Secret | Warna semakin gelap/tegas seiring level naik; ikon gembok untuk Confidential ke atas |
| Kanban Board | Visualisasi workflow approval | Kolom = status; filter per fungsi/standar/klasifikasi |
| Stepper Tracking Penyusunan | Visualisasi 8 tahap penyusunan dokumen | Tahap selesai bercentang hijau |
| Panel Riwayat Revisi | Daftar revisi dengan tanggal, editor, catatan | Setiap baris dapat dibuka untuk snapshot; tombol **Compare Version** [roadmap] |
| Kanvas Tanda Tangan | Tanda tangan kehadiran rapat | Untuk pengesahan dokumen resmi, arahkan ke modul **Digital Signature** bersertifikat [roadmap] |
| Bell Notifikasi | Ringkasan notifikasi in-app | Filter per kategori & fungsi |
| Kartu Rekomendasi AI | Hasil rekomendasi regulasi/draf dokumen | Label "Rekomendasi AI — perlu tinjauan" |
| Matriks Kepatuhan [roadmap] | Tabel klausul standar vs status pemenuhan | Warna sel: hijau (terpenuhi), kuning (sebagian), merah (belum ada dokumen) |
| Panel Comment & Discussion [roadmap] | Diskusi inline pada dokumen | Mention user, thread per bagian dokumen |
| Watermark Preview [roadmap] | Pratinjau watermark dinamis pada dokumen terklasifikasi | Nama pengguna + timestamp ditampilkan transparan di atas konten |

## 4. Palet Warna & Tipografi

Lihat `05_BRAND.md`. Warna status & klasifikasi memiliki makna semantik tetap di seluruh aplikasi; tipografi sans-serif untuk keterbacaan tabel padat; kontras WCAG 2.1 AA.

## 5. Responsivitas

| Breakpoint | Perilaku |
|---|---|
| Desktop (≥1200px) | Layout penuh, sidebar tetap terbuka |
| Tablet (768–1199px) | Sidebar collapsible, tabel scroll horizontal |
| Mobile (<768px) | Navigasi bawah/hamburger, kartu ringkas menggantikan tabel |

## 6. Aksesibilitas

- Seluruh aksi penting dapat dioperasikan via keyboard.
- Label ARIA pada ikon tanpa teks.
- Fokus visual jelas pada elemen interaktif.

## 7. Pola Interaksi Kritis

- **Konfirmasi aksi ireversibel**: transisi ke Released, Obsolete, Archive, Destroy, atau Pengesahan Dokumen wajib dialog konfirmasi eksplisit — khusus **Destroy** [roadmap] memerlukan konfirmasi berlapis (maker-checker).
- **Indikasi sumber AI**: konten hasil Asisten AI diberi penanda visual berbeda.
- **Indikasi multi-standar & klasifikasi**: UI membuat pemilihan standar (multi-select) dan level klasifikasi menjadi wajib eksplisit saat membuat/mengedit dokumen.
- **Check-in/Check-out** [roadmap]: dokumen yang sedang di-edit oleh satu pengguna ditandai "Locked by [nama]" untuk pengguna lain.
- **Pencegahan kehilangan data**: form panjang menyimpan draf otomatis secara berkala.

## 8. Referensi Wireframe

Wireframe rinci mengikuti implementasi aplikasi yang sudah dibangun sebagai referensi visual utama. Perluasan modul roadmap (Records Management, Compliance Matrix, Collaboration, Integration) harus tetap konsisten dengan pola komponen pada Bagian 3, dan ditampilkan sebagai menu setara — bukan submenu tersembunyi — mengingat perannya sentral dalam positioning EDMS sebagai platform Enterprise Document Governance.
