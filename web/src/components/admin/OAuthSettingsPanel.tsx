'use client'

import { useLang } from '@/i18n/lang-context'
import type { OAuthProviderId, OAuthSettingsView } from '@/lib/settings/admin'
import { useEffect, useState } from 'react'

type Draft = Record<OAuthProviderId, { enabled: boolean; clientId: string; clientSecret: string }>

const PROVIDERS = ['github', 'google', 'linux-do'] as const

export function OAuthSettingsPanel() {
  const { strings } = useLang()
  const copy = strings.admin.settings
  const [view, setView] = useState<OAuthSettingsView | null>(null)
  const [draft, setDraft] = useState<Draft>({
    github: { enabled: false, clientId: '', clientSecret: '' },
    google: { enabled: false, clientId: '', clientSecret: '' },
    'linux-do': { enabled: false, clientId: '', clientSecret: '' }
  })
  const [busy, setBusy] = useState<OAuthProviderId | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function apply(next: OAuthSettingsView) {
    setView(next)
    setDraft({
      github: { enabled: next.github.enabled, clientId: next.github.clientId, clientSecret: '' },
      google: { enabled: next.google.enabled, clientId: next.google.clientId, clientSecret: '' },
      'linux-do': { enabled: next['linux-do'].enabled, clientId: next['linux-do'].clientId, clientSecret: '' }
    })
  }

  useEffect(() => {
    void fetch('/api/admin/settings/oauth')
      .then(async (response) => {
        if (!response.ok) throw new Error()
        apply((await response.json()) as OAuthSettingsView)
      })
      .catch(() => setNotice(copy.loadFailed))
  }, [copy.loadFailed])

  async function mutate(provider: OAuthProviderId, clear = false) {
    setBusy(provider)
    setNotice(null)
    try {
      const response = await fetch('/api/admin/settings/oauth', {
        method: clear ? 'DELETE' : 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          clear
            ? { provider }
            : { provider, ...draft[provider], clientSecret: draft[provider].clientSecret || undefined }
        )
      })
      const body = (await response.json().catch(() => ({}))) as OAuthSettingsView & { code?: string }
      if (!response.ok) {
        setNotice(body.code === 'PINNED' ? copy.pinnedError : copy.saveFailed)
        return
      }
      apply(body)
      setNotice(copy.saved)
    } catch {
      setNotice(copy.saveFailed)
    } finally {
      setBusy(null)
    }
  }

  if (!view) return <p className="font-maple text-[12px] text-text-muted">{copy.loading}</p>

  return (
    <section className="max-w-3xl">
      <p className="font-maple text-[11px] tracking-[0.18em] text-flame uppercase">{strings.admin.eyebrow}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text-primary">{copy.oauthTitle}</h1>
      <p className="mt-3 text-[14px] leading-7 text-text-muted">{copy.oauthLead}</p>
      {notice && <div role="status" className="mt-6 rounded-lg border border-border-default bg-surface px-3 py-2.5 text-[12px] text-text-secondary">{notice}</div>}

      <div className="mt-8 space-y-4">
        {PROVIDERS.map((provider) => {
          const item = view[provider]
          const form = draft[provider]
          return (
            <div key={provider} className="rounded-xl border border-border-default bg-content p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[15px] font-semibold text-text-primary">{copy.providers[provider]}</h2>
                  <p className="mt-1 font-maple text-[10px] text-text-faint">{copy.source}: {copy.sources[item.source]}</p>
                </div>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  disabled={item.pinned}
                  aria-label={`${copy.providers[provider]} ${copy.enabled}`}
                  onChange={(event) => setDraft({ ...draft, [provider]: { ...form, enabled: event.target.checked } })}
                  className="mt-1 size-4 accent-flame disabled:opacity-55"
                />
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-[12px] font-medium text-text-secondary">
                  {copy.clientId}
                  <input value={form.clientId} disabled={item.pinned} onChange={(event) => setDraft({ ...draft, [provider]: { ...form, clientId: event.target.value } })} className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface px-3 text-[13px] text-text-primary disabled:opacity-55" />
                </label>
                <label className="text-[12px] font-medium text-text-secondary">
                  {copy.clientSecret}
                  <input type="password" autoComplete="new-password" value={form.clientSecret} disabled={item.pinned} placeholder={item.clientSecretConfigured ? copy.secretSaved : ''} onChange={(event) => setDraft({ ...draft, [provider]: { ...form, clientSecret: event.target.value } })} className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface px-3 text-[13px] text-text-primary disabled:opacity-55" />
                </label>
              </div>
              <label className="mt-4 block text-[12px] font-medium text-text-secondary">
                {copy.callbackUrl}
                <input readOnly value={item.callbackUrl} className="mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface-strong px-3 font-maple text-[11px] text-text-muted" />
              </label>
              <div className="mt-5 flex gap-2">
                <button type="button" disabled={busy !== null || item.pinned} onClick={() => void mutate(provider)} className="hrack-press hrack-press-primary h-9 rounded-md bg-button-primary px-4 text-[12px] font-medium text-button-primary-fg disabled:opacity-50">{busy === provider ? copy.saving : copy.save}</button>
                <button type="button" disabled={busy !== null || item.pinned} onClick={() => void mutate(provider, true)} className="hrack-press hrack-press-chip h-9 rounded-md px-4 text-[12px] text-status-error disabled:opacity-50">{copy.clear}</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
