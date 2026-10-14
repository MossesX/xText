import { NavLink, Outlet } from 'react-router-dom'
import { Images, LayoutDashboard, Palette, SlidersHorizontal, Sparkles, Users } from 'lucide-react'
import { useMe } from '../../api/hooks'

const LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/gallery', label: 'My gallery', icon: Sparkles },
  { to: '/admin/albums', label: 'Albums', icon: Images },
  { to: '/admin/users', label: 'Members', icon: Users },
  { to: '/admin/themes', label: 'Themes', icon: Palette, ownerOnly: true },
  { to: '/admin/appearance', label: 'Site appearance', icon: SlidersHorizontal, ownerOnly: true },
]

export function AdminLayout() {
  const { data: me } = useMe()
  return (
    <main className="page">
      <div className="admin-layout">
        <nav className="admin-nav">
          <div className="eyebrow" style={{ padding: '0 12px 8px' }}>
            Administration
          </div>
          {LINKS.filter((l) => !l.ownerOnly || me?.role === 'owner').map(({ to, label, icon: Icon, end }) => (
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
