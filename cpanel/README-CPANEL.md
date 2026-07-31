# Cara Pasang EDMS di Shared Hosting cPanel

Paket ini adalah versi aplikasi yang sudah dibangun ulang backend-nya
menggunakan **PHP + MySQL** (bukan Node.js/Postgres), supaya bisa jalan di
hosting bersama biasa yang hanya mendukung PHP — tanpa perlu akses SSH,
tanpa perlu install Node.js apa pun.

Syarat hosting: PHP 7.4 ke atas, MySQL/MariaDB, `mod_rewrite` aktif.
Hampir semua paket shared hosting cPanel (Niagahoster, Hostinger,
IDCloudHost, dll.) sudah memenuhi ini secara default.

## 1. Buat Database MySQL

1. Login ke cPanel → buka **MySQL Databases**
2. Di bagian **Create New Database**, isi nama (mis. `edms`) → Create Database
   - Nama final biasanya otomatis jadi `namacpanelanda_edms`
3. Di bagian **MySQL Users → Add New User**, buat user + password → catat passwordnya
   - Nama final otomatis jadi `namacpanelanda_edmsuser`
4. Di bagian **Add User to Database**, pilih user & database yang barusan dibuat →
   centang **ALL PRIVILEGES** → Add

## 2. Isi Kredensial Database

Edit file **`api/_lib/config.php`** (bisa lewat cPanel File Manager, klik kanan → Edit),
isi 3 baris berikut sesuai hasil Langkah 1:

```php
'db_host' => 'localhost',
'db_name' => 'namacpanelanda_edms',
'db_user' => 'namacpanelanda_edmsuser',
'db_pass' => 'password_yang_tadi_dibuat',
```

Baris `app_password` boleh dibiarkan kosong (`''`) dulu — lihat bagian Opsional di bawah.

## 3. Upload Semua File

Upload **seluruh isi folder ini** (bukan foldernya sendiri, tapi isinya) ke
`public_html` (kalau untuk domain utama) atau ke folder subdomain/addon domain
Anda, lewat **File Manager** atau **FTP**. Strukturnya harus jadi seperti ini
di server:

```
public_html/
├── index.html
├── favicon.svg
├── .htaccess
├── assets/
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
├── api/
│   ├── state.php
│   ├── dispatch.php
│   ├── auth.php
│   ├── logout.php
│   └── _lib/
│       ├── config.php   (yang sudah Anda isi)
│       ├── db.php
│       ├── auth.php
│       ├── reducer.php
│       ├── seed.php
│       └── constants.php
└── schema.sql            (referensi saja, tidak wajib diupload)
```

Pastikan file **`.htaccess`** ikut ter-upload — ini file "tersembunyi", di File
Manager aktifkan dulu **Settings → Show Hidden Files**.

## 4. Buka Situsnya

Kunjungi domain/subdomain Anda. Tabel database dan 33 dokumen contoh akan
otomatis dibuat sendiri saat pertama kali diakses — tidak perlu import
`schema.sql` secara manual.

- Kalau langsung muncul Dashboard dengan data → berhasil.
- Kalau muncul "Gagal memuat data (HTTP 500)" → cek kembali isian
  `api/_lib/config.php`, kemungkinan nama database/user/password salah ketik.

## Opsional: Aktifkan Gerbang Password

Isi `'app_password' => 'password-pilihan-anda'` di `config.php` supaya
pengunjung harus login dengan password itu sebelum bisa akses/ubah data.
Password ini **berlaku untuk semua orang** (bukan akun per-orang) — cukup
untuk mencegah orang random di internet mengubah data, belum setara sistem
login sungguhan.

Gerbang ini butuh HTTPS supaya cookie sesi login tersimpan dengan aman di
browser. Kalau domain Anda belum HTTPS, aktifkan dulu **SSL/TLS Status →
AutoSSL** di cPanel (gratis, biasanya tinggal klik).

## Catatan Jujur

Sama seperti versi Vercel-nya: seluruh data disimpan sebagai satu blob JSON
di satu baris tabel (`app_state`), bukan tabel-tabel relasional per entitas.
Cukup untuk pemakaian prototipe/pilot dengan traffic wajar, tapi kalau nanti
ini jadi sistem produksi sungguhan dengan banyak pengguna bersamaan, struktur
data ini yang paling perlu dirombak lebih dulu.
