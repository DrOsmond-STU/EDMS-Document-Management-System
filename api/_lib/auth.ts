// Per-user session cookie, signed with HMAC. Replaces the old single
// shared-password gate: every request now carries a specific authenticated
// user id, which api/dispatch.ts uses for RBAC (src/state/permissions.ts)
// and for stamping the audit log — the client can no longer just claim to be
// anyone by typing a name into the actor field.
import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'edms_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

// A real deployment should set SESSION_SECRET explicitly (Vercel > Settings >
// Environment Variables). Falling back to a value derived from the DB
// connection string keeps the prototype working out of the box without a
// separate secret to configure, at the cost of the secret rotating only when
// the DB connection string does.
function getSecret(): string {
  const explicit = process.env.SESSION_SECRET
  if (explicit && explicit.length > 0) return explicit
  const dbUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL || 'edms-fallback'
  return crypto.createHash('sha256').update(`edms-session|${dbUrl}`).digest('hex')
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex')
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function issueSessionCookie(res: VercelResponse, userId: string): void {
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000
  const payload = `${userId}.${expiry}`
  const token = `${payload}.${sign(payload)}`
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
  )
}

export function clearSessionCookie(res: VercelResponse): void {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`)
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

/** Returns the authenticated user id from the session cookie, or null. */
export function getSessionUserId(req: VercelRequest): string | null {
  const token = parseCookies(req.headers.cookie).edms_session
  if (!token) return null
  const lastDot = token.lastIndexOf('.')
  if (lastDot === -1) return null
  const payload = token.slice(0, lastDot)
  const sig = token.slice(lastDot + 1)
  const secondDot = payload.lastIndexOf('.')
  if (secondDot === -1) return null
  const userId = payload.slice(0, secondDot)
  const expiryStr = payload.slice(secondDot + 1)
  const expiry = Number(expiryStr)
  if (!userId || !Number.isFinite(expiry) || expiry < Date.now()) return null
  if (!timingSafeStringEqual(sig, sign(payload))) return null
  return userId
}
