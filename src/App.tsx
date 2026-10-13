import { useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { AppShell } from './components/AppShell'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { AlbumPage } from './pages/AlbumPage'
import { AccountPage } from './pages/AccountPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { DashboardPage } from './pages/admin/DashboardPage'
import { UsersPage } from './pages/admin/UsersPage'
import { AlbumsPage } from './pages/admin/AlbumsPage'
import { AlbumEditorPage } from './pages/admin/AlbumEditorPage'
import { ThemesPage } from './pages/admin/ThemesPage'
import { AppearancePage } from './pages/admin/AppearancePage'
import { ensureSeeded } from './lib/seed'
import { useSession } from './store/session'

export default function App() {
  const [ready, setReady] = useState(false)
  const refresh = useSession((s) => s.refresh)

  useEffect(() => {
    ensureSeeded()
      .then(refresh)
      .finally(() => setReady(true))
  }, [refresh])

  if (!ready) return null

  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="/album/:slug" element={<AlbumPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route element={<RequireAuth role="admin" />}>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<DashboardPage />} />
                  <Route path="users" element={<UsersPage />} />
                  <Route path="albums" element={<AlbumsPage />} />
                  <Route path="albums/:id" element={<AlbumEditorPage />} />
                  <Route path="themes" element={<ThemesPage />} />
                  <Route path="appearance" element={<AppearancePage />} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
