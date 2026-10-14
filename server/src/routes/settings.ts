import { Router } from 'express'
import { db, getSetting, setSetting } from '../db.js'
import { requireAdmin } from '../auth.js'
import { DEFAULT_SETTINGS } from '../brand.js'
import { bool, num, str, wrap, IdRow } from '../util.js'

export const settingsRouter = Router()

function current() {
  return { ...DEFAULT_SETTINGS, ...getSetting<Partial<typeof DEFAULT_SETTINGS>>('site', {}) }
}

/** Public: what the shell needs before sign-in (title, theme). */
settingsRouter.get(
  '/',
  wrap((_req, res) => {
    const s = current()
    const theme = s.activeThemeId ? (db.prepare('SELECT * FROM themes WHERE id = ?').get(s.activeThemeId) as IdRow | undefined) : undefined
    res.json({
      settings: s,
      theme: theme
        ? { id: theme.id, name: theme.name, light: JSON.parse(theme.light as string), dark: JSON.parse(theme.dark as string), fontDisplay: theme.font_display, fontBody: theme.font_body, radius: theme.radius, scale: theme.scale, builtIn: !!theme.built_in, createdAt: theme.created_at }
        : null,
    })
  }),
)

settingsRouter.put(
  '/',
  requireAdmin,
  wrap((req, res) => {
    const s = current()
    const b = req.body ?? {}
    const next = {
      ...s,
      siteTitle: b.siteTitle != null ? str(b.siteTitle, 60) || s.siteTitle : s.siteTitle,
      tagline: b.tagline != null ? str(b.tagline, 140) : s.tagline,
      brandName: b.brandName != null ? str(b.brandName, 40) || s.brandName : s.brandName,
      activeThemeId: b.activeThemeId !== undefined ? (b.activeThemeId == null ? null : num(b.activeThemeId)) : s.activeThemeId,
      defaultLayout: b.defaultLayout && typeof b.defaultLayout === 'object' ? { ...s.defaultLayout, ...b.defaultLayout } : s.defaultLayout,
      allowComments: b.allowComments != null ? bool(b.allowComments, s.allowComments) : s.allowComments,
      allowLikes: b.allowLikes != null ? bool(b.allowLikes, s.allowLikes) : s.allowLikes,
      allowDownloads: b.allowDownloads != null ? bool(b.allowDownloads, s.allowDownloads) : s.allowDownloads,
      heroAlbumId: b.heroAlbumId !== undefined ? (b.heroAlbumId == null ? null : num(b.heroAlbumId)) : s.heroAlbumId,
    }
    setSetting('site', next)
    res.json({ settings: next })
  }),
)

settingsRouter.get(
  '/stats',
  requireAdmin,
  wrap((_req, res) => {
    const c = (sql: string) => (db.prepare(sql).get() as { c: number }).c
    const recent = db
      .prepare(
        `SELECT c.*, u.display_name, u.username,
          COALESCE(m.title, a.title) AS target_title,
          COALESCE(a2.slug, a.slug) AS target_slug
         FROM comments c
         LEFT JOIN users u ON u.id = c.user_id
         LEFT JOIN media m ON m.id = c.media_id
         LEFT JOIN albums a2 ON a2.id = m.album_id
         LEFT JOIN albums a ON a.id = c.album_id
         ORDER BY c.created_at DESC LIMIT 8`,
      )
      .all() as IdRow[]
    const top = db
      .prepare('SELECT a.id, a.title, a.slug, a.views, (SELECT COUNT(*) FROM likes l JOIN media m ON m.id = l.media_id WHERE m.album_id = a.id) AS likes FROM albums a ORDER BY a.views DESC LIMIT 5')
      .all()
    res.json({
      albums: c('SELECT COUNT(*) c FROM albums'),
      published: c("SELECT COUNT(*) c FROM albums WHERE visibility = 'published'"),
      media: c('SELECT COUNT(*) c FROM media'),
      videos: c("SELECT COUNT(*) c FROM media WHERE kind = 'video'"),
      users: c('SELECT COUNT(*) c FROM users'),
      activeUsers: c(`SELECT COUNT(*) c FROM users WHERE last_seen_at > ${Date.now() - 7 * 86_400_000}`),
      likes: c('SELECT COUNT(*) c FROM likes'),
      comments: c('SELECT COUNT(*) c FROM comments'),
      favorites: c('SELECT COUNT(*) c FROM favorites'),
      bytes: (db.prepare('SELECT COALESCE(SUM(size), 0) c FROM media').get() as { c: number }).c,
      views: (db.prepare('SELECT COALESCE(SUM(views), 0) c FROM albums').get() as { c: number }).c,
      recentComments: recent.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        author: r.display_name ?? 'Removed user',
        target: r.target_title ?? 'album',
        slug: r.target_slug,
      })),
      topAlbums: top,
    })
  }),
)
