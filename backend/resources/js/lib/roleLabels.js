// Label manusiawi untuk role id dari backend (mis. "compliance_admin").
// Dipakai di Topbar & Sidebar supaya identitas pengguna tampil sama seperti
// purwarupa lama ("Compliance & Risk Admin"), bukan id mentah.
export const ROLE_LABELS = {
  requester: 'Requester',
  drafter: 'Document Drafter',
  reviewer: 'Reviewer',
  approver: 'Approver',
  controller: 'Document Controller',
  ratifier: 'Ratifier',
  function_head: 'Function/Department Head',
  compliance_admin: 'Compliance & Risk Admin',
  sysadmin: 'System Administrator',
  auditor: 'Auditor',
  viewer: 'Viewer',
}

export function roleLabel(roleId) {
  return ROLE_LABELS[roleId] || roleId
}

export function roleLabels(roleIds) {
  return (roleIds || []).map(roleLabel).join(', ')
}
