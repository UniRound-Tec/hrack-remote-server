'use client'

import { Brand } from '@/components/Brand'
import { useLang } from '@/i18n/lang-context'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { FormEvent, useState } from 'react'

type SetupError = keyof ReturnType<typeof useLang>['strings']['admin']['setup']['errors']

function errorKey(code: string | undefined): SetupError {
  if (code === 'INVALID_SETUP_TOKEN') return 'invalidToken'
  if (code === 'ACCOUNT_EXISTS') return 'accountExists'
  if (code === 'INVALID_EMAIL') return 'invalidEmail'
  if (code === 'INVALID_PASSWORD') return 'invalidPassword'
  if (code === 'NOT_FOUND') return 'unavailable'
  return 'generic'
}

export function SetupForm() {
  const { strings } = useLang()
  const copy = strings.admin.setup
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<SetupError | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!email.trim()) return setError('invalidEmail')
    if (password.length < 8 || password.length > 128) {
      return setError('invalidPassword')
    }
    if (password !== confirm) return setError('passwordMismatch')

    setError(null)
    setSubmitting(true)
    try {
      const response = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, email, password })
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          code?: string
        }
        setError(errorKey(body.code))
        return
      }
      window.location.assign('/admin')
    } catch {
      setError('generic')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12 sm:px-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-baseline gap-3">
          <Brand className="text-[24px]" />
          <span className="font-maple text-[10px] tracking-[0.2em] text-text-faint uppercase">
            {strings.admin.eyebrow}
          </span>
        </div>

        <section className="rounded-2xl border border-border-default bg-content p-6 shadow-[0_24px_70px_-42px_var(--hrack-shadow-popover)] sm:p-8">
          <ShieldCheck className="size-6 text-flame" strokeWidth={1.6} />
          <h1 className="mt-5 text-2xl font-semibold tracking-[-0.03em] text-text-primary">
            {copy.title}
          </h1>
          <p className="mt-3 text-[13px] leading-6 text-text-muted">
            {copy.lead}
          </p>

          {error && (
            <div role="alert" className="mt-5 rounded-lg border border-status-error/20 bg-status-error/5 px-3 py-2.5 text-[12px] text-status-error">
              {copy.errors[error]}
            </div>
          )}

          <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
            <label className="block text-[12px] font-medium text-text-secondary">
              {copy.token}
              <input
                type="password"
                autoComplete="off"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface-strong/60 px-3 font-maple text-[13px] text-text-primary"
                required
              />
            </label>
            <label className="block text-[12px] font-medium text-text-secondary">
              {copy.email}
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface-strong/60 px-3 text-[13px] text-text-primary"
                required
              />
            </label>
            <label className="block text-[12px] font-medium text-text-secondary">
              {copy.password}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface-strong/60 px-3 text-[13px] text-text-primary"
                required
              />
            </label>
            <label className="block text-[12px] font-medium text-text-secondary">
              {copy.confirm}
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className="hrack-field mt-1.5 h-10 w-full rounded-md border border-border-default bg-surface-strong/60 px-3 text-[13px] text-text-primary"
                required
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="hrack-press hrack-press-primary mt-2 inline-flex h-10 w-full items-center justify-center rounded-md bg-button-primary px-4 text-[13px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:opacity-55"
            >
              {submitting ? copy.submitting : copy.submit}
            </button>
          </form>
        </section>

        <Link href="/" className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text-primary">
          <ArrowLeft className="size-3.5" strokeWidth={1.75} />
          {copy.back}
        </Link>
      </div>
    </main>
  )
}
