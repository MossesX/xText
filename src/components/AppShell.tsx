import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, Settings2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useSession } from '../store/session'
import { ColorModeToggle } from './ColorModeToggle'
import { getSiteSettings } from '../lib/settings'
import { Toast } from './Toast'

export function AppShell() {
  const user = useSession((s) => s.user)
  const logout = useSession((s) => s.logout)
  const navigate = useNavigate()
  const settings = useLiveQuery(() => getSiteSettings(), [])

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/" className="brand">
            <span className="brand-mark" />
            <span className="brand-text">{settings?.siteTitle ?? 'Lumen'}</span>
          </Link>
          <nav className="nav">
            <NavLink to="/" end>
              Galleries
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/admin">
                <span className="row" style={{ gap: 6 }}>
                  <Settings2 size={14} /> Admin
                </span>
              </NavLink>
            )}
            <NavLink to="/account">{user?.displayName ?? 'Account'}</NavLink>
            <ColorModeToggle />
            <button
              className="btn ghost icon"
              title="Sign out"
              onClick={() => {
                logout()
                navigate('/login')
              }}
            >
              <LogOut size={16} />
            </button>
          </nav>
        </div>
      </header>
      <Outlet />
      <footer className="footer">
        {settings?.siteTitle ?? 'Lumen'} &middot; {settings?.tagline}
      </footer>
      <Toast />
    </div>
  )
}
