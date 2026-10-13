import { db } from '../db/db'
import type { SiteSettings } from '../db/types'
import { DEFAULT_LAYOUT } from '../layouts/generate'

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  siteTitle: 'Lumen',
  tagline: 'A curated gallery',
  activeThemeId: null,
  defaultLayout: DEFAULT_LAYOUT,
  allowComments: true,
  allowLikes: true,
}

const KEY = 'site'

export async function getSiteSettings(): Promise<SiteSettings> {
  const row = await db.settings.get(KEY)
  return { ...DEFAULT_SITE_SETTINGS, ...((row?.value as Partial<SiteSettings>) ?? {}) }
}

export async function updateSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSiteSettings()
  const next = { ...current, ...patch }
  await db.settings.put({ key: KEY, value: next })
  return next
}
