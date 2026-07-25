import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAuthenticated } from './_lib/auth'
import { applyAction } from './_lib/db'
import { ACTION_TYPES, type Action } from '../src/state/reducer'

const VALID_TYPES = new Set<string>(ACTION_TYPES)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  const action = req.body?.action as Action | undefined
  if (!action || typeof action.type !== 'string' || !VALID_TYPES.has(action.type)) {
    res.status(400).json({ error: 'Aksi tidak valid.' })
    return
  }
  try {
    const state = await applyAction(action)
    res.status(200).json({ state })
  } catch (err) {
    console.error('POST /api/dispatch failed', err)
    res.status(500).json({
      error: 'Gagal menyimpan perubahan. Pastikan database Postgres sudah tersambung ke project ini (Vercel > Storage).',
    })
  }
}
