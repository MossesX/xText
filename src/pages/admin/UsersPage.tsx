import { useState, type FormEvent } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { KeyRound, Plus, Trash2, UserX, UserCheck } from 'lucide-react'
import { db } from '../../db/db'
import { createUser, setPassword } from '../../lib/auth'
import { Modal } from '../../components/Modal'
import { useUI } from '../../store/ui'
import { useSession } from '../../store/session'
import type { Role, User } from '../../db/types'

export function UsersPage() {
  const me = useSession((s) => s.user)
  const notify = useUI((s) => s.notify)
  const users = useLiveQuery(() => db.users.orderBy('createdAt').toArray(), [])
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' as Role })
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string>()

  const submitCreate = async (e: FormEvent) => {
    e.preventDefault()
    setError(undefined)
    try {
      await createUser(form)
      setCreateOpen(false)
      setForm({ username: '', displayName: '', password: '', role: 'user' })
      notify('User created', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const submitReset = async (e: FormEvent) => {
    e.preventDefault()
    if (!resetFor?.id) return
    setError(undefined)
    try {
      await setPassword(resetFor.id, newPassword)
      setResetFor(null)
      setNewPassword('')
      notify('Password reset', 'success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed')
    }
  }

  const remove = async (u: User) => {
    if (!confirm(`Delete ${u.username}? Their likes and comments will be removed.`)) return
    await db.transaction('rw', db.users, db.likes, db.comments, async () => {
      await db.likes.where('userId').equals(u.id!).delete()
      await db.comments.where('userId').equals(u.id!).delete()
      await db.users.delete(u.id!)
    })
    notify('User deleted')
  }

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">Access</div>
          <h1 style={{ margin: 0 }}>Users</h1>
        </div>
        <button className="btn primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New user
        </button>
      </div>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Created</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="avatar">{u.displayName.slice(0, 2)}</div>
                    <div>
                      <strong>{u.displayName}</strong>
                      <div className="muted small">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select
                    className="select"
                    value={u.role}
                    disabled={u.id === me?.id}
                    onChange={(e) => db.users.update(u.id!, { role: e.target.value as Role })}
                    style={{ width: 'auto', padding: '4px 8px' }}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="muted small">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>{u.disabled ? <span className="badge">Disabled</span> : <span className="badge success">Active</span>}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                    <button className="btn ghost icon sm" title="Reset password" onClick={() => setResetFor(u)}>
                      <KeyRound size={14} />
                    </button>
                    <button
                      className="btn ghost icon sm"
                      title={u.disabled ? 'Enable' : 'Disable'}
                      disabled={u.id === me?.id}
                      onClick={() => db.users.update(u.id!, { disabled: !u.disabled })}
                    >
                      {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />}
                    </button>
                    <button className="btn ghost icon sm danger" title="Delete" disabled={u.id === me?.id} onClick={() => remove(u)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New user">
        <form className="stack" onSubmit={submitCreate} style={{ gap: 'calc(var(--space) * 2)' }}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label>Login name</label>
            <input className="input" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="jane.doe" />
          </div>
          <div className="field">
            <label>Display name</label>
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className="field">
            <label>Password</label>
            <input className="input" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field">
            <label>Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="user">User (browse, like, comment)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn primary">Create user</button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password for ${resetFor?.username ?? ''}`}>
        <form className="stack" onSubmit={submitReset} style={{ gap: 'calc(var(--space) * 2)' }}>
          {error && <div className="error">{error}</div>}
          <div className="field">
            <label>New password</label>
            <input className="input" type="text" autoFocus autoComplete="off" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setResetFor(null)}>
              Cancel
            </button>
            <button className="btn primary">Reset</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
