import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Album, Comment, MediaItem, SiteSettings, Stats, Theme, ThemeDraft, User } from './types'

export const keys = {
  me: ['me'] as const,
  settings: ['settings'] as const,
  albums: (params: Record<string, string | undefined>) => ['albums', params] as const,
  album: (key: string) => ['album', key] as const,
  favorites: ['favorites'] as const,
  themes: ['themes'] as const,
  users: ['users'] as const,
  stats: ['stats'] as const,
  mediaComments: (id: number) => ['media-comments', id] as const,
  share: (token: string) => ['share', token] as const,
}

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => api.get<{ user: User | null }>('/api/auth/me').then((r) => r.user), staleTime: 60_000 })
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => api.get<{ settings: SiteSettings; theme: Theme | null }>('/api/settings'), staleTime: 60_000 })
}

export function useAlbums(params: { q?: string; tag?: string; sort?: string } = {}) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString()
  return useQuery({
    queryKey: keys.albums(params),
    queryFn: () => api.get<{ albums: Album[]; tags: { name: string; count: number }[] }>(`/api/albums${qs ? `?${qs}` : ''}`),
    placeholderData: (prev) => prev,
  })
}

export function useAlbum(key: string | undefined) {
  return useQuery({
    queryKey: keys.album(key ?? ''),
    queryFn: () => api.get<{ album: Album; media: MediaItem[]; comments: Comment[] }>(`/api/albums/${encodeURIComponent(key ?? '')}`),
    enabled: !!key,
  })
}

export function useFavorites() {
  return useQuery({ queryKey: keys.favorites, queryFn: () => api.get<{ albums: Album[] }>('/api/albums/favorites').then((r) => r.albums) })
}

export function useThemes() {
  return useQuery({ queryKey: keys.themes, queryFn: () => api.get<{ themes: Theme[] }>('/api/themes').then((r) => r.themes) })
}

export function useUsers() {
  return useQuery({ queryKey: keys.users, queryFn: () => api.get<{ users: User[] }>('/api/users').then((r) => r.users) })
}

export function useStats() {
  return useQuery({ queryKey: keys.stats, queryFn: () => api.get<Stats>('/api/settings/stats') })
}

export function useShare(token: string | undefined) {
  return useQuery({ queryKey: keys.share(token ?? ''), queryFn: () => api.get<{ album: Album; media: MediaItem[] }>(`/api/share/${token}`), enabled: !!token })
}

/** Invalidate everything that depends on gallery content. */
export function useInvalidate() {
  const qc = useQueryClient()
  return (...prefixes: string[]) => {
    for (const p of prefixes) qc.invalidateQueries({ queryKey: [p] })
  }
}

export function useLogin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { username: string; password: string }) => api.post<{ user: User }>('/api/auth/login', v),
    onSuccess: (r) => qc.setQueryData(keys.me, r.user),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(keys.me, null)
      qc.clear()
    },
  })
}

export function useToggleLike() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (mediaId: number) => api.post<{ media: MediaItem }>(`/api/media/${mediaId}/like`).then((r) => r.media),
    onSuccess: (media) => {
      qc.setQueriesData<{ album: Album; media: MediaItem[]; comments: Comment[] }>({ queryKey: ['album'] }, (old) =>
        old ? { ...old, media: old.media.map((m) => (m.id === media.id ? media : m)) } : old,
      )
    },
  })
}

export function useToggleFavorite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (albumId: number) => api.post<{ favorited: boolean }>(`/api/albums/${albumId}/favorite`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['albums'] })
      qc.invalidateQueries({ queryKey: ['album'] })
      qc.invalidateQueries({ queryKey: keys.favorites })
    },
  })
}

export function useSaveTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { id?: number; draft: ThemeDraft }) => (v.id ? api.put<{ theme: Theme }>(`/api/themes/${v.id}`, v.draft) : api.post<{ theme: Theme }>('/api/themes', v.draft)).then((r) => r.theme),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.themes }),
  })
}

export function useUpdateSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<SiteSettings>) => api.put<{ settings: SiteSettings }>('/api/settings', patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.settings }),
  })
}
