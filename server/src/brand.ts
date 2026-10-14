/** AmberX brand palettes, ported from the AmberX framework's theme definitions. */

export interface Palette {
  bg: string
  bgElevated: string
  surface: string
  surfaceHover: string
  border: string
  text: string
  textMuted: string
  primary: string
  primaryText: string
  accent: string
  accentText: string
  danger: string
  success: string
}

export interface ThemeSeed {
  name: string
  light: Palette
  dark: Palette
  fontDisplay: string
  fontBody: string
  radius: number
  scale: number
}

export const AMBER = '#e8821e'
export const AMBER_GOLD = '#f0b54a'

const amberLight: Palette = {
  bg: '#f6f3ee',
  bgElevated: '#ffffff',
  surface: '#ffffff',
  surfaceHover: '#f1ebe2',
  border: '#e4dccf',
  text: '#1f2329',
  textMuted: '#6b7280',
  primary: AMBER,
  primaryText: '#ffffff',
  accent: '#2563eb',
  accentText: '#ffffff',
  danger: '#d83a31',
  success: '#2e9e54',
}

const amberDark: Palette = {
  bg: '#14100b',
  bgElevated: '#1c160d',
  surface: '#1f1810',
  surfaceHover: '#2a2114',
  border: '#352a18',
  text: '#f0e8da',
  textMuted: '#a89878',
  primary: AMBER_GOLD,
  primaryText: '#160f06',
  accent: '#d99524',
  accentText: '#160f06',
  danger: '#ef6b63',
  success: '#4cc98c',
}

export const BRAND_THEMES: ThemeSeed[] = [
  {
    name: 'AmberX',
    light: amberLight,
    dark: amberDark,
    fontDisplay: 'Sora',
    fontBody: 'Inter',
    radius: 14,
    scale: 1,
  },
  {
    name: 'Amber Noir',
    light: { ...amberLight, bg: '#f3f4f6', surfaceHover: '#eef0f3', border: '#e3e6eb', accent: '#d9760f', accentText: '#ffffff' },
    dark: { ...amberDark, bg: '#0b0a09', bgElevated: '#121110', surface: '#161412', surfaceHover: '#201c18', border: '#2b2520', primary: AMBER, primaryText: '#ffffff' },
    fontDisplay: 'Playfair Display',
    fontBody: 'Inter',
    radius: 6,
    scale: 1,
  },
  {
    name: 'Azure Studio',
    light: { ...amberLight, bg: '#f2f6fb', surfaceHover: '#e8eef7', border: '#d8e1ee', primary: '#2563eb', accent: AMBER, accentText: '#ffffff' },
    dark: { ...amberDark, bg: '#0a0f1a', bgElevated: '#0f1626', surface: '#131b2e', surfaceHover: '#1b2540', border: '#263352', text: '#e6ecf7', textMuted: '#8b9bbd', primary: '#60a5fa', primaryText: '#061024', accent: AMBER_GOLD },
    fontDisplay: 'Space Grotesk',
    fontBody: 'Inter',
    radius: 18,
    scale: 1,
  },
]

export const DEFAULT_LAYOUT = {
  kind: 'masonry',
  columns: 3,
  gap: 16,
  caption: 'hover',
  shape: 'natural',
  rounded: true,
  hoverZoom: true,
  showLikes: true,
  heroCover: true,
}

export const DEFAULT_SETTINGS = {
  siteTitle: 'xGallery',
  tagline: 'Curated visual stories by AmberX',
  brandName: 'AmberX',
  activeThemeId: null as number | null,
  defaultLayout: DEFAULT_LAYOUT,
  allowComments: true,
  allowLikes: true,
  allowDownloads: true,
  heroAlbumId: null as number | null,
}
