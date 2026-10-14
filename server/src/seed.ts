import { db, getSetting, now, setSetting } from './db.js'
import { hashPassword, newSalt } from './auth.js'
import { BRAND_THEMES, DEFAULT_SETTINGS } from './brand.js'

export const DEFAULT_ADMIN = { username: 'admin', password: process.env.ADMIN_PASSWORD ?? 'admin123' }

export function ensureSeeded(): void {
  const users = (db.prepare('SELECT COUNT(*) c FROM users').get() as { c: number }).c
  if (users === 0) {
    const salt = newSalt()
    db.prepare('INSERT INTO users(username, display_name, role, password_hash, salt, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      DEFAULT_ADMIN.username,
      'Administrator',
      'admin',
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
  const settings = getSetting<Record<string, unknown>>('site', {})
  const merged = { ...DEFAULT_SETTINGS, ...settings }
  if (merged.activeThemeId == null) {
    const first = db.prepare('SELECT id FROM themes ORDER BY created_at LIMIT 1').get() as { id: number } | undefined
    merged.activeThemeId = first?.id ?? null
  }
  setSetting('site', merged)
}
