import { db, getSetting, now, setSetting } from './db.js'
import { hashPassword, newSalt } from './auth.js'
import { BRAND_THEMES, DEFAULT_SETTINGS } from './brand.js'
import { ensureGalleryFor, grantGallery } from './access.js'

export const DEFAULT_ADMIN = { username: 'admin', password: process.env.ADMIN_PASSWORD ?? 'admin123' }

export function ensureSeeded(): void {
  const users = (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c
  if (users === 0) {
    const salt = newSalt()
    db.prepare('INSERT INTO users(username, display_name, role, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      DEFAULT_ADMIN.username,
      'Administrator',
      'owner',
      hashPassword(DEFAULT_ADMIN.password, salt),
      salt,
      now(),
    )
  }
  const themes = (db.prepare('SELECT COUNT(*) c FROM themes').get() as { c: number }).c
  if (themes === 0) {
    const ins = db.prepare('INSERT INTO themes(name, light, dark, font_display, font_body, radius, scale, built_in, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)')
    BRAND_THEMES.forEach((t, i) => ins.run(t.name, JSON.stringify(t.light), JSON.stringify(t.dark), t.fontDisplay, t.fontBody, t.radius, t.scale, now() + i))
  }
  // Promote the first administrator to owner when upgrading from the single-admin schema.
  if (!db.prepare("SELECT 1 FROM users WHERE role = 'owner'").get()) {
    const first = db.prepare("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1").get() as { id: number } | undefined
    if (first) db.prepare("UPDATE users SET role = 'owner' WHERE id = ?").run(first.id)
  }
  // Every owner/admin has a gallery; orphan albums go to the owner's gallery; existing members keep access.
  const admins = db.prepare("SELECT id, display_name, role FROM users WHERE role IN ('owner', 'admin')").all() as { id: number; display_name: string; role: string }[]
  for (const a of admins) ensureGalleryFor(a.id, a.display_name)
  const owner = admins.find((a) => a.role === 'owner')
  if (owner) {
    const og = ensureGalleryFor(owner.id, owner.display_name)
    const orphans = (db.prepare('UPDATE albums SET gallery_id = ? WHERE gallery_id IS NULL').run(og.id) as { changes: number }).changes
    if (orphans > 0) {
      for (const u of db.prepare("SELECT id FROM users WHERE role = 'user'").all() as { id: number }[]) grantGallery(u.id, og.id)
    }
  }
  const settings = getSetting<Record<string, unknown>>('site', {})
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  if (merged.activeThemeId == null) {
    const first = db.prepare('SELECT id FROM themes ORDER BY created_at LIMIT 1').get() as { id: number } | undefined
    merged.activeThemeId = first?.id ?? null
  }
  setSetting('site', merged)
}
