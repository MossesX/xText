import { Router } from 'express'
import { createWriteStream, existsSync, unlinkSync, mkdirSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { db, MEDIA_DIR, now } from '../db.js'
import { requireAdmin, requireUser } from '../auth.js'
import { HttpError, num, parseJson, str, wrap, IdRow } from '../util.js'
import { commentJson, mediaJson } from '../serialize.js'

export const mediaRouter = Router()

const MAX_UPLOAD = Number(process.env.MAX_UPLOAD_BYTES ?? 2 * 1024 * 1024 * 1024)

export function removeMediaFiles(row: Record<string, unknown>): void {
  for (const p of [row.file_path, row.thumb_path]) {
    if (typeof p === 'string' && p) {
      const abs = path.join(MEDIA_DIR, p)
      if (existsSync(abs)) {
        try {
          unlinkSync(abs)
        } catch {
          /* ignore */
        }
      }
    }
  }
}

function extFor(mime: string, name: string): string {
  const fromName = path.extname(name).toLowerCase().replace(/[^a-z0-9.]/g, '')
  if (fromName && fromName.length <= 6) return fromName
  const map: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif', 'image/avif': '.avif', 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' }
  return map[mime] ?? ''
}

async function streamToFile(req: import('express').Request, rel: string): Promise<number> {
  const abs = path.join(MEDIA_DIR, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  const declared = Number(req.headers['content-length'] ?? 0)
  if (declared > MAX_UPLOAD) throw new HttpError(413, 'File is too large')
  let received = 0
  req.on('data', (chunk: Buffer) => {
    received += chunk.length
    if (received > MAX_UPLOAD) req.destroy(new HttpError(413, 'File is too large'))
  })
  await pipeline(req, createWriteStream(abs))
  return (await stat(abs)).size
}

function loadMedia(id: number): IdRow {
  const row = db.prepare('SELECT * FROM media WHERE id = ?').get(id) as IdRow | undefined
  if (!row) throw new HttpError(404, 'Media not found')
  return row
}

function canView(req: import('express').Request, row: Record<string, unknown>): boolean {
  const album = db.prepare('SELECT visibility, share_token FROM albums WHERE id = ?').get(row.album_id as number) as { visibility: string; share_token: string | null } | undefined
  if (!album) return false
  const share = typeof req.query.s === 'string' ? req.query.s : ''
  if (share && album.share_token && share === album.share_token) return true
  if (!req.user) return false
  return album.visibility === 'published' || req.user.role === 'admin'
}

/* ---------- upload (admin) ---------- */

mediaRouter.post(
  '/albums/:albumId/media',
  requireAdmin,
  wrap(async (req, res) => {
    const albumId = Number(req.params.albumId)
    if (!db.prepare('SELECT id FROM albums WHERE id = ?').get(albumId)) throw new HttpError(404, 'Album not found')
    const meta = parseJson<Record<string, unknown>>(Buffer.from(str(req.headers['x-meta'], 4000) || 'e30=', 'base64').toString('utf8'), {})
    const mime = str(req.headers['content-type'], 100) || 'application/octet-stream'
    const kind = mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : null
    if (!kind) throw new HttpError(415, `Unsupported file type: ${mime}`)
    const name = str(meta.fileName, 200) || 'upload'
    const rel = path.join(String(albumId), `${now()}-${randomBytes(4).toString('hex')}${extFor(mime, name)}`)
    const size = await streamToFile(req, rel)
    const last = db.prepare('SELECT MAX(sort_order) m FROM media WHERE album_id = ?').get(albumId) as { m: number | null }
    const info = db
      .prepare('INSERT INTO media(album_id, kind, title, description, mime, file_path, width, height, size, duration, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(albumId, kind, str(meta.title, 200) || name.replace(/\.[^.]+$/, ''), '', mime, rel, num(meta.width), num(meta.height), size, meta.duration == null ? null : num(meta.duration), (last.m ?? 0) + 1, now())
    db.prepare('UPDATE albums SET updated_at = ? WHERE id = ?').run(now(), albumId)
    res.status(201).json({ media: mediaJson(loadMedia(info.lastInsertRowid as number), req.user!.id) })
  }),
)

mediaRouter.post(
  '/media/:id/thumb',
  requireAdmin,
  wrap(async (req, res) => {
    const row = loadMedia(Number(req.params.id))
    const rel = (row.file_path as string).replace(/\.[^.]*$/, '') + '.thumb.webp'
    await streamToFile(req, rel)
    db.prepare('UPDATE media SET thumb_path = ? WHERE id = ?').run(rel, row.id)
    res.json({ media: mediaJson(loadMedia(row.id as number), req.user!.id) })
  }),
)

/* ---------- files ---------- */

function sendFile(res: import('express').Response, rel: string, mime: string, download?: string) {
  const abs = path.join(MEDIA_DIR, rel)
  if (!existsSync(abs)) throw new HttpError(404, 'File missing')
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
  const headers: Record<string, string> = { 'Content-Type': mime }
  if (download) headers['Content-Disposition'] = `attachment; filename="${download.replace(/["\r\n]/g, '')}"`
  res.sendFile(abs, { headers, acceptRanges: true })
}

mediaRouter.get(
  '/media/:id/file',
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    if (!canView(req, row)) throw new HttpError(req.user ? 404 : 401, 'Not available')
    const dl = req.query.download != null ? `${(row.title as string) || 'media'}${path.extname(row.file_path as string)}` : undefined
    sendFile(res, row.file_path as string, row.mime as string, dl)
  }),
)

mediaRouter.get(
  '/media/:id/thumb',
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    if (!canView(req, row)) throw new HttpError(req.user ? 404 : 401, 'Not available')
    if (row.thumb_path) sendFile(res, row.thumb_path as string, 'image/webp')
    else sendFile(res, row.file_path as string, row.mime as string)
  }),
)

/* ---------- metadata (admin) ---------- */

mediaRouter.put(
  '/media/reorder',
  requireAdmin,
  wrap((req, res) => {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : []
    const upd = db.prepare('UPDATE media SET sort_order = ? WHERE id = ?')
    ids.forEach((id, i) => upd.run(i + 1, id))
    res.json({ ok: true })
  }),
)

mediaRouter.put(
  '/media/:id',
  requireAdmin,
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    const title = req.body?.title != null ? str(req.body.title, 200) : (row.title as string)
    const description = req.body?.description != null ? str(req.body.description, 2000) : (row.description as string)
    db.prepare('UPDATE media SET title = ?, description = ? WHERE id = ?').run(title, description, row.id)
    res.json({ media: mediaJson(loadMedia(row.id as number), req.user!.id) })
  }),
)

mediaRouter.delete(
  '/media/:id',
  requireAdmin,
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    db.prepare('DELETE FROM media WHERE id = ?').run(row.id)
    db.prepare('UPDATE albums SET cover_media_id = NULL WHERE cover_media_id = ?').run(row.id)
    removeMediaFiles(row)
    res.json({ ok: true })
  }),
)

/* ---------- social ---------- */

mediaRouter.post(
  '/media/:id/view',
  requireUser,
  wrap((req, res) => {
    db.prepare('UPDATE media SET views = views + 1 WHERE id = ?').run(Number(req.params.id))
    res.json({ ok: true })
  }),
)

mediaRouter.post(
  '/media/:id/like',
  requireUser,
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    if (!canView(req, row)) throw new HttpError(404, 'Media not found')
    const existing = db.prepare('SELECT id FROM likes WHERE user_id = ? AND media_id = ?').get(req.user!.id, row.id)
    if (existing) db.prepare('DELETE FROM likes WHERE id = ?').run((existing as { id: number }).id)
    else db.prepare('INSERT INTO likes(user_id, media_id, created_at) VALUES (?, ?, ?)').run(req.user!.id, row.id, now())
    res.json({ media: mediaJson(loadMedia(row.id as number), req.user!.id) })
  }),
)

mediaRouter.get(
  '/media/:id/comments',
  requireUser,
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    if (!canView(req, row)) throw new HttpError(404, 'Media not found')
    const comments = db
      .prepare('SELECT c.*, u.display_name, u.username FROM comments c LEFT JOIN users u ON u.id = c.user_id WHERE c.media_id = ? ORDER BY c.created_at')
      .all(row.id) as IdRow[]
    res.json({ comments: comments.map(commentJson) })
  }),
)

mediaRouter.post(
  '/media/:id/comments',
  requireUser,
  wrap((req, res) => {
    const row = loadMedia(Number(req.params.id))
    if (!canView(req, row)) throw new HttpError(404, 'Media not found')
    const body = str(req.body?.body, 2000)
    if (!body) throw new HttpError(400, 'Comment cannot be empty')
    const info = db.prepare('INSERT INTO comments(user_id, media_id, body, created_at) VALUES (?, ?, ?, ?)').run(req.user!.id, row.id, body, now())
    const c = db.prepare('SELECT c.*, u.display_name, u.username FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?').get(info.lastInsertRowid as number) as IdRow
    res.status(201).json({ comment: commentJson(c) })
  }),
)

mediaRouter.delete(
  '/comments/:id',
  requireUser,
  wrap((req, res) => {
    const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(Number(req.params.id)) as IdRow | undefined
    if (!c) throw new HttpError(404, 'Comment not found')
    if (req.user!.role !== 'admin' && c.user_id !== req.user!.id) throw new HttpError(403, 'You can only delete your own comments')
    db.prepare('DELETE FROM comments WHERE id = ?').run(c.id)
    res.json({ ok: true })
  }),
)
