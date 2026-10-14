import { Router } from 'express'
import { db, getSetting, setSetting } from '../db.js'
import { requireAdmin, requireOwner } from '../auth.js'
import { isOwner, managedGalleryIds } from '../access.js'
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
  requireOwner,
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
  wrap((req, res) => {
    const gids = managedGalleryIds(req.user!)
    const scope = isOwner(req.user) ? '' : ` AND gallery_id IN (${gids.map(() => '?').join(',') || 'NULL'})`
    const inAlbums = `(SELECT id FROM albums WHERE 1=1${scope})`
    const c = (sql: string) => (db.prepare(sql).get(...(scope ? gids : [])) as { c: number }).c
    const cAll = (sql: string) => (db.prepare(sql).get() as { c: number }).c
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
         WHERE (c.album_id IN ${inAlbums} OR m.album_id IN ${inAlbums})
         ORDER BY c.created_at DESC LIMIT 8`,
      )
      .all(...(scope ? [...gids, ...gids] : [])) as IdRow[]
    const top = db
      .prepare(`SELECT a.id, a.title, a.slug, a.views, (SELECT COUNT(*) FROM likes l JOIN media m ON m.id = l.media_id WHERE m.album_id = a.id) AS likes FROM albums a WHERE 1=1${scope} ORDER BY a.views DESC LIMIT 5`)
      .all(...(scope ? gids : []))
    const userScope = isOwner(req.user) ? '' : ` WHERE id IN (SELECT user_id FROM gallery_access WHERE gallery_id IN (${gids.map(() => '?').join(',') || 'NULL'}))`
    const cu = (sql: string) => (db.prepare(sql).get(...(scope ? gids : [])) as { c: number }).c
    res.json({
      albums: c(`SELECT COUNT(*) c FROM albums WHERE 1=1${scope}`),
      published: c(`SELECT COUNT(*) c FROM albums WHERE visibility = 'published'${scope}`),
      media: c(`SELECT COUNT(*) c FROM media WHERE album_id IN ${inAlbums}`),
      videos: c(`SELECT COUNT(*) c FROM media WHERE kind = 'video' AND album_id IN ${inAlbums}`),
      users: cu(`SELECT COUNT(*) c FROM users${userScope}`),
      pendingUsers: cu(`SELECT COUNT(*) c FROM users${userScope ? userScope + ' AND' : ' WHERE'} status = 'pending'`),
      activeUsers: cu(`SELECT COUNT(*) c FROM users${userScope ? userScope + ' AND' : ' WHERE'} last_seen_at > ${Date.now() - 7 * 86_400_000}`),
      likes: c(`SELECT COUNT(*) c FROM likes WHERE media_id IN (SELECT id FROM media WHERE album_id IN ${inAlbums})`),
      comments: c(`SELECT COUNT(*) c FROM comments WHERE album_id IN ${inAlbums} OR media_id IN (SELECT id FROM media WHERE album_id IN ${inAlbums})`),
      favorites: c(`SELECT COUNT(*) c FROM favorites WHERE album_id IN ${inAlbums}`),
      bytes: (db.prepare(`SELECT COALESCE(SUM(size), 0) c FROM media WHERE album_id IN ${inAlbums}`).get(...(scope ? gids : [])) as { c: number }).c,
      views: (db.prepare(`SELECT COALESCE(SUM(views), 0) c FROM albums WHERE 1=1${scope}`).get(...(scope ? gids : [])) as { c: number }).c,
      galleries: cAll('SELECT COUNT(*) c FROM galleries'),
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
