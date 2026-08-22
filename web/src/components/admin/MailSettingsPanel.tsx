'use client'

import { useLang } from '@/i18n/lang-context'
import type { MailSettingsView } from '@/lib/settings/admin'
import { useEffect, useState } from 'react'

type Form = {
  host: string
  port: string
  security: 'tls' | 'starttls' | 'none'
  username: string
  password: string
  from: string
  verification: boolean
}

const EMPTY: Form = {
  host: '',
  port: '587',
  security: 'starttls',
  username: '',
  password: '',
  from: '',
  verification: false
}

export function MailSettingsPanel() {
  const { strings } = useLang()
  const copy = strings.admin.settings
  const [view, setView] = useState<MailSettingsView | null>(null)
  const [form, setForm] = useState<Form>(EMPTY)
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function apply(next: MailSettingsView) {
    setView(next)
    setForm({
      host: next.smtp.host,
      port: next.smtp.port?.toString() ?? '587',
      security: next.smtp.security,
      username: next.smtp.username,
      password: '',
      from: next.smtp.from,
      verification: next.emailVerificationRequired.value
    })
  }

  async function load() {
    const response = await fetch('/api/admin/settings/mail')
    if (!response.ok) throw new Error()
    apply((await response.json()) as MailSettingsView)
  }

  useEffect(() => {
    void load().catch(() => setNotice(copy.loadFailed))
  }, [copy.loadFailed])

  async function action(name: string, request: () => Promise<Response>) {
    setBusy(name)
    setNotice(null)
    try {
      const response = await request()
      const body = (await response.json().catch(() => ({}))) as
        | MailSettingsView
        | { code?: string; ok?: boolean }
      if (!response.ok) {
        const code = 'code' in body ? body.code : undefined
        setNotice(
          code === 'PINNED'
            ? copy.pinnedError
            : code === 'MAIL_UNAVAILABLE'
              ? copy.mailUnavailable
              : code === 'MAIL_TEST_FAILED'
                ? copy.testFailed
                : copy.saveFailed
        )
        return
      }
      if ('smtp' in body) apply(body)
      setNotice(name === 'test' ? copy.testSent : copy.saved)
    } catch {
      setNotice(name === 'test' ? copy.testFailed : copy.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  if (!view) {
    return <p className="font-maple text-[12px] text-text-muted">{copy.loading}</p>
  }

  const smtpDisabled = view.smtp.pinned
  const verificationDisabled = view.emailVerificationRequired.pinned

  return (
    <section className="max-w-3xl">
      <p className="font-maple text-[11px] tracking-[0.18em] text-flame uppercase">
        {strings.admin.eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text-primary">
        {copy.mailTitle}
      </h1>
      <p className="mt-3 text-[14px] leading-7 text-text-muted">{copy.mailLead}</p>

      {notice && (
        <div role="status" className="mt-6 rounded-lg border border-border-default bg-surface px-3 py-2.5 text-[12px] text-text-secondary">
          {notice}
        </div>
      )}

      <div className="mt-8 rounded-xl border border-border-default bg-content p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold text-text-primary">SMTP</h2>
          <span className="font-maple text-[10px] text-text-faint">
            {copy.source}: {copy.sources[view.smtp.source]}
          </span>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(['host', 'port', 'username', 'from'] as const).map((field) => (
            <label key={field} className="text-[12px] font-medium text-text-secondary">
              {copy[field]}
              <input
                value={form[field]}
                disabled={smtpDisabled}
                onChange={(event) => setForm({ ...form, [field]: event.target.value })}
                className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface px-3 text-[13px] text-text-primary disabled:opacity-55"
              />
            </label>
          ))}
          <label className="text-[12px] font-medium text-text-secondary">
            {copy.security}
            <select
              value={form.security}
              disabled={smtpDisabled}
              onChange={(event) => setForm({ ...form, security: event.target.value as Form['security'] })}
              className="mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface px-3 text-[13px] text-text-primary disabled:opacity-55"
            >
              <option value="starttls">STARTTLS</option>
              <option value="tls">TLS</option>
              <option value="none">none</option>
            </select>
          </label>
          <label className="text-[12px] font-medium text-text-secondary">
            {copy.password}
            <input
              type="password"
              autoComplete="new-password"
              value={form.password}
              disabled={smtpDisabled}
              placeholder={view.smtp.passwordConfigured ? copy.secretSaved : ''}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface px-3 text-[13px] text-text-primary disabled:opacity-55"
            />
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-border-default bg-content p-5 sm:p-6">
        <div className="flex items-start justify-between gap-5">
          <div>
            <h2 className="text-[15px] font-semibold text-text-primary">{copy.verification}</h2>
            <p className="mt-2 max-w-xl text-[12px] leading-6 text-text-muted">{copy.verificationHelp}</p>
            <p className="mt-2 font-maple text-[10px] text-text-faint">
              {copy.source}: {copy.sources[view.emailVerificationRequired.source]}
            </p>
          </div>
          <input
            type="checkbox"
            checked={form.verification}
            disabled={verificationDisabled}
            aria-label={copy.verification}
            onChange={(event) => setForm({ ...form, verification: event.target.checked })}
            className="mt-1 size-4 accent-flame disabled:opacity-55"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy !== null || (smtpDisabled && verificationDisabled)}
          onClick={() => void action('save', () => fetch('/api/admin/settings/mail', {
            method: 'PUT',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              ...(smtpDisabled ? {} : { smtp: { ...form, port: Number(form.port), password: form.password || undefined, verification: undefined } }),
              ...(verificationDisabled ? {} : { emailVerificationRequired: form.verification })
            })
          }))}
          className="hrack-press hrack-press-primary h-9 rounded-md bg-button-primary px-4 text-[12px] font-medium text-button-primary-fg disabled:opacity-50"
        >
          {busy === 'save' ? copy.saving : copy.save}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void action('test', () => fetch('/api/admin/settings/mail/test', { method: 'POST' }))}
          className="hrack-press hrack-press-chip h-9 rounded-md border border-border-default px-4 text-[12px] text-text-secondary disabled:opacity-50"
        >
          {copy.sendTest}
        </button>
        <button
          type="button"
          disabled={busy !== null || smtpDisabled || verificationDisabled}
          onClick={() => void action('clear', () => fetch('/api/admin/settings/mail', { method: 'DELETE' }))}
          className="hrack-press hrack-press-chip h-9 rounded-md px-4 text-[12px] text-status-error disabled:opacity-50"
        >
          {copy.clear}
        </button>
      </div>
    </section>
  )
}
