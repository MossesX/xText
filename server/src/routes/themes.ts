import { Router } from 'express'
import { db, now } from '../db.js'
import { requireOwner, requireUser } from '../auth.js'
import { HttpError, num, str, wrap, parseJson, IdRow } from '../util.js'

export const themesRouter = Router()

function themeJson(r: Record<string, unknown>) {
  return {
    id: r.id,
    name: r.name,
    light: parseJson(r.light, {}),
    dark: parseJson(r.dark, {}),
    fontDisplay: r.font_display,
    fontBody: r.font_body,
    radius: r.radius,
    scale: r.scale,
    builtIn: !!r.built_in,
    createdAt: r.created_at,
  }
}

const REQUIRED = ['bg', 'bgElevated', 'surface', 'surfaceHover', 'border', 'text', 'textMuted', 'primary', 'primaryText', 'accent', 'accentText', 'danger', 'success']

function validPalette(p: unknown): Record<string, string> {
  if (!p || typeof p !== 'object') throw new HttpError(400, 'Palette missing')
  const out: Record<string, string> = {}
  for (const k of REQUIRED) {
    const v = (p as IdRow)[k]
    if (typeof v !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(v)) throw new HttpError(400, `Palette colour "${k}" must be a hex colour`)
    out[k] = v.toLowerCase()
  }
  return out
}

themesRouter.get(
  '/',
  requireUser,
  wrap((_req, res) => {
    res.json({ themes: (db.prepare('SELECT * FROM themes ORDER BY created_at').all() as IdRow[]).map(themeJson) })
  }),
)

themesRouter.post(
  '/',
  requireOwner,
  wrap((req, res) => {
    const b = req.body ?? {}
    const info = db
      .prepare('INSERT INTO themes(name, light, dark, font_display, font_body, radius, scale, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(str(b.name, 60) || 'Untitled theme', JSON.stringify(validPalette(b.light)), JSON.stringify(validPalette(b.dark)), str(b.fontDisplay, 60) || 'Sora', str(b.fontBody, 60) || 'Inter', num(b.radius, 12), num(b.scale, 1), now())
    res.status(201).json({ theme: themeJson(db.prepare('SELECT * FROM themes WHERE id = ?').get(info.lastInsertRowid as number) as IdRow) })
  }),
)

themesRouter.put(
  '/:id',
  requireOwner,
  wrap((req, res) => {
    const id = Number(req.params.id)
    const row = db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as IdRow | undefined
    if (!row) throw new HttpError(404, 'Theme not found')
    const b = req.body ?? {}
    db.prepare('UPDATE themes SET name = ?, light = ?, dark = ?, font_display = ?, font_body = ?, radius = ?, scale = ? WHERE id = ?').run(
      str(b.name, 60) || (row.name as string),
      JSON.stringify(validPalette(b.light ?? parseJson(row.light, {}))),
      JSON.stringify(validPalette(b.dark ?? parseJson(row.dark, {}))),
      str(b.fontDisplay, 60) || (row.font_display as string),
      str(b.fontBody, 60) || (row.font_body as string),
      num(b.radius, row.radius as number),
      num(b.scale, row.scale as number),
      id,
    )
    res.json({ theme: themeJson(db.prepare('SELECT * FROM themes WHERE id = ?').get(id) as IdRow) })
  }),
)

themesRouter.delete(
  '/:id',
  requireOwner,
  wrap((req, res) => {
    const id = Number(req.params.id)
    const active = (db.prepare('SELECT value FROM settings WHERE key = ?').get('site') as { value: string } | undefined)?.value
    if (active && (JSON.parse(active) as { activeThemeId?: number }).activeThemeId === id) throw new HttpError(400, 'Deactivate this theme before deleting it')
    db.prepare('DELETE FROM themes WHERE id = ?').run(id)
    res.json({ ok: true })
  }),
)
