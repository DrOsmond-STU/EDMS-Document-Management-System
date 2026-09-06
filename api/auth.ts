import type { VercelRequest, VercelResponse } from '@vercel/node'
import { issueSessionCookie } from './_lib/auth'
import { readState } from './_lib/db'
import { verifyPassword } from './_lib/password'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!email || !password) {
    res.status(400).json({ ok: false, error: 'Email dan password wajib diisi.' })
    return
  }
  try {
    const state = await readState()
    const user = state.users.find((u) => u.email.toLowerCase() === email)
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      res.status(401).json({ ok: false, error: 'Email atau password salah.' })
      return
    }
    issueSessionCookie(res, user.id)
    res.status(200).json({ ok: true })
  } catch (err) {
    console.error('POST /api/auth failed', err)
    res.status(500).json({ ok: false, error: 'Gagal menghubungi server. Coba lagi.' })
  }
}
