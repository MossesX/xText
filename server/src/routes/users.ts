import { Router } from 'express'
import { randomBytes, randomInt } from 'node:crypto'
import { db, now } from '../db.js'
import { hashPassword, newSalt, publicUser, requireAdmin, requireOwner } from '../auth.js'
import { HttpError, num, str, wrap, IdRow } from '../util.js'
import { ensureGalleryFor, galleryOf, grantGallery, isOwner, managedGalleryIds } from '../access.js'

export const usersRouter = Router()
usersRouter.use(requireAdmin)

function userJson(r: IdRow) {
  const galleryIds = (db.prepare('SELECT gallery_id FROM gallery_access WHERE user_id = ?').all(r.id) as { gallery_id: number }[]).map((x) => x.gallery_id)
  const own = galleryOf(r.id)
  return {
    ...publicUser(r),
    likes: (db.prepare('SELECT COUNT(*) c FROM likes WHERE user_id = ?').get(r.id) as { c: number }).c,
    comments: (db.prepare('SELECT COUNT(*) c FROM comments WHERE user_id = ?').get(r.id) as { c: number }).c,
    galleryIds,
    ownGalleryId: own?.id ?? null,
  }
}

/** Owner: every account. Admin: accounts with access to their gallery. */
usersRouter.get(
  '/',
  wrap((req, res) => {
    let rows: IdRow[]
    if (isOwner(req.user)) rows = db.prepare('SELECT * FROM users ORDER BY created_at').all() as IdRow[]
    else {
      const g = galleryOf(req.user!.id)
      rows = g ? (db.prepare('SELECT u.* FROM users u WHERE u.id IN (SELECT user_id FROM gallery_access WHERE gallery_id = ?) OR u.created_by = ? ORDER BY u.created_at').all(g.id, req.user!.id) as IdRow[]) : []
    }
    res.json({ users: rows.map(userJson) })
  }),
)

function insertUser(v: { username: string; displayName: string; role: string; password: string; status: string; createdBy: number }): IdRow {
  const salt = newSalt()
  const info = db
    .prepare('INSERT INTO users(username, display_name, role, password_hash, salt, created_at, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(v.username, v.displayName, v.role, hashPassword(v.password, salt), salt, now(), v.status, v.createdBy)
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid as number) as IdRow
  if (v.role === 'admin' || v.role === 'owner') ensureGalleryFor(row.id, v.displayName)
  return row
}

usersRouter.post(
  '/',
  wrap((req, res) => {
    const username = str(req.body?.username, 32).toLowerCase()
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    const displayName = str(req.body?.displayName, 80) || username
    const role = isOwner(req.user) && req.body?.role === 'admin' ? 'admin' : 'user'
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new HttpError(400, 'Username must be 3-32 characters: letters, numbers, dot, dash or underscore')
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new HttpError(409, 'That username is already taken')
    const row = insertUser({ username, displayName, role, password, status: 'active', createdBy: req.user!.id })
    const galleryIds: number[] = Array.isArray(req.body?.galleryIds) ? req.body.galleryIds.map(Number) : []
    const allowed = new Set(managedGalleryIds(req.user!))
    const grants = isOwner(req.user) ? galleryIds : galleryIds.filter((g) => allowed.has(g))
    if (!isOwner(req.user) && grants.length === 0) {
      const g = galleryOf(req.user!.id)
      if (g) grants.push(g.id)
    }
    for (const g of grants) grantGallery(row.id, g)
    res.status(201).json({ user: userJson(row) })
  }),
)

const ADJ = ['amber', 'golden', 'quiet', 'velvet', 'copper', 'ivory', 'indigo', 'saffron', 'cobalt', 'umber', 'sienna', 'ember', 'onyx', 'opal', 'coral']
const NOUN = ['falcon', 'harbor', 'meadow', 'summit', 'river', 'lantern', 'orchid', 'comet', 'willow', 'canyon', 'ridge', 'ember', 'atlas', 'marble', 'prism']

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(14)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out.slice(0, 4) + '-' + out.slice(4, 9) + '-' + out.slice(9, 14)
}

/** Generates a pending account with a random name and password. The password is returned once. */
usersRouter.post(
  '/generate',
  wrap((req, res) => {
    const requested = req.body?.galleryId != null ? num(req.body.galleryId) : null
    const own = galleryOf(req.user!.id)
    const galleryId = requested ?? own?.id ?? null
    if (galleryId == null) throw new HttpError(400, 'No gallery to attach the account to')
    if (!managedGalleryIds(req.user!).includes(galleryId)) throw new HttpError(403, 'You can only generate accounts for your own gallery')
    let username = ''
    for (let i = 0; i < 20 && !username; i++) {
      const candidate = `${ADJ[randomInt(ADJ.length)]}-${NOUN[randomInt(NOUN.length)]}-${randomInt(100, 999)}`
      if (!db.prepare('SELECT 1 FROM users WHERE username = ?').get(candidate)) username = candidate
    }
    if (!username) throw new HttpError(500, 'Could not find a free username')
    const password = generatePassword()
    const displayName = str(req.body?.displayName, 80) || username.split('-').slice(0, 2).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')
    const row = insertUser({ username, displayName, role: 'user', password, status: 'pending', createdBy: req.user!.id })
    grantGallery(row.id, galleryId)
    res.status(201).json({ user: userJson(row), credentials: { username, password } })
  }),
)

usersRouter.put(
  '/:id',
  wrap((req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IdRow | undefined
    if (!row) throw new HttpError(404, 'User not found')
    const owner = isOwner(req.user)
    const self = id === req.user!.id
    if (!owner) {
      // Admins may only touch accounts attached to their gallery that they created, and never change roles.
      const own = galleryOf(req.user!.id)
      const attached = own && db.prepare('SELECT 1 FROM gallery_access WHERE user_id = ? AND gallery_id = ?').get(id, own.id)
      if (!attached || row.role !== 'user') throw new HttpError(403, 'You can only manage members of your own gallery')
    }
    const b = req.body ?? {}
    let role = row.role as string
    if (owner && (b.role === 'admin' || b.role === 'user' || b.role === 'owner')) {
      if (self && b.role !== 'owner') throw new HttpError(400, 'You cannot demote your own account')
      role = b.role
    }
    const disabled: number = typeof b.disabled === 'boolean' ? (b.disabled ? 1 : 0) : (row.disabled as number)
    if (self && disabled) throw new HttpError(400, 'You cannot disable your own account')
    const displayName = str(b.displayName, 80) || (row.display_name as string)
    db.prepare('UPDATE users SET role = ?, disabled = ?, display_name = ? WHERE id = ?').run(role, disabled, displayName, id)
    if (role === 'admin' || role === 'owner') ensureGalleryFor(id, displayName)
    if (typeof b.password === 'string' && b.password) {
      if (b.password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters')
      const salt = newSalt()
      db.prepare("UPDATE users SET salt = ?, password_hash = ?, status = 'pending' WHERE id = ?").run(salt, hashPassword(b.password, salt), id)
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    }
    if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    if (owner && Array.isArray(b.galleryIds)) {
      const ids = (b.galleryIds as unknown[]).map(Number).filter((n) => Number.isFinite(n))
      db.prepare('DELETE FROM gallery_access WHERE user_id = ?').run(id)
      for (const g of ids) grantGallery(id, g)
      const own = galleryOf(id)
      if (own) grantGallery(id, own.id)
    }
    res.json({ user: userJson(db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IdRow) })
  }),
)

usersRouter.delete(
  '/:id',
  wrap((req, res) => {
    const id = Number(req.params.id)
    if (id === req.user!.id) throw new HttpError(400, 'You cannot delete your own account')
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as IdRow | undefined
    if (!row) throw new HttpError(404, 'User not found')
    if (!isOwner(req.user) && (row.created_by !== req.user!.id || row.role !== 'user')) throw new HttpError(403, 'You can only delete members you created')
    if (row.role === 'owner') throw new HttpError(400, 'The owner account cannot be deleted')
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    res.json({ ok: true })
  }),
)

/** Owner-only: full gallery list for the access matrix. */
usersRouter.get('/galleries', requireOwner, (_req, res) => {
  res.json({ galleries: db.prepare('SELECT g.id, g.slug, g.title, u.display_name AS owner FROM galleries g JOIN users u ON u.id = g.owner_user_id ORDER BY g.created_at').all() })
})
