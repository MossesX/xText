import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import { AppShell } from './components/AppShell'
import { RequireAuth } from './components/RequireAuth'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { AlbumPage } from './pages/AlbumPage'
import { AccountPage } from './pages/AccountPage'
import { FavoritesPage } from './pages/FavoritesPage'
import { SharePage } from './pages/SharePage'
import { GalleryPage } from './pages/GalleryPage'
import { PublicGalleryPage } from './pages/PublicGalleryPage'
import { GallerySettingsPage } from './pages/admin/GallerySettingsPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { DashboardPage } from './pages/admin/DashboardPage'
import { UsersPage } from './pages/admin/UsersPage'
import { AlbumsPage } from './pages/admin/AlbumsPage'
import { AlbumEditorPage } from './pages/admin/AlbumEditorPage'
import { ThemesPage } from './pages/admin/ThemesPage'
import { AppearancePage } from './pages/admin/AppearancePage'
import { ApiError } from './api/client'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 2,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/s/:token" element={<SharePage />} />
            <Route path="/public/:slug" element={<PublicGalleryPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppShell />}>
                <Route index element={<HomePage />} />
                <Route path="/album/:slug" element={<AlbumPage />} />
                <Route path="/g/:slug" element={<GalleryPage />} />
                <Route path="/favorites" element={<FavoritesPage />} />
                <Route path="/account" element={<AccountPage />} />
                <Route element={<RequireAuth role="admin" />}>
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<DashboardPage />} />
                    <Route path="gallery" element={<GallerySettingsPage />} />
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
    </QueryClientProvider>
  )
}
