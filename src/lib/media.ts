import type { MediaKind } from '../api/types'

const THUMB_MAX = 640

export function kindOf(file: File): MediaKind | null {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  return null
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/webp', quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Thumbnail failed'))), type, quality)
  })
}

function drawScaled(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const ratio = Math.min(1, THUMB_MAX / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(w * ratio))
  canvas.height = Math.max(1, Math.round(h * ratio))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  return canvas
}

export interface ProcessedMedia {
  kind: MediaKind
  width: number
  height: number
  duration?: number
  thumb?: Blob
}

export async function processImage(file: File): Promise<ProcessedMedia> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not decode image'))
      el.src = url
    })
    const w = img.naturalWidth
    const h = img.naturalHeight
    let thumb: Blob | undefined
    try {
      thumb = await canvasToBlob(drawScaled(img, w, h))
    } catch {
      thumb = undefined
    }
    return { kind: 'image', width: w, height: h, thumb }
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function processVideo(file: File): Promise<ProcessedMedia> {
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Could not decode video'))
      video.src = url
    })
    const w = video.videoWidth || 16
    const h = video.videoHeight || 9
    const duration = Number.isFinite(video.duration) ? video.duration : undefined
    let thumb: Blob | undefined
    try {
      await new Promise<void>((resolve) => {
        const done = () => resolve()
        video.onseeked = done
        const t = Math.min(1, (duration ?? 0) / 2)
        video.currentTime = t
        setTimeout(done, 1500)
      })
      thumb = await canvasToBlob(drawScaled(video, w, h))
    } catch {
      thumb = undefined
    }
    return { kind: 'video', width: w, height: h, duration, thumb }
  } finally {
    video.removeAttribute('src')
    video.load()
    URL.revokeObjectURL(url)
  }
}

export async function processFile(file: File): Promise<ProcessedMedia> {
  const kind = kindOf(file)
  if (kind === 'image') return processImage(file)
  if (kind === 'video') return processVideo(file)
  throw new Error(`Unsupported file type: ${file.type || 'unknown'}`)
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`
  return `${(n / 1024 ** 3).toFixed(2)} GB`
}

export function formatDuration(s?: number | null): string {
  if (!s || !Number.isFinite(s)) return ''
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'album'
  )
}
