import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useMe } from '../api/hooks'
import type { Role } from '../api/types'
import { PageLoader } from './Skeleton'

export function RequireAuth({ role }: { role?: Role }) {
  const { data: user, isLoading } = useMe()
  const location = useLocation()
  if (isLoading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return <Outlet />
}
