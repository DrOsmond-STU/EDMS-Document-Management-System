import type { DocumentStatus, RoleId } from '../types'

// UI-layer RBAC only — a real deployment MUST enforce this server-side too.
// See docs/02_SECURITY.md Section 2, finding #4.

export type Permission =
  | 'document.request'
  | 'document.draft'
  | 'document.review'
  | 'document.approve'
  | 'document.control'
  | 'document.ratify'
  | 'document.view_released'
  | 'masterdata.manage'
  | 'users.manage'
  | 'audit.view'
  | 'reporting.view'
  | 'compliance.manage'
  // Risk & audit — new modules
  | 'risk.manage'
  | 'risk.view'
  | 'audit.plan'
  | 'audit.conduct'
  | 'finding.manage'
  | 'finding.close'
  | 'mgmt_review.chair'
  | 'mgmt_review.view'

const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  requester: ['document.request', 'document.view_released', 'risk.view', 'mgmt_review.view'],
  drafter: ['document.draft', 'document.view_released', 'risk.view'],
  reviewer: ['document.review', 'document.view_released', 'risk.view'],
  approver: ['document.approve', 'document.view_released', 'risk.view', 'mgmt_review.view'],
  controller: ['document.control', 'document.view_released', 'reporting.view', 'risk.view', 'finding.manage', 'mgmt_review.view'],
  ratifier: ['document.ratify', 'document.view_released', 'mgmt_review.chair', 'mgmt_review.view'],
  function_head: ['document.view_released', 'reporting.view', 'risk.manage', 'risk.view', 'finding.manage', 'mgmt_review.view'],
  compliance_admin: ['compliance.manage', 'document.view_released', 'reporting.view', 'risk.manage', 'risk.view', 'audit.plan', 'audit.conduct', 'finding.manage', 'finding.close', 'mgmt_review.chair', 'mgmt_review.view'],
  sysadmin: ['masterdata.manage', 'users.manage', 'document.view_released', 'audit.view', 'risk.view', 'mgmt_review.view'],
  auditor: ['audit.view', 'document.view_released', 'reporting.view', 'risk.view', 'audit.plan', 'audit.conduct', 'finding.manage', 'mgmt_review.view'],
  viewer: ['document.view_released', 'risk.view', 'mgmt_review.view'],
}

export function rolesHavePermission(roles: RoleId[], permission: Permission): boolean {
  return roles.some((r) => ROLE_PERMISSIONS[r]?.includes(permission))
}

// Which roles may move a document out of a given status (Draft -> Review -> Approval -> Released -> Obsolete)
export const STATUS_TRANSITION_ROLE: Record<DocumentStatus, RoleId[]> = {
  draft: ['drafter', 'controller'],
  review: ['reviewer', 'controller'],
  approval: ['approver', 'controller'],
  released: ['ratifier', 'controller'],
  obsolete: [],
}

export function canTransition(roles: RoleId[], from: DocumentStatus): boolean {
  const allowed = STATUS_TRANSITION_ROLE[from]
  return roles.some((r) => allowed.includes(r))
}
