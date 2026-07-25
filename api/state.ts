import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isAuthenticated } from './_lib/auth'
import { readState } from './_lib/db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'unauthenticated' })
    return
  }
  try {
    const state = await readState()
    res.status(200).json({ state })
  } catch (err) {
    console.error('GET /api/state failed', err)
    res.status(500).json({
      error: 'Gagal memuat data. Pastikan database Postgres sudah tersambung ke project ini (Vercel > Storage).',
    })
  }
}
