import type {
  ClassificationLevel,
  DocumentStatus,
  DocumentType,
  Role,
  RoleId,
  ValidityStatus,
} from './types'
import { DOCUMENT_STATUS_ORDER } from './types'

export { DOCUMENT_STATUS_ORDER }

// 11 roles per docs/01_PRD.md Section 7. RBAC is enforced only in the UI here —
// see docs/02_SECURITY.md Section 2, finding #4: real deployments MUST enforce
// this server-side, not just client-side.
export const ROLES: Role[] = [
  { id: 'requester', label: 'Requester', summary: 'Mengajukan permintaan pembuatan dokumen dari fungsi mana pun' },
  { id: 'drafter', label: 'Document Drafter', summary: 'Menyusun draf, mengelola rapat pembahasan' },
  { id: 'reviewer', label: 'Reviewer', summary: 'Meninjau dan memberi catatan pada draf dokumen' },
  { id: 'approver', label: 'Approver', summary: 'Menyetujui dokumen untuk dirilis' },
  { id: 'controller', label: 'Document Controller', summary: 'Mengelola penomoran, register, dan status dokumen lintas fungsi' },
  { id: 'ratifier', label: 'Ratifier', summary: 'Mengesahkan dokumen final menjadi dokumen resmi' },
  { id: 'function_head', label: 'Function/Department Head', summary: 'Melihat dan mengawasi dokumen fungsinya' },
  { id: 'compliance_admin', label: 'Compliance & Risk Admin', summary: 'Mengelola pemetaan kepatuhan multi-standar' },
  { id: 'sysadmin', label: 'System Administrator', summary: 'Mengelola pengguna, master data, dan konfigurasi sistem' },
  { id: 'auditor', label: 'Auditor', summary: 'Melihat seluruh dokumen dan audit trail (read-only)' },
  { id: 'viewer', label: 'Viewer', summary: 'Melihat dokumen berstatus Released sesuai hak akses' },
]

export const ROLE_MAP: Record<RoleId, Role> = Object.fromEntries(
  ROLES.map((r) => [r.id, r]),
) as Record<RoleId, Role>

export const STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: 'Draft',
  review: 'Review',
  approval: 'Approval',
  released: 'Released',
  obsolete: 'Obsolete',
}

// Status colors — docs/05_BRAND.md Section 6 (semantic, distinct from classification scheme)
export const STATUS_COLOR: Record<DocumentStatus, { bg: string; text: string }> = {
  draft: { bg: '#EEF2F7', text: '#475569' },
  review: { bg: '#FDF1DC', text: '#B9791C' },
  approval: { bg: '#FCE8D1', text: '#C1650F' },
  released: { bg: '#E5F5EC', text: '#1E8E5A' },
  obsolete: { bg: '#FBE7E6', text: '#B23B3A' },
}

export const VALIDITY_LABEL: Record<ValidityStatus, string> = {
  berlaku: 'Berlaku',
  kadaluarsa: 'Kadaluarsa',
  tidak_berlaku: 'Tidak Berlaku',
  belum_berlaku: 'Belum Berlaku',
}

export const VALIDITY_COLOR: Record<ValidityStatus, { bg: string; text: string }> = {
  berlaku: { bg: '#E5F5EC', text: '#1E8E5A' },
  kadaluarsa: { bg: '#FBE7E6', text: '#B23B3A' },
  tidak_berlaku: { bg: '#E9EEF2', text: '#55606B' },
  belum_berlaku: { bg: '#EEF2F7', text: '#475569' },
}

// Classification badges — docs/05_BRAND.md Section 3.1 (Domain 7: Information Protection)
export const CLASSIFICATION_LABEL: Record<ClassificationLevel, string> = {
  public: 'Public',
  internal: 'Internal',
  restricted: 'Restricted',
  confidential: 'Confidential',
  secret: 'Secret',
  top_secret: 'Top Secret',
}

export const CLASSIFICATION_COLOR: Record<ClassificationLevel, { bg: string; text: string }> = {
  public: { bg: '#7fa88f', text: '#ffffff' },
  internal: { bg: '#5f8fb4', text: '#ffffff' },
  restricted: { bg: '#c98a3e', text: '#ffffff' },
  confidential: { bg: '#b9563f', text: '#ffffff' },
  secret: { bg: '#7a3b3b', text: '#ffffff' },
  top_secret: { bg: '#1f2937', text: '#ffffff' },
}

export const CLASSIFICATION_HAS_LOCK: Record<ClassificationLevel, boolean> = {
  public: false,
  internal: false,
  restricted: true,
  confidential: true,
  secret: true,
  top_secret: true,
}

export const DOCUMENT_TYPES: DocumentType[] = ['Kebijakan', 'Manual', 'SOP', 'Work Instruction', 'Formulir']

export const DOCUMENT_TYPE_CODE: Record<DocumentType, string> = {
  Kebijakan: 'KBJ',
  Manual: 'MAN',
  SOP: 'SOP',
  'Work Instruction': 'WI',
  Formulir: 'FRM',
}

export const DRAFTING_STAGE_LABEL: Record<string, string> = {
  permintaan: 'Permintaan',
  undangan_rapat: 'Undangan Rapat',
  rapat: 'Rapat Pembahasan',
  bukti_notulen: 'Bukti Notulen',
  daftar_hadir: 'Daftar Hadir & TTD',
  finalisasi: 'Finalisasi',
  pengesahan: 'Pengesahan',
  register_utama: 'Register Utama',
}
