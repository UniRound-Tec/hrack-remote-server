'use client'

import { useLang } from '@/i18n/lang-context'
import { useEffect, useState, type FormEvent } from 'react'

type ManagedUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  role?: string | null
  banned?: boolean | null
  createdAt: string | Date
}

type UserList = {
  users: ManagedUser[]
  total: number
  limit?: number
  offset?: number
}

type AuditEntry = {
  id: string
  at: number
  action: string
  target: string | null
  fields: string[]
}

const PAGE_SIZE = 50

export function UserManagementPanel() {
  const { strings } = useLang()
  const copy = strings.admin.userManagement
  const [data, setData] = useState<UserList | null>(null)
  const [audit, setAudit] = useState<AuditEntry[]>([])
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [offset, setOffset] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null)

  async function load() {
    const params = new URLSearchParams({ offset: String(offset) })
    if (search) params.set('search', search)
    const [usersResponse, auditResponse] = await Promise.all([
      fetch(`/api/admin/users?${params}`),
      fetch('/api/admin/audit')
    ])
    if (!usersResponse.ok || !auditResponse.ok) throw new Error()
    setData((await usersResponse.json()) as UserList)
    setAudit(
      ((await auditResponse.json()) as { entries: AuditEntry[] }).entries
    )
  }

  useEffect(() => {
    void load().catch(() => setNotice(copy.loadFailed))
  }, [offset, search, copy.loadFailed])

  async function mutate(
    user: ManagedUser,
    action: string,
    extra: Record<string, unknown> = {}
  ) {
    setBusy(`${user.id}:${action}`)
    setNotice(null)
    setTemporaryPassword(null)
    try {
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, userId: user.id, ...extra })
      })
      const body = (await response.json().catch(() => ({}))) as {
        code?: string
        temporaryPassword?: string
      }
      if (!response.ok) {
        setNotice(
          body.code === 'LAST_ADMIN'
            ? copy.lastAdmin
            : body.code === 'EMAIL_CONFIRMATION_MISMATCH'
              ? copy.emailMismatch
              : body.code === 'PAIRING_REVOKE_FAILED'
                ? copy.pairingFailed
                : copy.actionFailed
        )
        return
      }
      if (body.temporaryPassword) {
        setTemporaryPassword(body.temporaryPassword)
      }
      setNotice(copy.actionSaved)
      await load()
    } catch {
      setNotice(copy.actionFailed)
    } finally {
      setBusy(null)
    }
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setOffset(0)
    setSearch(searchInput.trim())
  }

  function remove(user: ManagedUser) {
    const confirmation = window.prompt(
      copy.confirmDelete.replace('{email}', user.email)
    )
    if (confirmation !== null) {
      void mutate(user, 'delete', { confirmEmail: confirmation })
    }
  }

  return (
    <section>
      <p className="font-maple text-[11px] tracking-[0.18em] text-flame uppercase">
        {strings.admin.eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text-primary">
        {copy.title}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-7 text-text-muted">
        {copy.lead}
      </p>

      <form onSubmit={submitSearch} className="mt-7 flex max-w-lg gap-2">
        <input
          type="search"
          value={searchInput}
          placeholder={copy.searchPlaceholder}
          onChange={(event) => setSearchInput(event.target.value)}
          className="hrack-field h-10 min-w-0 flex-1 rounded-md border border-border-default bg-content px-3 text-[13px] text-text-primary"
        />
        <button className="hrack-press hrack-press-primary h-10 rounded-md bg-button-primary px-4 text-[12px] font-medium text-button-primary-fg">
          {copy.search}
        </button>
      </form>

      {notice && (
        <div role="status" className="mt-5 rounded-lg border border-border-default bg-surface px-3 py-2.5 text-[12px] text-text-secondary">
          {notice}
        </div>
      )}
      {temporaryPassword && (
        <div className="mt-3 rounded-lg border border-status-warning/30 bg-status-warning/5 p-3">
          <p className="text-[12px] text-text-secondary">{copy.temporaryPassword}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-surface-strong px-2 py-1.5 font-maple text-[12px] text-text-primary">
              {temporaryPassword}
            </code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(temporaryPassword)} className="hrack-press hrack-press-chip h-8 rounded-md px-3 text-[11px] text-text-secondary">
              {copy.copy}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-border-default bg-content">
        <table className="w-full min-w-[920px] border-collapse text-left text-[12px]">
          <thead className="border-b border-border-default bg-surface text-text-faint">
            <tr>
              {[copy.account, copy.role, copy.verified, copy.status, copy.created, copy.actions].map((label) => (
                <th key={label} className="px-4 py-3 font-medium">{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.users.map((user) => {
              const disabled = busy?.startsWith(`${user.id}:`) ?? false
              return (
                <tr key={user.id} className="border-b border-border-default/70 last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-primary">{user.name}</p>
                    <p className="mt-1 font-maple text-[10px] text-text-muted">{user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role === 'admin' ? 'admin' : 'user'}
                      disabled={disabled}
                      onChange={(event) => void mutate(user, 'role', { role: event.target.value })}
                      className="h-8 rounded-md border border-border-default bg-surface px-2 text-[11px] text-text-secondary"
                    >
                      <option value="user">{copy.userRole}</option>
                      <option value="admin">{copy.adminRole}</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.emailVerified ? copy.yes : copy.no}
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {user.banned ? copy.banned : copy.active}
                  </td>
                  <td className="px-4 py-3 font-maple text-[10px] text-text-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {!user.emailVerified && <Action disabled={disabled} onClick={() => void mutate(user, 'verify')}>{copy.verify}</Action>}
                      <Action disabled={disabled} onClick={() => void mutate(user, user.banned ? 'unban' : 'ban')}>{user.banned ? copy.unban : copy.ban}</Action>
                      <Action disabled={disabled} onClick={() => void mutate(user, 'revokeSessions')}>{copy.revokeSessions}</Action>
                      <Action disabled={disabled} onClick={() => void mutate(user, 'resetPassword')}>{copy.resetPassword}</Action>
                      <Action danger disabled={disabled} onClick={() => remove(user)}>{copy.delete}</Action>
                    </div>
                  </td>
                </tr>
              )
            })}
            {data && data.users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">{copy.empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-text-muted">
        <span>{copy.total.replace('{count}', String(data?.total ?? 0))}</span>
        <div className="flex gap-2">
          <button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))} className="hrack-press hrack-press-chip h-8 rounded-md px-3 disabled:opacity-40">{copy.previous}</button>
          <button type="button" disabled={!data || offset + PAGE_SIZE >= data.total} onClick={() => setOffset(offset + PAGE_SIZE)} className="hrack-press hrack-press-chip h-8 rounded-md px-3 disabled:opacity-40">{copy.next}</button>
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-[15px] font-semibold text-text-primary">{copy.auditTitle}</h2>
        <div className="mt-3 divide-y divide-border-default rounded-xl border border-border-default bg-content">
          {audit.slice(0, 10).map((entry) => (
            <div key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 font-maple text-[10px] text-text-muted">
              <span className="text-text-secondary">{entry.action}</span>
              <span>{entry.target}</span>
              <span>{entry.fields.join(', ')}</span>
              <time className="ml-auto">{new Date(entry.at).toLocaleString()}</time>
            </div>
          ))}
          {audit.length === 0 && <p className="px-4 py-8 text-center text-[12px] text-text-muted">{copy.auditEmpty}</p>}
        </div>
      </div>
    </section>
  )
}

function Action({ children, danger = false, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button type="button" {...props} className={`hrack-press hrack-press-chip h-7 rounded px-2 text-[10px] disabled:opacity-40 ${danger ? 'text-status-error' : 'text-text-secondary'}`}>
      {children}
    </button>
  )
}
