import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api/client'
import { keys, useMe } from '../api/hooks'
import type { User } from '../api/types'
import { useUI } from '../store/ui'
import { ColorModeToggle } from '../components/ColorModeToggle'
import { Avatar } from '../components/Avatar'

export function AccountPage() {
  const { data: user } = useMe()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const [displayName, setDisplayName] = useState(user?.display_name ?? '')
  const [bio, setBio] = useState(user?.bio ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')

  const profile = useMutation({
    mutationFn: () => api.put<{ user: User }>('/api/auth/profile', { displayName, bio }),
    onSuccess: (r) => {
      qc.setQueryData(keys.me, r.user)
      notify('Profile updated', 'success')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const password = useMutation({
    mutationFn: () => {
      if (next !== confirm) throw new Error('New passwords do not match')
      return api.post('/api/auth/password', { current, next })
    },
    onSuccess: () => {
      setCurrent('')
      setNext('')
      setConfirm('')
      notify('Password changed. Other devices were signed out.', 'success')
    },
    onError: (e: Error) => notify(e.message, 'error'),
  })

  if (!user) return null

  return (
    <main className="page narrow stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row" style={{ gap: 16 }}>
        <Avatar name={user.display_name} size={64} />
        <div>
          <div className="eyebrow">Account</div>
          <h1 style={{ margin: 0 }}>{user.display_name}</h1>
          <p className="muted" style={{ margin: 0 }}>
            @{user.username} · {user.role === 'admin' ? 'Administrator' : 'Member'} · joined {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <section className="card stack">
        <h3>Appearance</h3>
        <p className="muted small">Choose how the gallery looks on this device. The colour palette itself is set by the administrator.</p>
        <ColorModeToggle labels />
      </section>
      <form
        className="card stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          profile.mutate()
        }}
      >
        <h3>Profile</h3>
        <div className="field">
          <label>Display name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="field">
          <label>Bio</label>
          <textarea className="textarea" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="A line about you" style={{ minHeight: 72 }} />
        </div>
        <div>
          <button className="btn primary" disabled={profile.isPending}>
            Save profile
          </button>
        </div>
      </form>
      <form
        className="card stack"
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          password.mutate()
        }}
      >
        <h3>Change password</h3>
        <div className="field">
          <label>Current password</label>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field grow">
            <label>New password</label>
            <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="field grow">
            <label>Confirm</label>
            <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
        </div>
        <div>
          <button className="btn primary" disabled={password.isPending || !current || !next || !confirm}>
            Update password
          </button>
        </div>
      </form>
    </main>
  )
}
