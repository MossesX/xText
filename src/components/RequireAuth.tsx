import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useSession } from '../store/session'
import type { Role } from '../db/types'

export function RequireAuth({ role }: { role?: Role }) {
  const user = useSession((s) => s.user)
  const hydrated = useSession((s) => s.hydrated)
  const location = useLocation()
  if (!hydrated) return null
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return <Outlet />
}
