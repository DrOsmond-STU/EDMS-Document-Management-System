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

const ROLE_PERMISSIONS: Record<RoleId, Permission[]> = {
  requester: ['document.request', 'document.view_released'],
  drafter: ['document.draft', 'document.view_released'],
  reviewer: ['document.review', 'document.view_released'],
  approver: ['document.approve', 'document.view_released'],
  controller: ['document.control', 'document.view_released', 'reporting.view'],
  ratifier: ['document.ratify', 'document.view_released'],
  function_head: ['document.view_released', 'reporting.view'],
  compliance_admin: ['compliance.manage', 'document.view_released', 'reporting.view'],
  sysadmin: ['masterdata.manage', 'users.manage', 'document.view_released', 'audit.view'],
  auditor: ['audit.view', 'document.view_released', 'reporting.view'],
  viewer: ['document.view_released'],
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
