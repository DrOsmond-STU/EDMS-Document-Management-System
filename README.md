# Enterprise Document Management System (EDMS)

**Repository:** https://github.com/DrOsmond-STU/EDMS-Document-Management-System

EDMS is an **Enterprise Document Governance platform** — a single source of truth for the full document lifecycle (create → review → approve → distribute → revise → archive → retain → dispose), designed to meet international management-system standards (ISO 9001, 14001, 45001, 27001, 22301, 37001, 31000, 15489/30301, SMK3, and others) from the design stage onward.

It is **not** a department-specific tool. It's positioned as a cross-functional platform consumed by every function in an organization (Quality, HSE, InfoSec, Legal, Finance, HR, IT, etc.), with other applications (ERP, HRIS, etc.) integrating as API consumers rather than owning document data themselves.

Target architecture: **10 functional domains / 30 modules** (Repository, Lifecycle Management, Records Management, Document Control, Enterprise Search, Governance & Compliance, Security Management, Collaboration, Analytics, Enterprise Platform). See `docs/01_PRD.md` for the full module-by-module status.

## ⚠️ Current status: prototype, not production-ready

This repository contains a **frontend-only React prototype** with no real backend — everything (documents, users, audit log) is stored in the browser's `localStorage`, and there is no real authentication (an explicit role/user switcher stands in for login). `docs/02_SECURITY.md` lists critical findings (no real authentication, no server-side authorization enforcement, no encryption/watermarking, etc.) that **must** be resolved before anything like this can be deployed as an organization's official EDMS — see that document's Section 12 checklist before any production deployment.

To avoid recreating the specific risk the security doc calls out (`AI API keys exposed in the client`), this build intentionally does **not** include the AI Assistant, Information Protection (encryption/watermark/DRM), Digital Signature, or Integration/API modules — those require a real backend and are left as roadmap items (see the "Roadmap" tags in the app's sidebar).

### What's implemented vs. roadmap

Covers the modules the PRD marks as already achievable (`docs/01_PRD.md` §5): Dashboard, Document Register with filters, automatic numbering, Draft→Review→Approval→Released→Obsolete workflow (Kanban board), version/revision history, the 8-stage Tracking Penyusunan Dokumen flow, Master Data, RBAC-gated UI (11 roles), Audit Trail, in-app Notification Center, and CSV reporting export.

Not implemented (roadmap, disabled in the sidebar with a "Roadmap" tag): Records Management, Compliance Matrix, Legal Register, Risk Register, Full-Text/Semantic Search & Knowledge Discovery, AI Assistant, Comment & Discussion, Integration/API, System Administration backend (backup, SSO/LDAP, etc.).

### Running locally

```bash
npm install
npm run dev       # dev server
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Documentation

The source documentation lives in `/docs`, written in Bahasa Indonesia:

| File | Contents |
|---|---|
| [`01_PRD.md`](docs/01_PRD.md) | Product Requirements Document — scope, 10 domains/30 modules, roles, KPIs, risk, phased roadmap |
| [`02_SECURITY.md`](docs/02_SECURITY.md) | Security requirements — **critical pre-production checklist**, IAM, classification levels, audit trail |
| [`03_DESIGN.md`](docs/03_DESIGN.md) | UI/UX design principles, information architecture, component patterns |
| [`04_ARCHITECTURE.md`](docs/04_ARCHITECTURE.md) | System architecture — current prototype vs. target per-domain production architecture |
| [`05_BRAND.md`](docs/05_BRAND.md) | Brand & visual style guide — color tokens, classification badge colors, typography |
| [`06_TESTING.md`](docs/06_TESTING.md) | Test plan — strategy, per-domain test scenarios, go/no-go release criteria |
| [`07_DEPLOYMENT.md`](docs/07_DEPLOYMENT.md) | Deployment guide — environments, infrastructure topology, CI/CD, rollout waves, rollback |
| [`08_TASK_INSTRUCTION.md`](docs/08_TASK_INSTRUCTION.md) | End-user SOP — step-by-step instructions per role (11 roles) |
| [`09_RUNBOOK.md`](docs/09_RUNBOOK.md) | Operations runbook — monitoring, incident response, backup/restore, maintenance schedule |

## Roles (RBAC)

11 roles: Requester, Document Drafter, Reviewer, Approver, Document Controller, Ratifier, Function/Department Head, Compliance & Risk Admin, System Administrator, Auditor (read-only), Viewer — plus two roadmap roles (Records Manager, Integrator) as Records Management and API integration come online.

## Standards coverage

ISO 15489, ISO 30301, ISO 9001, ISO 14001, ISO 45001, ISO/IEC 27001, ISO 22301, ISO 37001, ISO 31000, SMK3 (PP 50/2012), and Indonesian labor-ministry regulations — extensible via Master Data Standar without application changes.
