import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, Plus, Sparkles, Trash2, UserX, UserCheck } from 'lucide-react'
import { api } from '../../api/client'
import { keys, useGalleries, useMe, useUsers } from '../../api/hooks'
import type { Role, User } from '../../api/types'
import { Modal } from '../../components/Modal'
import { Avatar } from '../../components/Avatar'
import { CheckList } from '../../components/CheckList'
import { useUI } from '../../store/ui'

interface GalleryRef {
  id: number
  slug: string
  title: string
  owner: string
}

export function UsersPage() {
  const { data: me } = useMe()
  const { data: users } = useUsers()
  const { data: myGalleries } = useGalleries()
  const owner = me?.role === 'owner'
  const { data: allGalleries } = useQuery({ queryKey: ['admin-galleries'], queryFn: () => api.get<{ galleries: GalleryRef[] }>('/api/users/galleries').then((r) => r.galleries), enabled: owner })
  const qc = useQueryClient()
  const notify = useUI((s) => s.notify)
  const [createOpen, setCreateOpen] = useState(false)
  const [resetFor, setResetFor] = useState<User | null>(null)
  const [accessFor, setAccessFor] = useState<User | null>(null)
  const [accessIds, setAccessIds] = useState<number[]>([])
  const [generated, setGenerated] = useState<{ username: string; password: string } | null>(null)
  const [form, setForm] = useState({ username: '', displayName: '', password: '', role: 'user' as Role, galleryIds: [] as number[] })
  const [newPassword, setNewPassword] = useState('')
  const myGallery = myGalleries?.find((g) => g.isMine)
  const refresh = () => {
    qc.invalidateQueries({ queryKey: keys.users })
    qc.invalidateQueries({ queryKey: ['galleries'] })
  }
  useEffect(() => {
    if (accessFor) setAccessIds(accessFor.galleryIds ?? [])
  }, [accessFor])

  const create = useMutation({
    mutationFn: () => api.post('/api/users', form),
    onSuccess: () => {
      refresh()
      setCreateOpen(false)
      setForm({ username: '', displayName: '', password: '', role: 'user', galleryIds: [] })
      notify('Member created', 'success')
    },
  })
  const generate = useMutation({
    mutationFn: () => api.post<{ credentials: { username: string; password: string } }>('/api/users/generate', { galleryId: myGallery?.id }),
    onSuccess: (r) => {
      refresh()
      setGenerated(r.credentials)
    },
    onError: (e: Error) => notify(e.message, 'error'),
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
    onError: (e: Error) => notify(e.message, 'error'),
  })

  const galleryOptions = (allGalleries ?? []).map((g) => ({ id: g.id, label: g.title, hint: `by ${g.owner}` }))
  const copy = (text: string) => navigator.clipboard.writeText(text).then(() => notify('Copied', 'success'))

  return (
    <div className="stack" style={{ gap: 'calc(var(--space) * 3)' }}>
      <div className="row between">
        <div>
          <div className="eyebrow">{owner ? 'All accounts' : myGallery?.title ?? 'My gallery'}</div>
          <h1 style={{ margin: 0 }}>Members</h1>
        </div>
        <div className="row">
          <button className="btn accent" onClick={() => generate.mutate()} disabled={generate.isPending || !myGallery}>
            <Sparkles size={16} /> Generate member
          </button>
          <button className="btn primary" onClick={() => setCreateOpen(true)}>
            <Plus size={16} /> New member
          </button>
        </div>
      </div>
      <p className="muted small" style={{ margin: 0 }}>
        {owner
          ? 'Use the gallery column to choose which galleries each account can see. Admins own one gallery each and manage its albums and members.'
          : 'Members listed here can see your gallery. Generated members stay pending until they sign in for the first time.'}
      </p>
      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              {owner && <th>Galleries</th>}
              <th>Status</th>
              <th>Last seen</th>
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
                  {owner ? (
                    <select className="select" value={u.role} disabled={u.id === me?.id} onChange={(e) => update.mutate({ id: u.id, patch: { role: e.target.value } })} style={{ width: 'auto', padding: '4px 8px' }}>
                      <option value="user">Member</option>
                      <option value="admin">Admin (own gallery)</option>
                      <option value="owner">Owner</option>
                    </select>
                  ) : (
                    <span className="badge">{u.role === 'user' ? 'Member' : u.role}</span>
                  )}
                </td>
                {owner && (
                  <td>
                    <button className="btn sm" onClick={() => setAccessFor(u)}>
                      {(u.galleryIds?.length ?? 0)} of {allGalleries?.length ?? 0}
                    </button>
                  </td>
                )}
                <td>
                  {u.disabled ? <span className="badge">Disabled</span> : u.status === 'pending' ? <span className="badge status-pending">Pending first login</span> : <span className="badge success">Active</span>}
                </td>
                <td className="muted small">{u.last_seen_at ? new Date(u.last_seen_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'never'}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', gap: 2 }}>
                    <button className="btn ghost icon sm" title="Reset password" onClick={() => setResetFor(u)} disabled={!owner && u.role !== 'user'}>
                      <KeyRound size={14} />
                    </button>
                    <button className="btn ghost icon sm" title={u.disabled ? 'Enable' : 'Disable'} disabled={u.id === me?.id || (!owner && u.role !== 'user')} onClick={() => update.mutate({ id: u.id, patch: { disabled: !u.disabled } })}>
                      {u.disabled ? <UserCheck size={14} /> : <UserX size={14} />}
                    </button>
                    <button className="btn ghost icon sm danger" title="Delete" disabled={u.id === me?.id || (!owner && u.created_by !== me?.id)} onClick={() => confirm(`Delete ${u.username}? Their likes and comments will be removed.`) && remove.mutate(u.id)}>
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
          {owner && (
            <>
              <div className="field">
                <label>Role</label>
                <select className="select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                  <option value="user">Member (browse, like, comment)</option>
                  <option value="admin">Admin (gets their own gallery)</option>
                </select>
              </div>
              <div className="field">
                <label>Galleries this member can see</label>
                <CheckList options={galleryOptions} selected={form.galleryIds} onChange={(galleryIds) => setForm({ ...form, galleryIds })} />
              </div>
            </>
          )}
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
            update.mutate({ id: resetFor.id, patch: { password: newPassword } }, { onSuccess: () => { setResetFor(null); setNewPassword(''); notify('Password reset; the member is pending until they sign in again', 'success') } })
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

      <Modal open={!!accessFor} onClose={() => setAccessFor(null)} title={`Galleries for ${accessFor?.display_name ?? ''}`}>
        <div className="stack" style={{ gap: 'calc(var(--space) * 2)' }}>
          <CheckList options={galleryOptions} selected={accessIds} onChange={setAccessIds} />
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => setAccessFor(null)}>
              Cancel
            </button>
            <button className="btn primary" onClick={() => accessFor && update.mutate({ id: accessFor.id, patch: { galleryIds: accessIds } }, { onSuccess: () => { setAccessFor(null); notify('Gallery access saved', 'success') } })}>
              Save access
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={!!generated} onClose={() => setGenerated(null)} title="Member generated">
        {generated && (
          <div className="stack" style={{ gap: 'calc(var(--space) * 2)' }}>
            <p className="muted small" style={{ margin: 0 }}>
              Share these credentials with the member. The password is shown only once; the account stays pending until their first sign-in.
            </p>
            <div className="cred-box">
              <div className="row between">
                <span>
                  <span className="muted">user </span>
                  {generated.username}
                </span>
                <button className="btn ghost icon sm" onClick={() => copy(generated.username)} title="Copy username">
                  <Copy size={14} />
                </button>
              </div>
              <div className="row between">
                <span>
                  <span className="muted">pass </span>
                  {generated.password}
                </span>
                <button className="btn ghost icon sm" onClick={() => copy(generated.password)} title="Copy password">
                  <Copy size={14} />
                </button>
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => copy(`Sign in at ${location.origin}/login\nUsername: ${generated.username}\nPassword: ${generated.password}`)}>
                <Copy size={14} /> Copy invitation
              </button>
              <button className="btn primary" onClick={() => setGenerated(null)}>
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
