import type { VercelRequest, VercelResponse } from '@vercel/node'
import { checkPassword, issueSessionCookie, isProtected } from './_lib/auth'

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  if (!isProtected()) {
    issueSessionCookie(res)
    res.status(200).json({ ok: true })
    return
  }
  const password = typeof req.body?.password === 'string' ? req.body.password : ''
  if (!checkPassword(password)) {
    res.status(401).json({ ok: false, error: 'Password salah.' })
    return
  }
  issueSessionCookie(res)
  res.status(200).json({ ok: true })
}
