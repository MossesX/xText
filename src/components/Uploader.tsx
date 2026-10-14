import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus, Upload } from 'lucide-react'
import { uploadRaw } from '../api/client'
import { kindOf, processFile } from '../lib/media'
import type { MediaItem } from '../api/types'

interface Item {
  name: string
  progress: number
  status: 'queued' | 'processing' | 'uploading' | 'done' | 'error'
  error?: string
}

export function Uploader({ albumId, onUploaded }: { albumId: number; onUploaded: (m: MediaItem) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [dragging, setDragging] = useState(false)

  const update = (i: number, patch: Partial<Item>) => setItems((list) => list.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => kindOf(f))
    if (!list.length) return
    const base = items.length
    setItems((old) => [...old, ...list.map((f) => ({ name: f.name, progress: 0, status: 'queued' as const }))])
    for (let i = 0; i < list.length; i++) {
      const idx = base + i
      const file = list[i]
      try {
        update(idx, { status: 'processing' })
        const meta = await processFile(file)
        update(idx, { status: 'uploading' })
        const res = (await uploadRaw(
          `/api/albums/${albumId}/media`,
          file,
          file.type || 'application/octet-stream',
          { fileName: file.name, width: meta.width, height: meta.height, duration: meta.duration, title: file.name.replace(/\.[^.]+$/, '') },
          (p) => update(idx, { progress: p * (meta.thumb ? 0.9 : 1) }),
        )) as { media: MediaItem }
        if (meta.thumb) {
          const withThumb = (await uploadRaw(`/api/media/${res.media.id}/thumb`, meta.thumb, 'image/webp', {})) as { media: MediaItem }
          onUploaded(withThumb.media)
        } else onUploaded(res.media)
        update(idx, { status: 'done', progress: 1 })
      } catch (err) {
        update(idx, { status: 'error', error: err instanceof Error ? err.message : 'Upload failed' })
      }
    }
    setTimeout(() => setItems((list) => list.filter((it) => it.status === 'error')), 2500)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  const active = items.filter((i) => i.status !== 'done')

  return (
    <div className="stack">
      <div
        className={`dropzone ${dragging ? 'active' : ''}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        role="button"
        tabIndex={0}
      >
        <div className="dropzone-icon">
          <ImagePlus size={26} strokeWidth={1.4} />
        </div>
        <div>
          <strong>Drop images or videos here</strong> or click to browse
        </div>
        <div className="small muted">JPEG, PNG, WebP, GIF, MP4, WebM. Thumbnails are generated on the fly.</div>
        <input ref={input} type="file" multiple accept="image/*,video/*" hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
      </div>
      {active.length > 0 && (
        <div className="upload-list">
          {items.map((it, i) => (
            <div className={`upload-row ${it.status}`} key={i}>
              <Upload size={14} />
              <span className="grow ellipsis">{it.name}</span>
              <span className="muted small">{it.status === 'error' ? it.error : it.status === 'done' ? 'Done' : it.status === 'uploading' ? `${Math.round(it.progress * 100)}%` : it.status}</span>
              <div className="progress">
                <div style={{ width: `${it.progress * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
