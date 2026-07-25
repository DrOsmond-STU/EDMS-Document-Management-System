# 02. Dokumen Keamanan (Security Document)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — mengikuti Domain 7: Security Management) |
| Status | Wajib direview & disetujui sebelum deployment produksi |
| Klasifikasi Dokumen | Internal / Rahasia |

---

## 1. Tujuan

Menjabarkan kontrol keamanan Domain 7 (Security Management) yang wajib ada sebelum EDMS di-deploy ke produksi: Identity & Access Management (Modul 19), Information Protection (Modul 20), dan Audit Trail (Modul 21) — beserta kontrol pendukung lain (autentikasi, integrasi, AI, notifikasi).

## 2. Status Keamanan Prototipe Saat Ini — PERINGATAN KRITIS

Prototipe saat ini berbentuk **artifact frontend (React) tanpa backend nyata**. Risiko berikut **WAJIB** diselesaikan sebelum go-live:

| # | Temuan | Risiko | Wajib Sebelum Deploy? |
|---|---|---|---|
| 1 | Tidak ada login/autentikasi sungguhan — role dipilih manual dari dropdown | Siapa pun dapat "menjadi" peran apa pun tanpa verifikasi identitas | **YA** |
| 2 | Panggilan Claude API dilakukan langsung dari browser klien | Kunci API dapat terekspos/disalahgunakan | **YA** |
| 3 | Data tersimpan di storage bersama milik platform artifact | Bukan database transaksional perusahaan | **YA** |
| 4 | Tidak ada validasi/otorisasi sisi server untuk transisi status dokumen | RBAC hanya diberlakukan di UI, dapat dilewati | **YA** |
| 5 | Belum ada segregasi akses lintas fungsi/proyek/lokasi (ABAC) | Dokumen sensitif satu fungsi berisiko terlihat fungsi lain | **YA** |
| 6 | Belum ada Information Protection (Modul 20): enkripsi, watermark, DRM, print/copy/download control | Dokumen terklasifikasi tinggi (Confidential/Secret/Top Secret) tidak terlindungi | **YA** |
| 7 | Belum ada Digital Signature bersertifikat (PKI) | Tanda tangan kanvas saat ini tidak memiliki kekuatan hukum non-repudiation | **YA (untuk dokumen yang mensyaratkan tanda tangan legal)** |
| 8 | Kredensial WhatsApp/Email/Telegram/M365/Google Workspace belum ada | Kredensial produksi tidak boleh disimpan di klien | **YA (saat integrasi)** |
| 9 | Tidak ada enkripsi at-rest/in-transit yang dikelola khusus organisasi | Kerahasiaan dokumen lintas fungsi tidak terjamin | **YA** |

> **Kesimpulan:** Sistem dalam bentuk prototipe TIDAK BOLEH digunakan sebagai EDMS produksi resmi organisasi sampai seluruh butir di atas ditutup.

## 3. Autentikasi & Manajemen Identitas

- Implementasikan SSO korporat (SAML/OAuth2/OpenID Connect via Azure AD, Okta, atau IdP internal) dan/atau integrasi LDAP/Active Directory (Modul 28).
- Wajibkan **MFA** untuk peran Approver, Ratifier, System Administrator, Compliance & Risk Admin, dan Records Manager.
- Sesi login memiliki masa berlaku (idle timeout ≤ 30 menit) dan token refresh aman.
- Nonaktifkan akun otomatis setelah periode tidak aktif sesuai kebijakan HR/IT.

## 4. Otorisasi — Identity & Access Management (Modul 19)

- **RBAC**: matriks 11 peran (lihat `01_PRD.md` Bagian 7) ditegakkan **di backend/API**, bukan hanya UI.
- **ABAC (roadmap)**: kontrol akses tambahan berbasis atribut — departemen, proyek, site/lokasi — agar pengguna satu fungsi/proyek/lokasi tidak otomatis dapat mengubah dokumen fungsi/proyek/lokasi lain.
- **Multi-role**: satu pengguna dapat memiliki lebih dari satu peran di fungsi berbeda; hak akses efektif adalah gabungan (union) sesuai kebijakan least privilege.
- Dokumen dengan klasifikasi tinggi (Confidential/Secret/Top Secret) memerlukan izin akses eksplisit tambahan di luar RBAC/ABAC standar.
- Perubahan peran/hak akses memerlukan persetujuan berlapis (maker-checker), tercatat di audit trail.

## 5. Klasifikasi & Perlindungan Informasi (Modul 3 & 20)

### 5.1 Level Klasifikasi
| Level | Deskripsi | Kontrol Minimum |
|---|---|---|
| Public | Dapat diakses siapa pun | Tanpa batasan khusus |
| Internal | Hanya pengguna internal terautentikasi | Login wajib |
| Restricted | Hanya fungsi/unit kerja tertentu | RBAC/ABAC per fungsi |
| Confidential | Hanya individu dengan izin eksplisit | Akses granular per-dokumen, watermark |
| Secret | Akses sangat terbatas, butuh approval tambahan | Watermark, enkripsi khusus, print/download dibatasi |
| Top Secret | Akses individu bernama, dicatat setiap pembukaan | Semua kontrol Secret + logging setiap view, no-copy/no-print default |

### 5.2 Kontrol Perlindungan
| Kontrol | Ketentuan |
|---|---|
| Enkripsi in-transit | TLS 1.2+ untuk seluruh komunikasi klien-server dan integrasi pihak ketiga |
| Enkripsi at-rest | AES-256 atau setara untuk database dan object storage |
| Watermark | Watermark dinamis (nama pengguna, waktu akses) pada unduhan/cetak dokumen Confidential ke atas |
| DRM | Pembatasan berlaku pada dokumen yang keluar dari sistem (viewer terbatas, expiry link) |
| Print/Copy/Download Control | Dapat dinonaktifkan per level klasifikasi atau per dokumen |
| Data pribadi (SDM/Kemenaker) | Kontrol tambahan sesuai regulasi perlindungan data pribadi (mis. UU PDP) |
| Retensi & pemusnahan | Sesuai kebijakan records management (Domain 3) per jenis dokumen/standar; log pemusnahan tetap tersimpan |
| Backup | Terenkripsi, disimpan terpisah dari sistem utama |

## 6. Keamanan Integrasi AI (Asisten AI)

- **Wajib**: pindahkan seluruh pemanggilan Claude API dari klien ke **backend**; kunci API disimpan sebagai secret di secret manager.
- Terapkan rate limiting per pengguna.
- Terapkan validasi/sanitasi input untuk mengurangi risiko prompt injection.
- Output AI diperlakukan sebagai **saran**, bukan keputusan final — tetap memerlukan review manusia sebelum dokumen dirilis resmi.
- Jangan mengirim dokumen berklasifikasi Confidential ke atas ke layanan AI eksternal tanpa persetujuan kebijakan data organisasi.

## 7. Keamanan Notifikasi & Kolaborasi Multi-Kanal

- Kredensial WhatsApp Business API, SMTP/SendGrid, Telegram Bot API, Microsoft Teams, dan Slack disimpan sebagai secret di backend.
- Validasi nomor telepon/email penerima.
- Log seluruh notifikasi terkirim untuk keperluan audit.
- Komentar/diskusi inline (Modul 22, roadmap) tunduk pada kontrol akses dokumen yang sama — pengguna tanpa akses baca tidak dapat melihat/menulis komentar.

## 8. Keamanan Integrasi Enterprise (Modul 28)

- Integrasi LDAP/Active Directory, SSO, Microsoft 365, dan Google Workspace menggunakan protokol standar (SAML2/OAuth2/OIDC), kredensial di secret manager.
- REST API/Webhook untuk aplikasi consumer wajib menggunakan autentikasi token (OAuth2 client credentials/API key ber-scope), rate limiting, dan pencatatan pemanggilan di audit trail.
- Setiap integrasi baru melalui proses security review sebelum diaktifkan di produksi.

## 9. Audit Trail (Modul 21)

- Audit log mencakup minimal: aktor, aksi, entitas & ID, timestamp, alamat IP/asal request, fungsi/standar terkait dokumen.
- Cakupan aksi yang dicatat (target penuh sesuai Domain 7): login, upload, download, view, approval, delete, restore, export, print, sharing — bukan hanya create/transisi status/hapus seperti pada prototipe saat ini.
- Audit log bersifat **append-only**.
- Retensi log minimal sesuai kebijakan organisasi (≥ 3 tahun; ISO 27001 dapat mensyaratkan lebih panjang).
- Sediakan ekspor log per standar/fungsi untuk kebutuhan audit eksternal.

## 10. Keamanan Aplikasi (AppSec)

- Validasi input & output encoding untuk mencegah XSS/injection.
- CSRF protection pada seluruh operasi state-changing.
- Dependency scanning (SCA) dan SAST berkala.
- Penetration testing sebelum go-live dan berkala (minimal tahunan).
- Content Security Policy (CSP) aktif.

## 11. Tanggap Insiden

- Prosedur eskalasi insiden keamanan (lihat `09_RUNBOOK.md`).
- PIC keamanan (Security Owner) tingkat korporat menerima notifikasi anomali.
- Uji rencana pemulihan bencana (DR) minimal sekali sebelum go-live, selaras ISO 22301.

## 12. Checklist Kepatuhan Sebelum Deployment

- [ ] SSO/MFA aktif untuk seluruh peran kritis
- [ ] RBAC + ABAC lintas fungsi/proyek/lokasi ditegakkan di lapisan API/backend
- [ ] Klasifikasi dokumen 6 level aktif dengan kontrol sesuai Bagian 5.1
- [ ] Information Protection (enkripsi, watermark, DRM, print/copy/download control) aktif untuk dokumen Confidential ke atas
- [ ] Kunci API AI dipindah ke backend & disimpan sebagai secret
- [ ] Kredensial WA/Email/Telegram/Teams/Slack/M365/Google Workspace disimpan sebagai secret di backend
- [ ] TLS aktif di seluruh endpoint publik
- [ ] Enkripsi at-rest aktif untuk database & object storage
- [ ] Audit trail append-only mencakup seluruh aksi Bagian 9 & teruji
- [ ] Backup terenkripsi & rencana DR teruji
- [ ] Penetration test / security review selesai dengan temuan kritis tertutup
- [ ] Kebijakan retensi & klasifikasi dokumen disetujui oleh perwakilan seluruh fungsi pengguna
- [ ] Kontrol data pribadi untuk dokumen SDM/ketenagakerjaan disetujui tim legal/HR
