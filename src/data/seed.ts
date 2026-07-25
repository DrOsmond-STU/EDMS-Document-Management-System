import type {
  AppNotification,
  AuditLogEntry,
  ClassificationLevel,
  DocumentStatus,
  DocumentType,
  DraftingProject,
  EdmsDocument,
  FunctionDept,
  Revision,
  Standard,
  User,
  ValidityStatus,
} from '../types'
import { DOCUMENT_TYPE_CODE } from '../constants'

export const FUNCTIONS: FunctionDept[] = [
  { id: 'qa', name: 'Quality Assurance' },
  { id: 'hsse', name: 'Health, Safety & Environment' },
  { id: 'infosec', name: 'Information Security' },
  { id: 'hc', name: 'Human Capital' },
  { id: 'legal', name: 'Legal & Compliance' },
  { id: 'finance', name: 'Finance' },
  { id: 'procurement', name: 'Procurement' },
  { id: 'it', name: 'Information Technology' },
  { id: 'engineering', name: 'Engineering' },
  { id: 'ops', name: 'Operations' },
]

export const STANDARDS: Standard[] = [
  { code: 'ISO9001', name: 'ISO 9001 — Quality Management' },
  { code: 'ISO14001', name: 'ISO 14001 — Environmental Management' },
  { code: 'ISO45001', name: 'ISO 45001 — Occupational Health & Safety' },
  { code: 'ISO27001', name: 'ISO/IEC 27001 — Information Security' },
  { code: 'ISO22301', name: 'ISO 22301 — Business Continuity' },
  { code: 'ISO37001', name: 'ISO 37001 — Anti-Bribery' },
  { code: 'ISO31000', name: 'ISO 31000 — Risk Management' },
  { code: 'ISO15489', name: 'ISO 15489 — Records Management' },
  { code: 'SMK3', name: 'SMK3 (PP 50/2012)' },
]

export const USERS: User[] = [
  { id: 'u1', name: 'Rangga Pradipta', email: 'rangga.pradipta@company.example', functionId: 'qa', roles: ['requester', 'drafter'], active: true },
  { id: 'u2', name: 'Siti Marlina', email: 'siti.marlina@company.example', functionId: 'qa', roles: ['reviewer'], active: true },
  { id: 'u3', name: 'Bayu Kusuma', email: 'bayu.kusuma@company.example', functionId: 'qa', roles: ['approver', 'function_head'], active: true },
  { id: 'u4', name: 'Dewi Anggraini', email: 'dewi.anggraini@company.example', functionId: 'legal', roles: ['controller'], active: true },
  { id: 'u5', name: 'Fajar Nugroho', email: 'fajar.nugroho@company.example', functionId: 'legal', roles: ['ratifier'], active: true },
  { id: 'u6', name: 'Intan Permatasari', email: 'intan.permatasari@company.example', functionId: 'infosec', roles: ['compliance_admin'], active: true },
  { id: 'u7', name: 'Wahyu Setiawan', email: 'wahyu.setiawan@company.example', functionId: 'it', roles: ['sysadmin'], active: true },
  { id: 'u8', name: 'Ratna Sari', email: 'ratna.sari@company.example', functionId: 'hc', roles: ['auditor'], active: true },
  { id: 'u9', name: 'Agus Prasetyo', email: 'agus.prasetyo@company.example', functionId: 'hsse', roles: ['drafter', 'requester'], active: true },
  { id: 'u10', name: 'Novita Handayani', email: 'novita.handayani@company.example', functionId: 'hsse', roles: ['reviewer'], active: true },
  { id: 'u11', name: 'Yusuf Hidayat', email: 'yusuf.hidayat@company.example', functionId: 'finance', roles: ['function_head', 'approver'], active: true },
  { id: 'u12', name: 'Citra Wulandari', email: 'citra.wulandari@company.example', functionId: 'procurement', roles: ['requester'], active: true },
  { id: 'u13', name: 'Doni Firmansyah', email: 'doni.firmansyah@company.example', functionId: 'engineering', roles: ['drafter'], active: true },
  { id: 'u14', name: 'Lestari Wijaya', email: 'lestari.wijaya@company.example', functionId: 'ops', roles: ['viewer'], active: true },
  { id: 'u15', name: 'Hendra Gunawan', email: 'hendra.gunawan@company.example', functionId: 'it', roles: ['reviewer', 'sysadmin'], active: true },
  { id: 'u16', name: 'Putri Ramadhani', email: 'putri.ramadhani@company.example', functionId: 'qa', roles: ['viewer'], active: false },
]

function daysFromToday(days: number): string {
  // Reference "today" fixed to the session's current date for reproducible demo data.
  const today = new Date('2026-07-25T00:00:00Z')
  const d = new Date(today)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

let seq: Record<string, number> = {}
function nextCode(type: DocumentType, functionId: string): string {
  const key = `${DOCUMENT_TYPE_CODE[type]}-${functionId.toUpperCase()}`
  seq[key] = (seq[key] ?? 0) + 1
  return `${key}-${String(seq[key]).padStart(3, '0')}`
}

interface SeedInput {
  title: string
  type: DocumentType
  functionId: string
  standards: string[]
  classification: ClassificationLevel
  status: DocumentStatus
  validity: ValidityStatus
  owner: string
  keywords: string[]
  effectiveOffset?: number
  reviewOffset?: number
  expiryOffset?: number
}

const seedInputs: SeedInput[] = [
  { title: 'Kebijakan Mutu Perusahaan', type: 'Kebijakan', functionId: 'qa', standards: ['ISO9001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Bayu Kusuma', keywords: ['kebijakan', 'mutu'], effectiveOffset: -400, reviewOffset: 320, expiryOffset: 1200 },
  { title: 'Manual Sistem Manajemen Mutu', type: 'Manual', functionId: 'qa', standards: ['ISO9001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Bayu Kusuma', keywords: ['manual', 'mutu'], effectiveOffset: -380, reviewOffset: 340, expiryOffset: 1220 },
  { title: 'SOP Pengendalian Dokumen', type: 'SOP', functionId: 'qa', standards: ['ISO9001', 'ISO15489'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Rangga Pradipta', keywords: ['sop', 'dokumen'], effectiveOffset: -200, reviewOffset: 45, expiryOffset: 700 },
  { title: 'SOP Audit Internal', type: 'SOP', functionId: 'qa', standards: ['ISO9001', 'ISO27001'], classification: 'internal', status: 'review', validity: 'belum_berlaku', owner: 'Rangga Pradipta', keywords: ['sop', 'audit'] },
  { title: 'Formulir Permintaan Tindakan Korektif', type: 'Formulir', functionId: 'qa', standards: ['ISO9001'], classification: 'internal', status: 'draft', validity: 'belum_berlaku', owner: 'Siti Marlina', keywords: ['formulir', 'capa'] },
  { title: 'Kebijakan Keselamatan & Kesehatan Kerja', type: 'Kebijakan', functionId: 'hsse', standards: ['ISO45001', 'SMK3'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Agus Prasetyo', keywords: ['k3', 'kebijakan'], effectiveOffset: -500, reviewOffset: 20, expiryOffset: 900 },
  { title: 'SOP Tanggap Darurat', type: 'SOP', functionId: 'hsse', standards: ['ISO45001', 'SMK3', 'ISO22301'], classification: 'internal', status: 'released', validity: 'kadaluarsa', owner: 'Agus Prasetyo', keywords: ['darurat', 'k3'], effectiveOffset: -900, reviewOffset: -30, expiryOffset: -10 },
  { title: 'Work Instruction Penggunaan APD', type: 'Work Instruction', functionId: 'hsse', standards: ['ISO45001', 'SMK3'], classification: 'public', status: 'released', validity: 'berlaku', owner: 'Novita Handayani', keywords: ['apd', 'wi'], effectiveOffset: -150, reviewOffset: 210, expiryOffset: 600 },
  { title: 'Manual Sistem Manajemen Lingkungan', type: 'Manual', functionId: 'hsse', standards: ['ISO14001'], classification: 'internal', status: 'review', validity: 'belum_berlaku', owner: 'Agus Prasetyo', keywords: ['lingkungan', 'manual'] },
  { title: 'Kebijakan Keamanan Informasi', type: 'Kebijakan', functionId: 'infosec', standards: ['ISO27001'], classification: 'restricted', status: 'released', validity: 'berlaku', owner: 'Intan Permatasari', keywords: ['keamanan', 'informasi'], effectiveOffset: -250, reviewOffset: 15, expiryOffset: 800 },
  { title: 'SOP Manajemen Insiden Keamanan Informasi', type: 'SOP', functionId: 'infosec', standards: ['ISO27001'], classification: 'confidential', status: 'released', validity: 'berlaku', owner: 'Intan Permatasari', keywords: ['insiden', 'keamanan'], effectiveOffset: -120, reviewOffset: 60, expiryOffset: 450 },
  { title: 'Prosedur Klasifikasi & Penanganan Informasi', type: 'SOP', functionId: 'infosec', standards: ['ISO27001'], classification: 'confidential', status: 'approval', validity: 'belum_berlaku', owner: 'Intan Permatasari', keywords: ['klasifikasi', 'informasi'] },
  { title: 'Kebijakan Akses Sistem — Level Direksi', type: 'Kebijakan', functionId: 'infosec', standards: ['ISO27001'], classification: 'secret', status: 'released', validity: 'berlaku', owner: 'Intan Permatasari', keywords: ['akses', 'direksi'], effectiveOffset: -60, reviewOffset: 300, expiryOffset: 730 },
  { title: 'Kebijakan Rekrutmen & Seleksi', type: 'Kebijakan', functionId: 'hc', standards: ['ISO9001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Ratna Sari', keywords: ['rekrutmen', 'hc'], effectiveOffset: -600, reviewOffset: 90, expiryOffset: 1000 },
  { title: 'SOP Penilaian Kinerja Karyawan', type: 'SOP', functionId: 'hc', standards: ['ISO9001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Ratna Sari', keywords: ['kinerja', 'penilaian'], effectiveOffset: -300, reviewOffset: 10, expiryOffset: 500 },
  { title: 'Formulir Evaluasi Pelatihan', type: 'Formulir', functionId: 'hc', standards: ['ISO9001'], classification: 'internal', status: 'draft', validity: 'belum_berlaku', owner: 'Ratna Sari', keywords: ['pelatihan', 'formulir'] },
  { title: 'Data Pribadi Karyawan — Panduan Penanganan', type: 'Manual', functionId: 'hc', standards: ['ISO27001'], classification: 'secret', status: 'released', validity: 'berlaku', owner: 'Ratna Sari', keywords: ['data pribadi', 'karyawan'], effectiveOffset: -80, reviewOffset: 5, expiryOffset: 365 },
  { title: 'Kebijakan Anti Penyuapan', type: 'Kebijakan', functionId: 'legal', standards: ['ISO37001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Fajar Nugroho', keywords: ['anti suap', 'kebijakan'], effectiveOffset: -700, reviewOffset: 100, expiryOffset: 1100 },
  { title: 'SOP Penanganan Gratifikasi', type: 'SOP', functionId: 'legal', standards: ['ISO37001'], classification: 'restricted', status: 'released', validity: 'berlaku', owner: 'Fajar Nugroho', keywords: ['gratifikasi', 'sop'], effectiveOffset: -180, reviewOffset: 25, expiryOffset: 550 },
  { title: 'Register Kontrak & Perjanjian — Panduan', type: 'Manual', functionId: 'legal', standards: ['ISO37001'], classification: 'confidential', status: 'review', validity: 'belum_berlaku', owner: 'Dewi Anggraini', keywords: ['kontrak', 'legal'] },
  { title: 'Kebijakan Manajemen Risiko Korporat', type: 'Kebijakan', functionId: 'legal', standards: ['ISO31000'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Fajar Nugroho', keywords: ['risiko', 'kebijakan'], effectiveOffset: -220, reviewOffset: 40, expiryOffset: 650 },
  { title: 'SOP Rekonsiliasi Keuangan Bulanan', type: 'SOP', functionId: 'finance', standards: ['ISO9001'], classification: 'restricted', status: 'released', validity: 'berlaku', owner: 'Yusuf Hidayat', keywords: ['keuangan', 'rekonsiliasi'], effectiveOffset: -140, reviewOffset: 8, expiryOffset: 400 },
  { title: 'Kebijakan Pengendalian Anggaran', type: 'Kebijakan', functionId: 'finance', standards: ['ISO9001', 'ISO37001'], classification: 'restricted', status: 'obsolete', validity: 'tidak_berlaku', owner: 'Yusuf Hidayat', keywords: ['anggaran', 'kebijakan'] },
  { title: 'SOP Seleksi & Evaluasi Vendor', type: 'SOP', functionId: 'procurement', standards: ['ISO9001', 'ISO37001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Citra Wulandari', keywords: ['vendor', 'procurement'], effectiveOffset: -260, reviewOffset: 55, expiryOffset: 730 },
  { title: 'Formulir Permintaan Pembelian', type: 'Formulir', functionId: 'procurement', standards: ['ISO9001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Citra Wulandari', keywords: ['pembelian', 'formulir'], effectiveOffset: -90, reviewOffset: 275, expiryOffset: 640 },
  { title: 'Kebijakan Keamanan Sistem Informasi & Jaringan', type: 'Kebijakan', functionId: 'it', standards: ['ISO27001'], classification: 'confidential', status: 'released', validity: 'berlaku', owner: 'Wahyu Setiawan', keywords: ['jaringan', 'keamanan'], effectiveOffset: -170, reviewOffset: 12, expiryOffset: 500 },
  { title: 'SOP Backup & Restore Data', type: 'SOP', functionId: 'it', standards: ['ISO27001', 'ISO22301'], classification: 'restricted', status: 'released', validity: 'berlaku', owner: 'Wahyu Setiawan', keywords: ['backup', 'restore'], effectiveOffset: -100, reviewOffset: 18, expiryOffset: 420 },
  { title: 'Business Continuity Plan — Data Center', type: 'Manual', functionId: 'it', standards: ['ISO22301'], classification: 'secret', status: 'approval', validity: 'belum_berlaku', owner: 'Wahyu Setiawan', keywords: ['bcp', 'data center'] },
  { title: 'Prosedur Manajemen Perubahan Sistem', type: 'SOP', functionId: 'it', standards: ['ISO27001'], classification: 'internal', status: 'draft', validity: 'belum_berlaku', owner: 'Hendra Gunawan', keywords: ['change management'] },
  { title: 'Spesifikasi Teknis Peralatan Produksi', type: 'Manual', functionId: 'engineering', standards: ['ISO9001'], classification: 'restricted', status: 'released', validity: 'berlaku', owner: 'Doni Firmansyah', keywords: ['teknis', 'peralatan'], effectiveOffset: -310, reviewOffset: 65, expiryOffset: 900 },
  { title: 'SOP Pemeliharaan Preventif Mesin', type: 'SOP', functionId: 'engineering', standards: ['ISO9001', 'ISO45001'], classification: 'internal', status: 'released', validity: 'berlaku', owner: 'Doni Firmansyah', keywords: ['pemeliharaan', 'mesin'], effectiveOffset: -190, reviewOffset: 3, expiryOffset: 480 },
  { title: 'Work Instruction Operasional Gudang', type: 'Work Instruction', functionId: 'ops', standards: ['ISO9001'], classification: 'public', status: 'released', validity: 'berlaku', owner: 'Lestari Wijaya', keywords: ['gudang', 'operasional'], effectiveOffset: -75, reviewOffset: 290, expiryOffset: 680 },
  { title: 'Rencana Kesinambungan Bisnis — Operasional', type: 'Manual', functionId: 'ops', standards: ['ISO22301'], classification: 'top_secret', status: 'released', validity: 'berlaku', owner: 'Yusuf Hidayat', keywords: ['bcp', 'operasional'], effectiveOffset: -45, reviewOffset: 320, expiryOffset: 900 },
]

export const DOCUMENTS: EdmsDocument[] = seedInputs.map((input, i) => {
  const code = nextCode(input.type, input.functionId)
  const createdAt = daysFromToday((input.effectiveOffset ?? -60) - 20)
  const updatedAt = daysFromToday((input.effectiveOffset ?? -30) - 2)
  return {
    id: `doc-${i + 1}`,
    code,
    title: input.title,
    type: input.type,
    functionId: input.functionId,
    standards: input.standards,
    classification: input.classification,
    status: input.status,
    validity: input.validity,
    version: input.status === 'released' || input.status === 'obsolete' ? '1.0' : '0.1',
    revisionNumber: input.status === 'released' || input.status === 'obsolete' ? 1 : 0,
    effectiveDate: input.effectiveOffset !== undefined ? daysFromToday(input.effectiveOffset) : null,
    reviewDate: input.reviewOffset !== undefined ? daysFromToday(input.reviewOffset) : null,
    expiryDate: input.expiryOffset !== undefined ? daysFromToday(input.expiryOffset) : null,
    keywords: input.keywords,
    content: `Ringkasan konten untuk "${input.title}". Dokumen ini mengacu pada standar ${input.standards.join(', ')} dan berlaku untuk fungsi terkait.`,
    owner: input.owner,
    relations: [],
    createdAt,
    updatedAt,
  }
})

export const REVISIONS: Revision[] = DOCUMENTS.flatMap((doc) => {
  const revisions: Revision[] = []
  revisions.push({
    id: `${doc.id}-rev0`,
    documentId: doc.id,
    revisionNumber: 0,
    version: '0.1',
    date: doc.createdAt,
    editor: doc.owner,
    notes: 'Draf awal disusun.',
    status: 'draft',
    contentSnapshot: `Draf awal: ${doc.title}`,
  })
  if (doc.status === 'released' || doc.status === 'obsolete' || doc.status === 'approval') {
    revisions.push({
      id: `${doc.id}-rev1`,
      documentId: doc.id,
      revisionNumber: 1,
      version: '1.0',
      date: doc.updatedAt,
      editor: doc.owner,
      notes: 'Revisi final pasca-review.',
      status: doc.status,
      contentSnapshot: doc.content,
    })
  }
  return revisions
})

export const DRAFTING_PROJECTS: DraftingProject[] = [
  {
    id: 'dp-1',
    requestNumber: 'REQ-2026-014',
    documentTitle: 'SOP Manajemen Perubahan Kontraktor',
    documentType: 'SOP',
    functionId: 'hsse',
    standards: ['ISO45001', 'SMK3'],
    initialClassification: 'internal',
    reason: 'Belum ada SOP baku untuk kontraktor yang bekerja di area berisiko tinggi.',
    requester: 'Agus Prasetyo',
    currentStage: 'rapat',
    meetings: [
      { id: 'm1', sessionNumber: 1, date: daysFromToday(-14), budget: 1500000, hasPhotoEvidence: true, hasMinutesEvidence: true, attendees: ['Agus Prasetyo', 'Novita Handayani', 'Bayu Kusuma'], signaturesCollected: true },
      { id: 'm2', sessionNumber: 2, date: daysFromToday(-3), budget: 800000, hasPhotoEvidence: true, hasMinutesEvidence: false, attendees: ['Agus Prasetyo', 'Novita Handayani'], signaturesCollected: false },
    ],
    createdAt: daysFromToday(-25),
    updatedAt: daysFromToday(-3),
  },
  {
    id: 'dp-2',
    requestNumber: 'REQ-2026-015',
    documentTitle: 'Kebijakan Pengelolaan Vendor Kritis',
    documentType: 'Kebijakan',
    functionId: 'procurement',
    standards: ['ISO9001', 'ISO37001'],
    initialClassification: 'restricted',
    reason: 'Kebutuhan kebijakan formal untuk vendor dengan dampak operasional tinggi.',
    requester: 'Citra Wulandari',
    currentStage: 'daftar_hadir',
    meetings: [
      { id: 'm3', sessionNumber: 1, date: daysFromToday(-20), budget: 500000, hasPhotoEvidence: true, hasMinutesEvidence: true, attendees: ['Citra Wulandari', 'Yusuf Hidayat'], signaturesCollected: true },
    ],
    createdAt: daysFromToday(-30),
    updatedAt: daysFromToday(-1),
  },
  {
    id: 'dp-3',
    requestNumber: 'REQ-2026-016',
    documentTitle: 'SOP Klasifikasi Data Pelanggan',
    documentType: 'SOP',
    functionId: 'infosec',
    standards: ['ISO27001'],
    initialClassification: 'confidential',
    reason: 'Diperlukan untuk mendukung kepatuhan perlindungan data pribadi.',
    requester: 'Intan Permatasari',
    currentStage: 'finalisasi',
    meetings: [
      { id: 'm4', sessionNumber: 1, date: daysFromToday(-40), budget: 0, hasPhotoEvidence: true, hasMinutesEvidence: true, attendees: ['Intan Permatasari', 'Dewi Anggraini'], signaturesCollected: true },
      { id: 'm5', sessionNumber: 2, date: daysFromToday(-18), budget: 0, hasPhotoEvidence: true, hasMinutesEvidence: true, attendees: ['Intan Permatasari', 'Dewi Anggraini', 'Wahyu Setiawan'], signaturesCollected: true },
    ],
    finalizedContent: 'Draf final menunggu pengesahan Ratifier.',
    createdAt: daysFromToday(-45),
    updatedAt: daysFromToday(-2),
  },
  {
    id: 'dp-4',
    requestNumber: 'REQ-2026-009',
    documentTitle: 'Prosedur Klasifikasi & Penanganan Informasi',
    documentType: 'SOP',
    functionId: 'infosec',
    standards: ['ISO27001'],
    initialClassification: 'confidential',
    reason: 'Selaras dengan Kebijakan Keamanan Informasi yang telah rilis.',
    requester: 'Intan Permatasari',
    currentStage: 'pengesahan',
    meetings: [
      { id: 'm6', sessionNumber: 1, date: daysFromToday(-60), budget: 0, hasPhotoEvidence: true, hasMinutesEvidence: true, attendees: ['Intan Permatasari'], signaturesCollected: true },
    ],
    finalizedContent: 'Menunggu pengesahan akhir oleh Ratifier.',
    ratifiedDocumentId: 'doc-12',
    createdAt: daysFromToday(-70),
    updatedAt: daysFromToday(-5),
  },
  {
    id: 'dp-5',
    requestNumber: 'REQ-2026-002',
    documentTitle: 'SOP Audit Internal',
    documentType: 'SOP',
    functionId: 'qa',
    standards: ['ISO9001', 'ISO27001'],
    initialClassification: 'internal',
    reason: 'Revisi SOP audit internal mengikuti pembaruan siklus sertifikasi.',
    requester: 'Rangga Pradipta',
    currentStage: 'undangan_rapat',
    meetings: [],
    createdAt: daysFromToday(-8),
    updatedAt: daysFromToday(-1),
  },
  {
    id: 'dp-6',
    requestNumber: 'REQ-2026-017',
    documentTitle: 'Formulir Evaluasi Pelatihan',
    documentType: 'Formulir',
    functionId: 'hc',
    standards: ['ISO9001'],
    initialClassification: 'internal',
    reason: 'Formulir evaluasi saat ini belum mencakup penilaian efektivitas jangka panjang.',
    requester: 'Ratna Sari',
    currentStage: 'permintaan',
    meetings: [],
    createdAt: daysFromToday(-1),
    updatedAt: daysFromToday(-1),
  },
]

export const NOTIFICATIONS: AppNotification[] = [
  { id: 'n1', category: 'approval_pending', message: 'Prosedur Klasifikasi & Penanganan Informasi menunggu persetujuan Anda.', documentId: 'doc-12', read: false, createdAt: daysFromToday(-1) },
  { id: 'n2', category: 'expiring_soon', message: 'SOP Rekonsiliasi Keuangan Bulanan akan direview dalam 8 hari.', documentId: 'doc-22', read: false, createdAt: daysFromToday(-1) },
  { id: 'n3', category: 'expiring_soon', message: 'Kebijakan Akses Sistem — Level Direksi mendekati jadwal review.', documentId: 'doc-13', read: false, createdAt: daysFromToday(-2) },
  { id: 'n4', category: 'assigned', message: 'Anda ditugaskan meninjau Business Continuity Plan — Data Center.', documentId: 'doc-28', read: false, createdAt: daysFromToday(-3) },
  { id: 'n5', category: 'shared', message: 'SOP Backup & Restore Data telah dibagikan kepada fungsi IT.', documentId: 'doc-27', read: true, createdAt: daysFromToday(-5) },
  { id: 'n6', category: 'expiring_soon', message: 'SOP Pemeliharaan Preventif Mesin akan direview dalam 3 hari.', documentId: 'doc-31', read: false, createdAt: daysFromToday(-1) },
  { id: 'n7', category: 'approval_pending', message: 'Business Continuity Plan — Data Center menunggu persetujuan Anda.', documentId: 'doc-28', read: false, createdAt: daysFromToday(-2) },
  { id: 'n8', category: 'assigned', message: 'Rapat pembahasan ke-2 SOP Manajemen Perubahan Kontraktor telah selesai — bukti notulen belum diunggah.', read: false, createdAt: daysFromToday(-3) },
]

export const AUDIT_LOG: AuditLogEntry[] = [
  ...DOCUMENTS.map((doc, i) => ({
    id: `al-create-${i}`,
    actor: doc.owner,
    action: 'create' as const,
    entity: 'Document',
    entityId: doc.id,
    timestamp: doc.createdAt,
    detail: `Membuat dokumen "${doc.title}" (${doc.code})`,
  })),
  ...DOCUMENTS.filter((d) => d.status === 'released' || d.status === 'obsolete').map((doc, i) => ({
    id: `al-status-${i}`,
    actor: 'Dewi Anggraini',
    action: 'status_change' as const,
    entity: 'Document',
    entityId: doc.id,
    timestamp: doc.updatedAt,
    detail: `Status "${doc.title}" berubah menjadi ${doc.status === 'released' ? 'Released' : 'Obsolete'}`,
  })),
  { id: 'al-login-1', actor: 'Wahyu Setiawan', action: 'login' as const, entity: 'Session', entityId: 'u7', timestamp: daysFromToday(0), detail: 'Login berhasil' },
  { id: 'al-login-2', actor: 'Ratna Sari', action: 'login' as const, entity: 'Session', entityId: 'u8', timestamp: daysFromToday(0), detail: 'Login berhasil' },
  { id: 'al-master-1', actor: 'Wahyu Setiawan', action: 'master_data_change' as const, entity: 'Standard', entityId: 'ISO22301', timestamp: daysFromToday(-10), detail: 'Menambahkan standar ISO 22301 ke Master Data' },
  { id: 'al-export-1', actor: 'Ratna Sari', action: 'export' as const, entity: 'Report', entityId: 'rpt-1', timestamp: daysFromToday(-4), detail: 'Mengekspor laporan ringkasan dokumen ke CSV' },
].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
