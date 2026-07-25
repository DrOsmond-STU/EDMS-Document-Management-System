# 09. Dokumen Runbook Operasional (Operations Runbook)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — operasional 10 domain) |
| Status | Panduan operasional tim IT/Support pasca-deployment |

---

## 1. Kontak & Eskalasi

| Peran | PIC | Kanal |
|---|---|---|
| Product Owner (tingkat korporat) | (isi nama) | (isi kontak) |
| Security Owner | (isi nama) | (isi kontak) |
| System Administrator on-call | (isi nama) | (isi kontak) |
| Database Administrator | (isi nama) | (isi kontak) |
| Compliance & Risk Admin | (isi nama) | (isi kontak) |
| Records Manager *(roadmap)* | (isi nama) | (isi kontak) |
| Integration/API Owner *(roadmap)* | (isi nama) | (isi kontak) |
| Vendor Infrastruktur (Cloud) | (isi nama) | (isi kontak) |

Eskalasi mengikuti urutan: **Helpdesk → System Administrator on-call → Security Owner (jika insiden keamanan) → Product Owner (jika berdampak bisnis luas)**.

## 2. Pemantauan (Monitoring)

| Metrik | Ambang Peringatan | Tindakan |
|---|---|---|
| Availability API Gateway & seluruh backend service domain | < 99.5% dalam 1 jam | Cek log service terkait, restart bila diperlukan |
| Latensi respons Register Dokumen | > 3 detik p95 | Cek beban database, indeks query |
| Latensi Search Service *(roadmap)* | > 3 detik p95 | Cek status indexing, beban search engine |
| Error rate 5xx | > 1% request | Investigasi log error, cek deployment terbaru |
| Kegagalan pengiriman notifikasi (WA/Email/Telegram/Teams/Slack) | > 5% dalam 1 jam | Cek status kredensial/kuota penyedia layanan |
| Kegagalan panggilan Anthropic API (Asisten AI) | > 5% dalam 1 jam | Cek status API, kuota, validitas kunci di Secret Manager |
| Penggunaan storage object | > 80% kapasitas | Rencanakan penambahan kapasitas / arsip data lama |
| Login gagal berulang dari 1 akun/IP | ≥ 5 kali dalam 10 menit | Kunci sementara akun, notifikasi Security Owner |
| Anomali akses lintas fungsi/klasifikasi | Setiap kejadian | Investigasi segera, laporkan ke Security Owner & Compliance Admin |
| Kegagalan job Retention/Archive *(roadmap)* | Setiap kejadian | Cek log Records Service, pastikan tidak ada dokumen yang gagal transisi/dispose tanpa approval |
| Kegagalan sinkronisasi integrasi (M365/GWS/LDAP) *(roadmap)* | > 5% dalam 1 jam | Cek status IdP/koneksi, cek log Platform Service |

## 3. Prosedur Backup & Restore

### 3.1 Backup
- Database: backup penuh harian + incremental setiap jam, retensi minimal 30 hari (sesuaikan kebijakan organisasi; ISO 27001 dapat mensyaratkan lebih panjang).
- Object storage: versioning aktif; snapshot berkala.
- Search index *(roadmap)*: snapshot indeks berkala; indeks dapat di-rebuild dari sumber dokumen bila korup.
- Secret Manager: konfigurasi dicadangkan sesuai prosedur vendor cloud.
- Seluruh backup **terenkripsi** dan disimpan terpisah dari sistem utama.

### 3.2 Restore
1. Konfirmasi cakupan insiden.
2. Pilih titik pemulihan (restore point) terakhir yang valid.
3. Restore ke lingkungan staging terlebih dahulu untuk verifikasi integritas data — termasuk relasi dokumen ↔ standar dan (bila sudah rilis) records/retention.
4. Setelah tervalidasi, lakukan restore ke produksi pada jendela maintenance yang dikomunikasikan ke seluruh fungsi.
5. Verifikasi pasca-restore: jumlah dokumen, integritas relasi antar dokumen, riwayat revisi, pemetaan kepatuhan, dan audit trail.
6. Dokumentasikan insiden dan hasil restore.

**Target**: RPO ≤ 1 jam, RTO ≤ 4 jam (sesuaikan kebutuhan bisnis organisasi; relevan dengan prinsip ISO 22301).

## 4. Prosedur Tanggap Insiden

| Tahap | Tindakan |
|---|---|
| Deteksi | Alert otomatis dari monitoring atau laporan pengguna dari fungsi manapun |
| Triase | Tentukan severity dan dampak (domain/fungsi/standar mana yang terdampak) |
| Containment | Isolasi komponen bermasalah (service domain terkait, bukan seluruh sistem) |
| Eradication | Perbaiki akar masalah |
| Recovery | Pulihkan layanan penuh |
| Post-mortem | Dokumentasikan kronologi, akar masalah, dan tindakan pencegahan dalam 3 hari kerja |

### Insiden Khusus: Kebocoran Kredensial
1. Cabut/rotasi kunci segera di penyedia layanan.
2. Perbarui secret di Secret Manager dan redeploy layanan terkait.
3. Audit log akses untuk memastikan tidak ada penyalahgunaan sebelum rotasi.
4. Laporkan ke Security Owner dan manajemen sesuai kebijakan pelaporan insiden organisasi.

### Insiden Khusus: Akses Dokumen Terklasifikasi Tidak Sah
1. Nonaktifkan sementara akses pengguna terkait.
2. Verifikasi cakupan dokumen yang terekspos berdasarkan audit trail (mencakup view/download/print/export).
3. Laporkan ke Compliance & Risk Admin fungsi terdampak dan Security Owner.
4. Perbarui matriks RBAC/ABAC atau kontrol Information Protection jika ditemukan celah konfigurasi.

### Insiden Khusus: Kegagalan Proses Pemusnahan Dokumen *(roadmap Records Management)*
1. Hentikan job disposal otomatis sementara.
2. Verifikasi tidak ada dokumen yang dimusnahkan tanpa approval berlapis yang sah.
3. Jika terjadi pemusnahan tidak sah, laporkan sebagai insiden compliance ke Compliance & Risk Admin dan, bila relevan, ke auditor eksternal terkait.

## 5. Troubleshooting Umum

| Gejala | Kemungkinan Penyebab | Tindakan |
|---|---|---|
| Notifikasi WA/Email/Teams/Slack tidak terkirim | Kredensial kedaluwarsa/kuota habis | Cek dashboard penyedia layanan, perbarui token/kredensial |
| Asisten AI tidak merespons | Kunci API tidak valid / rate limit / layanan Anthropic down | Cek status Anthropic, cek kuota, cek log AI Proxy Service |
| Pengguna tidak bisa login | Masalah SSO/IdP/LDAP, akun dinonaktifkan | Cek status IdP, cek status akun di Manajemen Pengguna |
| Dokumen tidak muncul di Register setelah Pengesahan | Kegagalan proses migrasi dari DraftingProject ke Document | Cek log Lifecycle Service, cek konsistensi data di DB |
| Hasil pencarian tidak akurat/kosong *(roadmap)* | Indeks search belum diperbarui / job indexing gagal | Trigger ulang indexing, cek log Search Service |
| Compliance Gap Dashboard menampilkan data tidak akurat *(roadmap)* | Cache pemetaan belum diperbarui / kegagalan job perhitungan | Trigger ulang job Governance Service, cek log |
| Foto/berkas evidence gagal terunggah | Kuota object storage penuh / ukuran file melebihi batas | Cek kapasitas storage, sesuaikan batas ukuran unggahan |
| Aplikasi consumer gagal memanggil API *(roadmap)* | Token OAuth2 kedaluwarsa/scope tidak sesuai | Cek status token di Platform Service, perbarui scope/kredensial |
| Halaman lambat saat jam sibuk lintas fungsi | Beban tinggi/kurang resource | Scale up replika service terkait, cek indeks database |

## 6. Prosedur Rilis Rutin (Non-Emergency Release)

1. Rilis dijadwalkan di luar jam operasional puncak.
2. Ikuti alur CI/CD pada `07_DEPLOYMENT.md` Bagian 5, per service domain yang dirilis.
3. Informasikan pengguna kunci dari seluruh fungsi terdampak minimal H-1 jika ada perubahan alur kerja.
4. Lakukan smoke test pasca-rilis sesuai `06_TESTING.md`.

## 7. Pemeliharaan Berkala

| Aktivitas | Frekuensi |
|---|---|
| Rotasi kredensial (API key, token bot, SMTP, OAuth2 client) | Minimal setiap 90 hari |
| Review hak akses pengguna (RBAC/ABAC) | Setiap kuartal |
| Uji restore dari backup | Setiap kuartal |
| Penetration test / security review | Minimal tahunan |
| Review dokumen mendekati kedaluwarsa | Sesuai siklus review masing-masing standar |
| Review kelengkapan Compliance Matrix per standar *(roadmap)* | Sebelum jadwal audit sertifikasi masing-masing standar |
| Review jadwal retensi & proses disposal *(roadmap Records Management)* | Sesuai kebijakan records management |
| Rebuild/optimasi search index *(roadmap)* | Sesuai pertumbuhan volume dokumen (mis. bulanan) |
| Review lisensi & kapasitas *(roadmap System Administration)* | Setiap kuartal |
| Arsip/pemusnahan dokumen sesuai retensi | Sesuai kebijakan records management |

## 8. Referensi Silang

- Keamanan: `02_SECURITY.md`
- Arsitektur: `04_ARCHITECTURE.md`
- Prosedur deployment & rollback: `07_DEPLOYMENT.md`
- Instruksi penggunaan per peran: `08_TASK_INSTRUCTION.md`
