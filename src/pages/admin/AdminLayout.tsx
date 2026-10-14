import { NavLink, Outlet } from 'react-router-dom'
import { Images, LayoutDashboard, Palette, SlidersHorizontal, Users } from 'lucide-react'

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/albums', label: 'Albums', icon: Images },
  { to: '/admin/users', label: 'Members', icon: Users },
  { to: '/admin/themes', label: 'Themes', icon: Palette },
  { to: '/admin/appearance', label: 'Appearance', icon: SlidersHorizontal },
]

export function AdminLayout() {
  return (
    <main className="page">
      <div className="admin-layout">
        <nav className="admin-nav">
          <div className="eyebrow" style={{ padding: '0 12px 8px' }}>
            Administration
          </div>
          {LINKS.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="grow" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  )
}
