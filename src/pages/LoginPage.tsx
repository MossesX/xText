import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSession } from '../store/session'
import { getSiteSettings } from '../lib/settings'
import { ColorModeToggle } from '../components/ColorModeToggle'
import { DEFAULT_ADMIN } from '../lib/seed'
import { db } from '../db/db'

export function LoginPage() {
  const user = useSession((s) => s.user)
  const login = useSession((s) => s.login)
  const navigate = useNavigate()
  const location = useLocation()
  const settings = useLiveQuery(() => getSiteSettings(), [])
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const userCount = useLiveQuery(() => db.users.count(), [])

  if (user) return <Navigate to={(location.state as { from?: string } | null)?.from ?? '/'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(undefined)
    try {
      await login(username, password)
      navigate((location.state as { from?: string } | null)?.from ?? '/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="eyebrow" style={{ marginBottom: 16 }}>{settings?.tagline ?? 'A curated gallery'}</div>
        <h1>{settings?.siteTitle ?? 'Lumen'}</h1>
        <p className="muted" style={{ maxWidth: 440 }}>
          Private galleries of photography and film, curated by the administrator for members to browse, like and discuss.
        </p>
      </section>
      <section className="login-form">
        <form className="card pad-lg stack" onSubmit={submit} style={{ gap: 'calc(var(--space) * 2)' }}>
          <div className="row between">
            <h2 style={{ margin: 0 }}>Sign in</h2>
            <ColorModeToggle />
          </div>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn primary" disabled={busy || !username || !password}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          {userCount === 1 && (
            <p className="muted small" style={{ margin: 0 }}>
              First run: sign in as <code>{DEFAULT_ADMIN.username}</code> / <code>{DEFAULT_ADMIN.password}</code> and change the password under Account.
            </p>
          )}
        </form>
      </section>
    </div>
  )
}
