import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useLogin, useMe, useSettings } from '../api/hooks'
import { ColorModeToggle } from '../components/ColorModeToggle'
import { AmberMark } from '../brand/Logo'

export function LoginPage() {
  const { data: user, isLoading } = useMe()
  const { data } = useSettings()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (isLoading) return null
  if (user) return <Navigate to={from} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    try {
      await login.mutateAsync({ username, password })
      navigate(from, { replace: true })
    } catch {
      /* error shown below */
    }
  }

  const s = data?.settings

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div className="login-hero-art" aria-hidden="true">
          <span className="orb orb-a" />
          <span className="orb orb-b" />
          <span className="grid-lines" />
        </div>
        <div className="login-hero-content">
          <div className="row" style={{ gap: 12, marginBottom: 28 }}>
            <AmberMark size={44} />
            <span className="eyebrow" style={{ color: 'var(--c-text)' }}>{s?.brandName ?? 'AmberX'}</span>
          </div>
          <h1>{s?.siteTitle ?? 'xGallery'}</h1>
          <p className="lead">{s?.tagline ?? 'Curated visual stories.'}</p>
          <ul className="login-points">
            <li>Private, invitation-only galleries</li>
            <li>Photography and film in full resolution</li>
            <li>React, save and discuss with the community</li>
          </ul>
        </div>
      </section>
      <section className="login-form">
        <form className="card pad-lg stack" onSubmit={submit} style={{ gap: 'calc(var(--space) * 2)' }}>
          <div className="row between">
            <div>
              <div className="eyebrow">Members</div>
              <h2 style={{ margin: 0 }}>Sign in</h2>
            </div>
            <ColorModeToggle />
          </div>
          {login.error && <div className="error">{login.error.message}</div>}
          <div className="field">
            <label htmlFor="username">Username</label>
            <input id="username" className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <button className="btn primary lg" disabled={login.isPending || !username || !password}>
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="muted small" style={{ margin: 0 }}>
            No account? Access is granted by the gallery administrator.
          </p>
        </form>
      </section>
    </div>
  )
}
