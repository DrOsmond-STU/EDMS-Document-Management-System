# 05. Panduan Brand & Gaya Visual (Brand Guideline)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi — menambahkan token klasifikasi dokumen) |
| Status | Panduan dasar — sesuaikan dengan identitas visual korporat resmi organisasi sebelum go-live |

---

## 1. Prinsip Brand

EDMS mencerminkan **kepercayaan, ketelitian, dan tata kelola (governance)**. Sebagai platform Enterprise Document Governance yang dikonsumsi banyak fungsi dan aplikasi lain, identitas visualnya harus **netral secara fungsi dan aplikasi** — bukan identitas satu departemen, bukan pula identitas aplikasi consumer yang terhubung via API.

> **Catatan:** Jika organisasi memiliki brand guideline korporat resmi, dokumen ini harus diselaraskan dengannya sebelum deployment.

## 2. Nama & Penamaan Produk

- Gunakan nama generik enterprise, mis. **"EDMS"** atau nama produk internal resmi yang ditetapkan manajemen.
- **Hindari** penamaan yang menyiratkan kepemilikan satu fungsi (mis. "EDMS-QHSE").

## 3. Palet Warna

| Token | Hex | Penggunaan |
|---|---|---|
| Primary Blue | `#378ADD` | Aksi utama, tautan, ikon dokumen baru |
| Warning Amber | `#EF9F27` | Status "Approval", peringatan mendekati kedaluwarsa |
| Teal | `#0E7C86` | Status "Pembaruan Dokumen", elemen sekunder |
| Violet | `#7F77DD` | Status "Dokumen Dibagikan" |
| Danger Red | `#E24B4A` | Status "Kadaluarsa", aksi hapus/obsolete/destroy |
| Success Green | `#1D6E48` (teks) / `#E3F1EA` (latar) | Status selesai/berhasil |
| Neutral Dark | `#2B2F29` | Teks utama |
| Neutral Medium | `#6B7268` | Label sekunder, meta info |
| Neutral Border | `#D7D9D2` | Garis pembatas input/tabel |
| Neutral Background | `#F0F1EC` | Latar panel/section |
| Standard Chip Neutral | `#E9EAE4` (latar) / `#4A4F45` (teks) | Chip label standar (ISO 9001, dst.) |

### 3.1 Token Klasifikasi Dokumen (Domain 7 — Information Protection)

| Level | Warna Badge | Catatan |
|---|---|---|
| Public | `#8FA98C` (hijau muda netral) | Tanpa ikon gembok |
| Internal | `#6B93B0` (biru netral) | Tanpa ikon gembok |
| Restricted | `#C98A3E` (oranye tanah) | Ikon gembok terbuka |
| Confidential | `#B9563F` (merah bata) | Ikon gembok tertutup |
| Secret | `#7A3B3B` (merah gelap) | Ikon gembok tertutup + label tegas |
| Top Secret | `#2B2F29` (hitam/gelap) dengan teks putih | Ikon gembok tertutup + garis diagonal peringatan |

> Warna klasifikasi sengaja dibuat **berbeda skema** dari warna status siklus hidup (Bagian 6 di `03_DESIGN.md`) agar pengguna tidak salah membaca badge status sebagai badge klasifikasi, atau sebaliknya.

## 4. Tipografi

- **Jenis huruf**: sans-serif sistem (mis. Inter, Segoe UI, atau font korporat resmi).
- **Skala ukuran**: Judul halaman 18–20px bold; sub-judul/label 11–12px bold uppercase; body 12.5–13px regular; meta/caption 10–11px.

## 5. Ikonografi

- Set ikon garis tipis konsisten di seluruh modul.
- Ikon dipasangkan dengan label teks untuk aksi penting.
- Ikon gembok/shield khusus dipakai konsisten untuk seluruh indikator klasifikasi & proteksi (watermark, DRM, print/copy/download control) di manapun muncul di aplikasi.

## 6. Penggunaan Warna Status (Semantik)

| Status Dokumen | Warna |
|---|---|
| Draft | Neutral (abu) |
| Review | Amber |
| Approval | Amber/Oranye |
| Released | Success Green |
| Obsolete | Danger Red |
| Archive [roadmap] | Neutral Dark |
| Destroy [roadmap] | Danger Red dengan ikon peringatan |

## 7. Nada Bahasa (Tone of Voice)

- Formal namun jelas — sesuai konteks dokumen terkendali/audit multi-standar.
- Istilah umum lintas fungsi & lintas aplikasi: "Fungsi/Departemen", "Standar", "Aplikasi Consumer" (bukan nama aplikasi spesifik).
- Instruksi aksi ditulis imperatif singkat.
- Notifikasi AI selalu diberi label eksplisit "Rekomendasi AI".
- Peringatan klasifikasi tinggi (Secret/Top Secret) ditulis tegas, tidak ambigu (mis. "Dokumen ini Top Secret — pengunduhan dicatat dan dibatasi").

## 8. Logo & Aset Merek

- Logo yang tampil di topbar adalah **logo korporat/perusahaan**, bukan logo salah satu fungsi/departemen maupun logo aplikasi consumer manapun.
- Sediakan versi logo monokrom untuk header PDF dokumen released, termasuk watermark dinamis untuk dokumen terklasifikasi.
- Aset merek final harus disuplai oleh tim Corporate Communication sebelum go-live.
