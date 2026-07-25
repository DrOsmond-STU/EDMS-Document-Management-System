// Lightweight, dependency-free shared-password session gate. Protection is
// opt-in: if APP_PASSWORD is unset, every request is treated as authenticated
// so the app keeps working before the operator has chosen a password.
import crypto from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'

const COOKIE_NAME = 'edms_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function getSecret(): string | undefined {
  const p = process.env.APP_PASSWORD
  return p && p.length > 0 ? p : undefined
}

export function isProtected(): boolean {
  return getSecret() !== undefined
}

function sign(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex')
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return crypto.timingSafeEqual(bufA, bufB)
}

export function checkPassword(password: string): boolean {
  const secret = getSecret()
  if (!secret) return true
  return timingSafeStringEqual(password, secret)
}

export function issueSessionCookie(res: VercelResponse): void {
  const secret = getSecret()
  if (!secret) return
  const expiry = Date.now() + MAX_AGE_SECONDS * 1000
  const token = `${expiry}.${sign(String(expiry), secret)}`
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${MAX_AGE_SECONDS}`,
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

export function isAuthenticated(req: VercelRequest): boolean {
  const secret = getSecret()
  if (!secret) return true
  const token = parseCookies(req.headers.cookie).edms_session
  if (!token) return false
  const [expiryStr, sig] = token.split('.')
  if (!expiryStr || !sig) return false
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false
  return timingSafeStringEqual(sig, sign(expiryStr, secret))
}
