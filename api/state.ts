import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getSessionUserId } from './_lib/auth'
import { readState, sanitizeForClient } from './_lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const userId = getSessionUserId(req)
  if (!userId) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  try {
    const state = await readState()
    const currentUser = state.users.find((u) => u.id === userId)
    if (!currentUser || !currentUser.active) {
      res.status(401).json({ error: 'unauthenticated' })
      return
    }
    res.status(200).json({ state: sanitizeForClient(state), currentUserId: userId })
  } catch (err) {
    console.error('GET /api/state failed', err)
    res.status(500).json({
      error: 'Gagal memuat data. Pastikan database Postgres sudah tersambung ke project ini (Vercel > Storage).',
    })
  }
}
