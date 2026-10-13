import { useState, type FormEvent } from 'react'
import { useSession } from '../store/session'
import { setPassword, verifyPassword } from '../lib/auth'
import { useUI } from '../store/ui'
import { ColorModeToggle } from '../components/ColorModeToggle'
import { db } from '../db/db'

export function AccountPage() {
  const user = useSession((s) => s.user)
  const refresh = useSession((s) => s.refresh)
  const notify = useUI((s) => s.notify)
  const [displayName, setDisplayName] = useState(user?.displayName ?? '')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string>()

  if (!user) return null

  const saveName = async (e: FormEvent) => {
    e.preventDefault()
    await db.users.update(user.id!, { displayName: displayName.trim() || user.username })
    await refresh()
    notify('Display name updated', 'success')
  }

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    try {
      if (!(await verifyPassword(user, current))) throw new Error('Current password is incorrect.')
      if (next !== confirm) throw new Error('New passwords do not match.')
      await setPassword(user.id!, next)
      await refresh()
      setCurrent('')
      setNext('')
      setConfirm('')
      notify('Password changed', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  return (
    <main className="page narrow stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div>
        <div className="eyebrow">Account</div>
        <h1>{user.displayName}</h1>
        <p className="muted">
          Signed in as <strong>{user.username}</strong> · {user.role}
        </p>
      </div>
      <section className="card stack">
        <h3>Appearance</h3>
        <p className="muted small">Choose how the gallery looks on this device.</p>
        <ColorModeToggle labels />
      </section>
      <form className="card stack" onSubmit={saveName}>
        <h3>Profile</h3>
        <div className="field">
          <label>Display name</label>
          <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div>
          <button className="btn primary">Save</button>
        </div>
      </form>
      <form className="card stack" onSubmit={changePassword}>
        <h3>Change password</h3>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Current password</label>
          <input className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </div>
        <div className="field">
          <label>New password</label>
          <input className="input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
        </div>
        <div className="field">
          <label>Confirm new password</label>
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <div>
          <button className="btn primary" disabled={!current || !next || !confirm}>
            Update password
          </button>
        </div>
      </form>
    </main>
  )
}
