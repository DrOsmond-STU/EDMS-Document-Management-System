import type { DocumentStatus, RoleId, User } from '../types'
import type { Action, SharedState } from './reducer'

// Server-enforced RBAC. The frontend also consults these helpers to hide/
// disable actions a user can't perform, but that's a UX convenience only —
// the real boundary is api/dispatch.ts (Node) and cpanel/api/dispatch.php
// (PHP), which both call canPerformAction() below before touching the
// reducer. See docs/02_SECURITY.md Section 2, finding #4 (resolved).

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

// Static permission required per action type. Actions absent from this map
// require only a valid, active session (no extra role gate) — that covers
// collaborative workflow steps (drafting requests, meetings, notifications)
// that the product docs don't restrict to a specific role. TRANSITION_STATUS
// and SET_USER_PASSWORD are handled specially in canPerformAction() below
// because they depend on more than just the actor's roles.
const ACTION_PERMISSION: Partial<Record<Action['type'], Permission>> = {
  ADD_FUNCTION: 'masterdata.manage',
  ADD_STANDARD: 'masterdata.manage',
  ADD_USER: 'users.manage',
  TOGGLE_USER_ACTIVE: 'users.manage',
  RESET_DEMO_DATA: 'masterdata.manage',

  CREATE_RISK: 'risk.manage',
  UPDATE_RISK_STATUS: 'risk.manage',
  ADD_RISK_CONTROL: 'risk.manage',
  ADD_RISK_REVIEW: 'risk.manage',

  CREATE_INTERNAL_AUDIT: 'audit.plan',
  UPDATE_AUDIT_STATUS: 'audit.plan',
  CREATE_EXTERNAL_AUDIT: 'audit.plan',

  ADD_FINDING: 'finding.manage',
  ADD_CAPA: 'finding.manage',
  COMPLETE_CAPA: 'finding.manage',
  ADD_VERIFICATION: 'finding.manage',
  UPDATE_FINDING_STATUS: 'finding.manage',
  SET_ROOT_CAUSE: 'finding.manage',
  CLOSE_FINDING: 'finding.close',

  CREATE_MGMT_REVIEW: 'mgmt_review.chair',
  ADD_MGMT_DECISION: 'mgmt_review.chair',
  ADD_MGMT_ACTION: 'mgmt_review.chair',
  CLOSE_MGMT_ACTION: 'mgmt_review.chair',
  UPDATE_MGMT_REVIEW_STATUS: 'mgmt_review.chair',
}

// risk.manage OR compliance.manage may both administer the risk register
// (mirrors the `canManage` check in src/pages/RiskRegister.tsx).
const RISK_ACTIONS = new Set<Action['type']>([
  'CREATE_RISK',
  'UPDATE_RISK_STATUS',
  'ADD_RISK_CONTROL',
  'ADD_RISK_REVIEW',
])

/**
 * The single authority for "may this user run this action right now". Called
 * server-side (Node + PHP mirror) before every dispatch, and reusable
 * client-side to grey out/hide controls the user can't use.
 */
export function canPerformAction(user: Pick<User, 'id' | 'roles'>, action: Action, state: SharedState): boolean {
  if (action.type === 'TRANSITION_STATUS') {
    const doc = state.documents.find((d) => d.id === action.documentId)
    if (!doc) return false
    return canTransition(user.roles, doc.status)
  }

  if (action.type === 'SET_USER_PASSWORD') {
    // Everyone may change their own password (subject to the caller also
    // verifying currentPassword — that check lives in the API layer since it
    // needs the stored hash, not just roles). Anyone else's password requires
    // users.manage.
    if (action.userId === user.id) return true
    return rolesHavePermission(user.roles, 'users.manage')
  }

  if (RISK_ACTIONS.has(action.type)) {
    return rolesHavePermission(user.roles, 'risk.manage') || rolesHavePermission(user.roles, 'compliance.manage')
  }

  const required = ACTION_PERMISSION[action.type]
  if (!required) return true // no specific gate — any authenticated active user
  return rolesHavePermission(user.roles, required)
}
