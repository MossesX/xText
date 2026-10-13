import { db } from '../db/db'
import { createUser } from './auth'
import { PRESET_THEMES } from '../theme/generate'
import { getSiteSettings, updateSiteSettings } from './settings'

export const DEFAULT_ADMIN = { username: 'admin', password: 'admin123' }

let seeding: Promise<void> | null = null

/** Ensures a default admin, preset themes and settings exist. Idempotent and safe to call concurrently. */
export function ensureSeeded(): Promise<void> {
  seeding ??= seed().catch((err) => {
    seeding = null
    throw err
  })
  return seeding
}

async function seed(): Promise<void> {
  const userCount = await db.users.count()
  if (userCount === 0) {
    try {
      await createUser({ ...DEFAULT_ADMIN, displayName: 'Administrator', role: 'admin' })
    } catch (err) {
      // Another tab may have seeded concurrently; a duplicate admin is fine to ignore.
      if (!(err instanceof Error && /taken|Constraint/i.test(err.message))) throw err
    }
  }
  await db.transaction('rw', db.themes, db.settings, async () => {
    const themeCount = await db.themes.count()
    if (themeCount === 0) {
      const now = Date.now()
      await db.themes.bulkAdd(PRESET_THEMES.map((t, i) => ({ ...t, createdAt: now + i })))
    }
    const settings = await getSiteSettings()
    if (settings.activeThemeId == null) {
      const first = await db.themes.orderBy('createdAt').first()
      if (first?.id != null) await updateSiteSettings({ activeThemeId: first.id })
    }
  })
}
