import express, { type Request, type Response, type NextFunction } from 'express'
import path from 'node:path'
import { existsSync } from 'node:fs'
import { attachUser, pruneSessions } from './auth.js'
import { ensureSeeded } from './seed.js'
import { HttpError } from './util.js'
import { authRouter } from './routes/auth.js'
import { usersRouter } from './routes/users.js'
import { albumsRouter, shareRouter } from './routes/albums.js'
import { mediaRouter } from './routes/media.js'
import { themesRouter } from './routes/themes.js'
import { settingsRouter } from './routes/settings.js'
import { galleriesRouter, publicRouter } from './routes/galleries.js'

ensureSeeded()
pruneSessions()
setInterval(pruneSessions, 6 * 3600 * 1000).unref()

export const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

app.get('/healthz', (_req, res) => res.type('text').send('ok'))

app.use('/api', attachUser)
app.use('/api', express.json({ limit: '1mb' }))
app.use('/api/auth', authRouter)
app.use('/api/users', usersRouter)
app.use('/api/albums', albumsRouter)
app.use('/api/share', shareRouter)
app.use('/api/galleries', galleriesRouter)
app.use('/api/public', publicRouter)
app.use('/api/themes', themesRouter)
app.use('/api/settings', settingsRouter)
app.use('/api', mediaRouter)
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))

// Static client
const clientDir = process.env.CLIENT_DIR ?? path.resolve(process.cwd(), 'dist')
if (existsSync(clientDir)) {
  app.use('/assets', express.static(path.join(clientDir, 'assets'), { immutable: true, maxAge: '1y' }))
  app.use(express.static(clientDir, { index: false, maxAge: '1h' }))
  app.get(/.*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache')
    res.sendFile(path.join(clientDir, 'index.html'))
  })
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  const e = err as { type?: string; status?: number; message?: string }
  if (e?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON' })
    return
  }
  console.error(err)
  res.status(e?.status ?? 500).json({ error: e?.message && e.status ? e.message : 'Internal server error' })
})
