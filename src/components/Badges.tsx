import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import type { ClassificationLevel, DocumentStatus, ValidityStatus } from '../types'
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
