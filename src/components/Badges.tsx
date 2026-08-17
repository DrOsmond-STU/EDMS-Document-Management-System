import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import type {
  AuditStatus,
  ClassificationLevel,
  DocumentStatus,
  FindingStatus,
  FindingType,
  RiskLevel,
  ValidityStatus,
} from '../types'
import {
  AUDIT_STATUS_COLOR,
  AUDIT_STATUS_LABEL,
  FINDING_STATUS_COLOR,
  FINDING_STATUS_LABEL,
  FINDING_TYPE_COLOR,
  FINDING_TYPE_LABEL,
  RISK_LEVEL_COLOR,
  RISK_LEVEL_LABEL,
} from '../types'
import {
  CLASSIFICATION_COLOR,
  CLASSIFICATION_HAS_LOCK,
  CLASSIFICATION_LABEL,
  STATUS_COLOR,
  STATUS_LABEL,
  VALIDITY_COLOR,
  VALIDITY_LABEL,
} from '../constants'

function BasePill({ bg, text, children }: { bg: string; text: string; children: ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color: text }}
    >
      {children}
    </span>
  )
}

export function StatusBadge({ status }: { status: DocumentStatus }) {
  const c = STATUS_COLOR[status]
  return <BasePill bg={c.bg} text={c.text}>{STATUS_LABEL[status]}</BasePill>
}

export function ValidityBadge({ validity }: { validity: ValidityStatus }) {
  const c = VALIDITY_COLOR[validity]
  return <BasePill bg={c.bg} text={c.text}>{VALIDITY_LABEL[validity]}</BasePill>
}

export function ClassificationBadge({ level }: { level: ClassificationLevel }) {
  const c = CLASSIFICATION_COLOR[level]
  const locked = CLASSIFICATION_HAS_LOCK[level]
  return (
    <BasePill bg={c.bg} text={c.text}>
      {locked && <Lock size={11} strokeWidth={2.5} />}
      {CLASSIFICATION_LABEL[level]}
    </BasePill>
  )
}

export function StandardChip({ code }: { code: string }) {
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: 'var(--color-chip-bg)', color: 'var(--color-chip-text)' }}
    >
      {code}
    </span>
  )
}

export function RiskLevelBadge({ level }: { level: RiskLevel }) {
  const c = RISK_LEVEL_COLOR[level]
  return <BasePill bg={c.bg} text={c.text}>{RISK_LEVEL_LABEL[level]}</BasePill>
}

export function AuditStatusBadge({ status }: { status: AuditStatus }) {
  const c = AUDIT_STATUS_COLOR[status]
  return <BasePill bg={c.bg} text={c.text}>{AUDIT_STATUS_LABEL[status]}</BasePill>
}

export function FindingTypeBadge({ type }: { type: FindingType }) {
  const c = FINDING_TYPE_COLOR[type]
  return <BasePill bg={c.bg} text={c.text}>{FINDING_TYPE_LABEL[type]}</BasePill>
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const c = FINDING_STATUS_COLOR[status]
  return <BasePill bg={c.bg} text={c.text}>{FINDING_STATUS_LABEL[status]}</BasePill>
}
