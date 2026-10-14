import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Trash2, UserX, UserCheck } from 'lucide-react'
import { api } from '../../api/client'
import { keys, useMe, useUsers } from '../../api/hooks'
import type { Role, User } from '../../api/types'
import { Modal } from '../../components/Modal'
import { Avatar } from '../../components/Avatar'
import { useUI } from '../../store/ui'

export function UsersPage() {
  const { data: me } = useMe()
  const { data: users } = useUsers()
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<User | null>(null)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' as Role })
  const [newPassword, setNewPassword] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: keys.users })

  const create = useMutation({
    mutationFn: () => api.post('/api/users', form),
    onSuccess: () => {
      refresh()
      setCreateOpen(false)
      setForm({ username: '', displayName: '', password: '', role: 'user' })
      notify('Member created', 'success')
    },
  })
  const update = useMutation({
    mutationFn: (v: { id: number; patch: Record<string, unknown> }) => api.put(`/api/users/${v.id}`, v.patch),
    onSuccess: refresh,
    onError: (e: Error) => notify(e.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: number) => api.del(`/api/users/${id}`),
    onSuccess: () => {
      refresh()
      notify('Member deleted')
    },
  })

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">Access</div>
          <h1 style={{ margin: 0 }}>Members</h1>
        </div>
        <button className="btn primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New member
        </button>
      </div>
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Activity</th>
              <th>Last seen</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td>
                  <div className="row" style={{ gap: 10 }}>
                    <Avatar name={u.display_name} />
                    <div>
                      <strong>{u.display_name}</strong>
                      <div className="muted small">@{u.username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <select className="select" value={u.role} disabled={u.id === me?.id} onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })} style={{ width: 'auto', padding: '4px 8px' }}>
                    <option value="user">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="muted small">
                  {u.likes} likes · {u.comments} comments
                </td>
                <td className="muted small">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}</td>
                <td>{u.disabled ? <span className="badge">Disabled</span> : <span className="badge success">Active</span>}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                    <button className="btn ghost icon sm" title="Reset password" onClick={() => setResetFor(u)}>
                      <KeyRound size={14} />
                    </button>
                    <button className="btn ghost icon sm" title={u.disabled ? 'Enable' : 'Disable'} disabled={u.id === me?.id} onClick={() => update.mutate({ id: u.id, patch: { disabled: !u.disabled } })}>
                      {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />}
                    </button>
                    <button className="btn ghost icon sm danger" title="Delete" disabled={u.id === me?.id} onClick={() => confirm(`Delete ${u.username}? Their likes and comments will be removed.`) && remove.mutate(u.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="New member">
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            create.mutate()
          }}
          style={{ gap: 'calc(var(--space) * 2)' }}
        >
          {create.error && <div className="error">{create.error.message}</div>}
          <div className="field">
            <label>Login name</label>
            <input className="input" autoFocus value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="jane.doe" />
          </div>
          <div className="field">
            <label>Display name</label>
            <input className="input" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Jane Doe" />
          </div>
          <div className="field">
            <label>Password (8+ characters)</label>
            <input className="input" type="text" autoComplete="off" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>
          <div className="field">
            <label>Role</label>
            <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              <option value="user">Member (browse, like, comment)</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button className="btn primary" disabled={create.isPending}>
              Create member
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!resetFor} onClose={() => setResetFor(null)} title={`Reset password for ${resetFor?.username ?? ''}`}>
        <form
          className="stack"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (!resetFor) return
            update.mutate({ id: resetFor.id, patch: { password: newPassword } }, { onSuccess: () => {
              setResetFor(null)
              setNewPassword('')
              notify('Password reset', 'success')
            } })
          }}
          style={{ gap: 'calc(var(--space) * 2)' }}
        >
          <div className="field">
            <label>New password (8+ characters)</label>
            <input className="input" type="text" autoFocus autoComplete="off" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn" onClick={() => setResetFor(null)}>
              Cancel
            </button>
            <button className="btn primary" disabled={newPassword.length < 8}>
              Reset
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
