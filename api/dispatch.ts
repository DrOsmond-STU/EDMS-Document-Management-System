import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSessionUserId } from './_lib/auth'
import { applyAction, readState, sanitizeForClient } from './_lib/db'
import { hashPassword, verifyPassword } from './_lib/password'
import { ACTION_TYPES, type Action } from '../src/state/reducer'
import { canPerformAction, rolesHavePermission } from '../src/state/permissions'

const VALID_TYPES = new Set<string>(ACTION_TYPES)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const userId = getSessionUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }

  const rawAction = req.body?.action as (Record<string, unknown> & { type?: unknown }) | undefined
  if (!rawAction || typeof rawAction.type !== 'string' || !VALID_TYPES.has(rawAction.type)) {
    res.status(400).json({ error: 'Aksi tidak valid.' })
    return
  }

  try {
    const state = await readState()
    const currentUser = state.users.find((u) => u.id === userId)
    if (!currentUser || !currentUser.active) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }

    let action: Action

    if (rawAction.type === 'SET_USER_PASSWORD') {
      const targetUserId = typeof rawAction.userId === 'string' ? rawAction.userId : ''
      const newPassword = typeof rawAction.newPassword === 'string' ? rawAction.newPassword : ''
      const currentPassword = typeof rawAction.currentPassword === 'string' ? rawAction.currentPassword : ''
      const targetUser = state.users.find((u) => u.id === targetUserId)
      if (!targetUser || newPassword.length < 8) {
        res.status(400).json({ error: 'Password baru minimal 8 karakter.' })
        return
      }
      const isSelf = targetUserId === currentUser.id
      const isManager = rolesHavePermission(currentUser.roles, 'users.manage')
      if (!isSelf && !isManager) {
        res.status(403).json({ error: 'Anda tidak berwenang mengubah password pengguna lain.' })
        return
      }
      if (isSelf && !isManager && !verifyPassword(currentPassword, targetUser.passwordHash)) {
        res.status(400).json({ error: 'Password Anda saat ini salah.' })
        return
      }
      action = { type: 'SET_USER_PASSWORD', userId: targetUserId, passwordHash: hashPassword(newPassword), actor: currentUser.name }
    } else {
      action = { ...(rawAction as object), actor: currentUser.name } as Action
    }

    if (!canPerformAction(currentUser, action, state)) {
      res.status(403).json({ error: 'Anda tidak berwenang melakukan aksi ini.' })
      return
    }

    const next = await applyAction(action)
    res.status(200).json({ state: sanitizeForClient(next) })
  } catch (err) {
    console.error('POST /api/dispatch failed', err)
    res.status(500).json({
      error: 'Gagal menyimpan perubahan. Pastikan database Postgres sudah tersambung ke project ini (Vercel > Storage).',
    })
  }
}
