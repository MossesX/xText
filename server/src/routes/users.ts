import { Router } from 'express'
import { db, now } from '../db.js'
import { hashPassword, newSalt, publicUser, requireAdmin } from '../auth.js'
import { HttpError, str, wrap, IdRow } from '../util.js'

export const usersRouter = Router()
usersRouter.use(requireAdmin)

usersRouter.get(
  '/',
  wrap((_req, res) => {
    const rows = db
      .prepare(
        `SELECT u.*,
          (SELECT COUNT(*) FROM likes l WHERE l.user_id = u.id) AS likes,
          (SELECT COUNT(*) FROM comments c WHERE c.user_id = u.id) AS comments
         FROM users u ORDER BY u.created_at`,
      )
      .all() as IdRow[]
    res.json({ users: rows.map((r) => ({ ...publicUser(r), likes: r.likes, comments: r.comments })) })
  }),
)

usersRouter.post(
  '/',
  wrap((req, res) => {
    const username = str(req.body?.username, 32).toLowerCase()
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const displayName = str(req.body?.displayName, 80) || username
    const role = req.body?.role === 'admin' ? 'admin' : 'user'
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new HttpError(400, 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore')
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'That username is already taken')
    const salt = newSalt()
    const info = db
      .prepare('INSERT INTO users(username, display_name, role, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, displayName, role, hashPassword(password, salt), salt, now())
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid as number) as IdRow
    res.status(201).json({ user: publicUser(row) })
  }),
)

usersRouter.put(
  '/:id',
  wrap((req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IdRow | undefined
    if (!row) throw new HttpError(404, 'User not found')
    const self = id === req.user!.id
    const role: string = req.body?.role === 'admin' || req.body?.role === 'user' ? req.body.role : (row.role as string)
    const disabled: number = typeof req.body?.disabled === 'boolean' ? (req.body.disabled ? 1 : 0) : (row.disabled as number)
    if (self && (role !== 'admin' || disabled)) throw new HttpError(400, 'You cannot demote or disable your own account')
    const displayName = str(req.body?.displayName, 80) || (row.display_name as string)
    db.prepare('UPDATE users SET role = ?, disabled = ?, display_name = ? WHERE id = ?').run(role, disabled, displayName, id)
    if (typeof req.body?.password === 'string' && req.body.password) {
      if (req.body.password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
      const salt = newSalt()
      db.prepare('UPDATE users SET salt = ?, password_hash = ? WHERE id = ?').run(salt, hashPassword(req.body.password, salt), id)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    }
    if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IdRow) })
  }),
)

usersRouter.delete(
  '/:id',
  wrap((req, res) => {
    const id = Number(req.params.id)
    if (id === req.user!.id) throw new HttpError(400, 'You cannot delete your own account')
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    res.json({ ok: true })
  }),
)
