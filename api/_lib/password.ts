// Password hashing for the Node/Vercel backend. Uses Node's built-in scrypt
// (no extra dependency) rather than bcrypt. Stored format: "scrypt:<saltHex>:<hashHex>".
// The PHP/cPanel backend uses PHP's native password_hash() (bcrypt) instead —
// the two backends never share a database, so the formats never need to match.
import crypto from 'node:crypto'

const KEY_LENGTH = 64

export function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(plain, salt, KEY_LENGTH).toString('hex')
  return `scrypt:${salt}:${hash}`
}

export function verifyPassword(plain: string, stored: string | undefined | null): boolean {
  if (!stored) return false
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const [, salt, hashHex] = parts
  const expected = Buffer.from(hashHex, 'hex')
  const actual = crypto.scryptSync(plain, salt, KEY_LENGTH)
  if (expected.length !== actual.length) return false
  return crypto.timingSafeEqual(expected, actual)
}
