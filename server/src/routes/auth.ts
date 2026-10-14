import { Router } from 'express'
import { db, now } from '../db.js'
import { createSession, destroySession, hashPassword, newSalt, publicUser, requireUser, setSessionCookie, verifyPassword } from '../auth.js'
import { HttpError, str, wrap, IdRow } from '../util.js'

export const authRouter = Router()

authRouter.post(
  '/login',
  wrap((req, res) => {
    const username = str(req.body?.username, 64).toLowerCase()
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as IdRow | undefined
    if (!row || !verifyPassword(password, row.salt as string, row.password_hash as string)) {
      throw new HttpError(401, 'Invalid username or password')
    }
    if (row.disabled) throw new HttpError(403, 'This account has been disabled')
    const token = createSession(row.id as number)
    setSessionCookie(res, token)
    db.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').run(now(), row.id)
    res.json({ user: publicUser(row) })
  }),
)

authRouter.post(
  '/logout',
  wrap((req, res) => {
    if (req.sessionToken) destroySession(req.sessionToken)
    setSessionCookie(res, null)
    res.json({ ok: true })
  }),
)

authRouter.get('/me', (req, res) => {
  res.json({ user: req.user ?? null })
})

authRouter.put(
  '/profile',
  requireUser,
  wrap((req, res) => {
    const displayName = str(req.body?.displayName, 80) || req.user!.username
    const bio = str(req.body?.bio, 400)
    db.prepare('UPDATE users SET display_name = ?, bio = ? WHERE id = ?').run(displayName, bio, req.user!.id)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as IdRow
    res.json({ user: publicUser(row) })
  }),
)

authRouter.post(
  '/password',
  requireUser,
  wrap((req, res) => {
    const current = typeof req.body?.current === 'string' ? req.body.current : ''
    const next = typeof req.body?.next === 'string' ? req.body.next : ''
    if (next.length < 8) throw new HttpError(400, 'New password must be at least 8 characters')
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as IdRow
    if (!verifyPassword(current, row.salt as string, row.password_hash as string)) throw new HttpError(400, 'Current password is incorrect')
    const salt = newSalt()
    db.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE id = ?').run(salt, hashPassword(next, salt), req.user!.id)
    // sign other sessions out
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND token <> ?').run(req.user!.id, req.sessionToken ?? '')
    res.json({ ok: true })
  }),
)
