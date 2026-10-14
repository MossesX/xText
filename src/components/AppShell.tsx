import { useEffect, useState, type FormEvent } from 'react'
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom'
import { Bookmark, LogOut, Search, Settings2, Shield } from 'lucide-react'
import { useLogout, useMe, useSettings } from '../api/hooks'
import { ColorModeToggle } from './ColorModeToggle'
import { Toast } from './Toast'
import { AmberMark, Wordmark } from '../brand/Logo'
import { Avatar } from './Avatar'

export function AppShell() {
  const { data: user } = useMe()
  const { data } = useSettings()
  const logout = useLogout()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  useEffect(() => setQ(params.get('q') ?? ''), [params])

  const search = (e: FormEvent) => {
    e.preventDefault()
    navigate(q.trim() ? `/?q=${encodeURIComponent(q.trim())}` : '/')
  }

  const settings = data?.settings

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <AmberMark size={34} />
            <Wordmark title={settings?.siteTitle ?? 'xGallery'} brand={settings?.brandName ?? 'AmberX'} />
          </Link>
          <form className="search" onSubmit={search} role="search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search galleries, tags…" aria-label="Search" />
          </form>
          <nav className="nav">
            <NavLink to="/" end>
              Galleries
            </NavLink>
            <NavLink to="/favorites">
              <Bookmark size={14} /> Saved
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin">
                <Settings2 size={14} /> Admin
              </NavLink>
            )}
            <ColorModeToggle />
            <NavLink to="/account" className="nav-user" title="Account">
              <Avatar name={user?.display_name ?? '?'} size={30} />
            </NavLink>
            <button
              className="btn ghost icon"
              title="Sign out"
              onClick={() => logout.mutateAsync().then(() => navigate('/login'))}
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="footer">
        <div className="footer-inner">
          <span className="row" style={{ gap: 8 }}>
            <AmberMark size={18} /> {settings?.siteTitle ?? 'xGallery'} · {settings?.tagline}
          </span>
          <span className="muted small row" style={{ gap: 6 }}>
            <Shield size={12} /> Private gallery · Powered by {settings?.brandName ?? 'AmberX'}
          </span>
        </div>
      </footer>
      <Toast />
    </div>
  )
}
