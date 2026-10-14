import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { db, now } from './db.js'

export interface User {
  id: number
  username: string
  display_name: string
  role: 'admin' | 'user'
  disabled: number
  bio: string
  created_at: number
  last_seen_at: number | null
}

const SESSION_DAYS = 30
export const COOKIE = 'xg_session'

export function hashPassword(password: string, salt: string): string {
  return pbkdf2Sync(password, salt, 120_000, 32, 'sha256').toString('hex')
}

export function newSalt(): string {
  return randomBytes(16).toString('hex')
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password, salt), 'hex')
  const b = Buffer.from(hash, 'hex')
  return a.length === b.length && timingSafeEqual(a, b)
}

export function publicUser(row: Record<string, unknown>): User {
  return {
    id: row.id as number,
    username: row.username as string,
    display_name: row.display_name as string,
    role: row.role as 'admin' | 'user',
    disabled: row.disabled as number,
    bio: (row.bio as string) ?? '',
    created_at: row.created_at as number,
    last_seen_at: (row.last_seen_at as number | null) ?? null,
  }
}

export function createSession(userId: number): string {
  const token = randomBytes(32).toString('base64url')
  const t = now()
  db.prepare('INSERT INTO sessions(token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(token, userId, t, t + SESSION_DAYS * 86_400_000)
  return token
}

export function destroySession(token: string): void {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token)
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  if (!header) return out
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export function setSessionCookie(res: Response, token: string | null): void {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  if (token) {
    res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86_400}${secure}`)
  } else {
    res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`)
  }
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: User
    sessionToken?: string
  }
}

/** Attaches req.user when a valid session cookie is present. Never rejects. */
export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = parseCookies(req.headers.cookie)[COOKIE]
  if (!token) return next()
  const row = db
    .prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ? AND u.disabled = 0')
    .get(token, now()) as Record<string, unknown> | undefined
  if (row) {
    req.user = publicUser(row)
    req.sessionToken = token
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), req.user.id)
  }
  next()
}

export function requireUser(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  next()
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required' })
    return
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator access required' })
    return
  }
  next()
}

/** Removes expired sessions. */
export function pruneSessions(): void {
  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now())
}
