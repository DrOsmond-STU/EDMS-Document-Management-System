# 04. Dokumen Arsitektur Sistem (Architecture Document)
## Enterprise Document Management System (EDMS)

| Item | Keterangan |
|---|---|
| Versi | 2.0 (revisi besar — arsitektur target 10 domain layanan) |
| Status | Arsitektur prototipe saat ini + target arsitektur produksi enterprise |

---

## 1. Arsitektur Prototipe Saat Ini

```
┌───────────────────────────────────────────┐
│           Browser Pengguna                 │
│  ┌───────────────────────────────────┐    │
│  │   React App (EDMS front-end)       │    │
│  │   - UI seluruh modul yang ada      │    │
│  │   - Logika workflow di klien       │    │
│  │   - Panggilan Claude API langsung  │───┼──► Anthropic API
│  └───────────────────────────────────┘    │
│              │  window.storage             │
│              ▼                             │
│  ┌────────────────────────────────────┐    │
│  │  Artifact Key-Value Storage        │    │
│  └───────────────────────────────────┘    │
└───────────────────────────────────────────┘
```

Cocok untuk demo/validasi kebutuhan, **tidak cocok untuk operasional resmi enterprise 10 domain/30 modul**.

## 2. Target Arsitektur Produksi — Modular per Domain

```
                       ┌──────────────┐
                       │  Web Client   │
                       │ (React SPA)   │
                       └──────┬───────┘
                              │ HTTPS/TLS
                              ▼
                ┌───────────────────────────┐
                │  API Gateway / Load Balancer│
                └──────────────┬─────────────┘
                                │
     ┌──────────────────────────────────────────────────────────────┐
     │                     Backend Services (per Domain)                │
     │                                                                    │
     │  D1 Repository Svc   D2 Lifecycle Svc     D3 Records Svc          │
     │  D4 Control Svc      D5 Search Svc        D6 Governance Svc       │
     │  D7 Security Svc     D8 Collaboration Svc D9 Analytics Svc        │
     │  D10 Platform Svc (Integration, Master Data, SysAdmin)            │
     └──┬───────────┬────────────┬───────────────┬──────────┬─────────┘
         │           │            │               │          │
         ▼           ▼            ▼               ▼          ▼
 ┌──────────┐ ┌─────────────┐ ┌──────────┐ ┌─────────────┐ ┌────────────┐
 │Relational│ │Object Storage│ │Search Idx│ │Secret Manager│ │Message Queue│
 │   DB     │ │ (S3, versioning)│(OCR/  │ │ (API keys,   │ │(notifikasi, │
 │          │ │              │ semantic)│ │ kredensial)  │ │ event async)│
 └──────────┘ └─────────────┘ └──────────┘ └─────────────┘ └────────────┘
                                    │
                                    ▼
     ┌───────────────────────────────────────────────────────────────┐
     │                  Integrasi Eksternal (Domain 10)                  │
     │  IdP (SSO/LDAP/AD) · WhatsApp · SMTP · Telegram · MS Teams ·      │
     │  Slack · Microsoft 365 · Google Workspace · Anthropic API ·       │
     │  Aplikasi Consumer (ERP/HRIS/dsb.) via REST API/Webhook           │
     └──────────────────────────────────────────────────────────────┘
```

## 3. Layanan per Domain

| Domain | Layanan Backend | Tanggung Jawab Utama |
|---|---|---|
| D1 Enterprise Document Repository | Repository Service | Penyimpanan terpusat, folder virtual, metadata, tag, preview/thumbnail |
| D2 Document Lifecycle Management | Lifecycle Service | Authoring, version management, review, approval workflow (sequential/parallel/conditional) |
| D3 Records Management | Records Service | Records register, jadwal retensi, archive (active/inactive/permanent), disposal & approval pemusnahan |
| D4 Document Control | Control Service | Distribusi & acknowledgement, check-in/check-out, digital signature (PKI) |
| D5 Enterprise Search | Search Service | Full text/OCR/semantic search, knowledge discovery (similar/related/recommendation) |
| D6 Governance & Compliance | Governance Service | Penomoran, template, naming convention, compliance mapping, legal register |
| D7 Security Management | Security Service | IAM (RBAC/ABAC), information protection (enkripsi/watermark/DRM), audit trail |
| D8 Collaboration | Collaboration Service | Comment & discussion, task management, notification center (multi-kanal) |
| D9 Analytics | Analytics Service | Dashboard, reporting, KPI monitoring (SLA approval/review, kepatuhan) |
| D10 Enterprise Platform | Platform Service | Integration (API/webhook/LDAP/SSO/M365/GWS), master data, system administration |

Setiap layanan dapat dikembangkan/dirilis secara modular (mengikuti roadmap fase pada `01_PRD.md` Bagian 11), namun seluruhnya berbagi **satu skema data dokumen inti** agar tetap menjadi single source of truth.

## 4. Model Data (Ringkasan Entitas Lintas Domain)

- `Document` (1) — (N) `Revision` — mendukung Compare Version [roadmap]
- `Document` (N) — (N) `Document` (relasi: supersedes, references, relatedTo, parentDocument)
- `Document` (N) — (N) `Standard`, dan `Standard` (1) — (N) `Clause` — (N) — (N) `Document` melalui `ComplianceMapping` [roadmap]
- `Document` (1) — (N) `Record` [roadmap] — `Record` (N) — (1) `RetentionSchedule` — `Record` dapat berpindah status Active/Inactive/Permanent Archive [roadmap]
- `Document` (1) — (N) `AccessGrant` (izin akses eksplisit untuk klasifikasi Confidential ke atas)
- `Document` (1) — (N) `DistributionRecord` (acknowledgement per penerima) [roadmap]
- `Document` (1) — (N) `Comment` [roadmap]
- `Risk` (N) — (N) `Document` (kontrol mitigasi) [roadmap]
- `DraftingProject` (1) — (N) `Meeting` — (N) `Attendee`, `Photo`, `MinutesEvidence`
- `User` (N) — (N) `Role`, dan `User` (N) — (N) `Attribute` (departemen/proyek/lokasi, untuk ABAC) [roadmap]
- `Document` (1) — (N) `Notification`
- Setiap perubahan pada entitas di atas menghasilkan 1 entri `AuditLog` (mencakup login, upload, download, view, approval, delete, restore, export, print, sharing)

## 5. Alur Data Kritis (Sequence Ringkas)

**Pengesahan Dokumen (Tracking Penyusunan → Register Utama):**
1. Klien mengirim aksi "Sahkan Dokumen" ke Lifecycle Service.
2. Lifecycle Service memvalidasi peran (Ratifier) & kelengkapan tahap.
3. Lifecycle Service membuat `Document` baru berstatus `Released`, Revisi 0, dengan `Standard` terkait.
4. Governance Service memicu pembaruan `ComplianceMapping` terkait [roadmap].
5. Records Service menetapkan `RetentionSchedule` awal berdasarkan jenis dokumen [roadmap].
6. Security Service mencatat `AuditLog`; Collaboration Service mengirim `Notification`.

**Full Text/Semantic Search** [roadmap]:
1. Setiap dokumen yang di-release diindeks oleh Search Service (ekstraksi teks, OCR bila berkas gambar/scan, embedding untuk semantic search).
2. Query pengguna dicocokkan terhadap indeks metadata + full text + embedding, hasil diberi skor relevansi.
3. Knowledge Discovery menyarankan dokumen serupa/terkait berdasarkan kemiripan embedding dan pola akses.

**Integrasi Aplikasi Consumer via API** [roadmap]:
1. Aplikasi consumer (mis. ERP/HRIS) melakukan autentikasi via OAuth2 client credentials ke Platform Service.
2. Aplikasi consumer memanggil REST API (mis. `GET /documents?standard=ISO9001`) atau menerima event via Webhook (mis. dokumen baru di-release).
3. Seluruh pemanggilan tercatat di Audit Trail sebagai aktivitas non-manusia (service account).

## 6. Strategi Deployment Infrastruktur

Lihat `07_DEPLOYMENT.md`.

## 7. Keputusan Arsitektur Utama (ADR Ringkas)

| Keputusan | Alasan |
|---|---|
| Backend disusun per-domain (bukan monolit tunggal atau frontend-only) | Selaras dengan 10 domain fungsional; memungkinkan rilis modular sesuai roadmap fase |
| Skema data dokumen inti dibagi lintas seluruh domain | Menjaga prinsip Single Source of Truth meski layanan terpisah |
| Search Service terpisah dengan indeks khusus (bukan query LIKE di RDBMS) | Diperlukan untuk full text/OCR/semantic search skala enterprise |
| Records/Retention sebagai domain terpisah dari Lifecycle | ISO 15489/30301 mensyaratkan siklus records berbeda dari siklus dokumen kendali biasa (butuh disposal & approval pemusnahan khusus) |
| Integration Service menyediakan REST API & Webhook standar | Menegakkan prinsip Open Integration Platform — aplikasi lain menjadi consumer, bukan pemilik data dokumen |
| AI dipanggil dari backend, bukan klien | Wajib untuk keamanan kunci API dan kontrol biaya/kuota |
| Audit log append-only di penyimpanan terpisah | Mencegah manipulasi log bahkan oleh Administrator |
| Message Queue untuk notifikasi & event async | Menghindari backend utama terblokir saat mengirim ke WA/Email/Telegram/Teams/Slack yang lambat/tidak stabil |
