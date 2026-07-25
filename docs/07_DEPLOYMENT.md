# 07. Dokumen Panduan Deployment (Deployment Guide)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — cakupan integrasi & infrastruktur 10 domain) |
| Status | Wajib diikuti untuk seluruh deployment produksi, bertahap sesuai fase rilis modul |

---

## 1. Lingkungan (Environments)

| Lingkungan | Tujuan | Data |
|---|---|---|
| Development | Pengembangan fitur aktif | Data dummy/sintetis |
| Staging | UAT lintas fungsi, security testing, performance testing | Salinan data produksi yang di-mask/anonimkan |
| Production | Operasional resmi seluruh fungsi & aplikasi consumer organisasi | Data nyata dengan kontrol akses penuh |

## 2. Prasyarat Sebelum Deployment Produksi

- [ ] Seluruh checklist keamanan pada `02_SECURITY.md` Bagian 12 terpenuhi.
- [ ] Seluruh kriteria Go/No-Go pada `06_TESTING.md` Bagian 6 terpenuhi untuk modul dalam fase rilis terkait.
- [ ] Backend produksi terstruktur per domain sudah diimplementasikan sesuai `04_ARCHITECTURE.md`.
- [ ] Kredensial produksi (SSO, LDAP/AD, WA Business API, SMTP, Telegram Bot, Teams, Slack, Microsoft 365, Google Workspace, kunci Anthropic API) tersedia di Secret Manager.
- [ ] Rencana backup & DR sudah diuji (lihat `09_RUNBOOK.md`).
- [ ] Persetujuan sign-off dari Product Owner tingkat korporat, Security Owner, dan perwakilan seluruh fungsi pengguna.
- [ ] Master Data Standar (ISO 15489, 30301, 9001, 14001, 45001, 27001, 22301, 37001, 31000, SMK3, regulasi Kemenaker, dll.) sudah diinput dan disetujui Compliance & Risk Admin.
- [ ] Kebijakan klasifikasi 6 level (Public–Top Secret) dan kontrol Information Protection terkait sudah disetujui Security Owner.

## 3. Topologi Infrastruktur (Rekomendasi)

```
Internet
   │
   ▼
[ WAF / CDN ]
   │
   ▼
[ Load Balancer / API Gateway ] ──(TLS termination, OAuth2 untuk aplikasi consumer)
   │
   ▼
[ Backend Services per Domain (containerized, ≥2 replika per service untuk HA) ]
   │
   ├──► [ Relational DB (managed, replika baca + backup otomatis) ]
   ├──► [ Object Storage (S3-compatible, versioning aktif) ]
   ├──► [ Search Index Engine (full text/OCR/semantic) ]
   ├──► [ Message Queue (notifikasi & event async) ]
   ├──► [ Secret Manager ]
   └──► [ Integrasi eksternal: IdP, WA, SMTP, Telegram, Teams, Slack, M365, Google Workspace, Anthropic API ]
```

## 4. Variabel Lingkungan (Contoh)

| Variabel | Deskripsi |
|---|---|
| `DATABASE_URL` | Koneksi database produksi |
| `OBJECT_STORAGE_BUCKET` | Nama bucket penyimpanan berkas |
| `SEARCH_INDEX_ENDPOINT` | Endpoint mesin pencarian/indexing *(roadmap)* |
| `ANTHROPIC_API_KEY` | Kunci Claude API (hanya di backend) |
| `SSO_CLIENT_ID` / `SSO_CLIENT_SECRET` | Kredensial integrasi SSO |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD` | Kredensial integrasi LDAP/AD *(roadmap)* |
| `WA_BUSINESS_API_TOKEN` | Token WhatsApp Business API |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | Kredensial pengiriman email |
| `TELEGRAM_BOT_TOKEN` | Token bot Telegram |
| `TEAMS_WEBHOOK_URL` / `SLACK_BOT_TOKEN` | Kredensial notifikasi kolaborasi *(roadmap)* |
| `M365_CLIENT_ID` / `GWS_CLIENT_ID` | Kredensial integrasi Microsoft 365 / Google Workspace *(roadmap)* |
| `JWT_SECRET` | Secret penandatanganan token sesi |
| `LOG_LEVEL` | Tingkat verbositas logging |

> Seluruh variabel di atas WAJIB disimpan di Secret Manager, bukan file `.env` yang ikut ter-commit ke repositori.

## 5. Langkah Deployment (CI/CD)

1. **Build**: pipeline CI membangun image container per service domain, menjalankan unit test.
2. **Scan**: SAST + dependency scanning (SCA); build gagal jika ditemukan kerentanan kritis.
3. **Deploy ke Staging**: image di-deploy otomatis ke staging setelah lulus build & scan.
4. **UAT & Security Test di Staging**: dijalankan sesuai `06_TESTING.md`, melibatkan perwakilan seluruh fungsi pengguna & (bila relevan) tim aplikasi consumer.
5. **Approval Manual**: Product Owner, Security Owner, dan perwakilan fungsi menyetujui promosi ke produksi.
6. **Deploy ke Production**: strategi **blue-green** atau **canary** per service domain direkomendasikan agar rilis satu domain (mis. Search Service) tidak mengganggu domain lain.
7. **Smoke Test Pasca-Deploy**: verifikasi login, pembuatan dokumen dummy dari beberapa fungsi, notifikasi, Asisten AI, dan (bila sudah rilis) pemanggilan API oleh aplikasi consumer.
8. **Monitoring Aktif**: pantau metrik & log selama minimal 24 jam pertama pasca go-live.

## 6. Migrasi Data dari Prototipe

1. Ekspor seluruh data dokumen, revisi, pengguna, dan log dari prototipe.
2. Validasi & bersihkan data (hapus data dummy/percobaan) sebelum impor.
3. Petakan ulang atribut fungsi/departemen, standar, **dan level klasifikasi** agar konsisten dengan Master Data final.
4. Impor ke database produksi melalui skrip migrasi yang diuji di staging.
5. Verifikasi jumlah record, integritas relasi antar dokumen, riwayat revisi, dan pemetaan standar setelah migrasi.
6. Bekukan (freeze) prototipe lama setelah migrasi tervalidasi, sediakan mode read-only sementara.

## 7. Strategi Rollout Bertahap (Direkomendasikan untuk Skala Enterprise 10 Domain)

| Tahap | Cakupan Domain |
|---|---|
| Gelombang 1 (Fase 4 PRD) | D1 Repository, D2 Lifecycle (sequential approval), D7 IAM & audit trail dasar, D10 SSO/LDAP dasar |
| Gelombang 2 (Fase 5 PRD) | D6 Governance & Compliance, D4 Digital Signature & Check-in/Check-out |
| Gelombang 3 (Fase 6 PRD) | D3 Records Management, D5 Enterprise Search |
| Gelombang 4 (Fase 7 PRD) | D8 Collaboration, D10 Integration penuh (API/Webhook/M365/GWS/Teams/Slack) |

## 8. Rencana Rollback

| Skenario | Tindakan |
|---|---|
| Bug kritis pada satu domain service | Rollback service domain terkait (blue-green swap) tanpa mengganggu domain lain |
| Masalah pada migrasi data | Restore database dari backup pra-migrasi |
| Integrasi eksternal gagal (WA/Email/AI/M365/GWS) | Nonaktifkan fitur terkait via feature flag tanpa rollback penuh sistem |

## 9. Komunikasi Go-Live

- Umumkan jadwal go-live & potensi downtime ke seluruh fungsi organisasi dan pemilik aplikasi consumer yang terintegrasi, minimal H-3.
- Sediakan kanal dukungan (helpdesk/PIC) selama minggu pertama pasca go-live untuk seluruh fungsi.
- Sediakan materi pelatihan singkat per peran (lihat `08_TASK_INSTRUCTION.md`).

## 10. Checklist Akhir Sebelum "Go" (per Fase Rilis)

- [ ] Semua item Bagian 2 (Prasyarat) untuk domain dalam fase terkait selesai
- [ ] Smoke test produksi lulus untuk dokumen dari beberapa fungsi berbeda
- [ ] Monitoring & alerting aktif untuk service domain yang dirilis
- [ ] Tim on-call siap sesuai `09_RUNBOOK.md`
- [ ] Rencana rollback dikomunikasikan ke tim teknis
- [ ] Sign-off akhir dari Product Owner tingkat korporat
