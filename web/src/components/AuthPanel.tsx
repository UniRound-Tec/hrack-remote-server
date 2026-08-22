'use client'

import { useLang } from '@/i18n/lang-context'
import {
  statusColor,
  type SessionStatus
} from '@/lib/session-status'
import { AnimatePresence, motion, useInView, useReducedMotion } from 'motion/react'
import { ArrowLeft, Eye, EyeOff } from 'lucide-react'
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Brand } from './Brand'
import { Footer } from './Footer'
import { Nav } from './Nav'
import { Eyebrow } from './Reveal'

const EASE = [0.22, 1, 0.36, 1] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const POINT_LAMPS: SessionStatus[] = ['working', 'needs-you', 'done']

type AuthMode = 'login' | 'register'
type FieldErrors = {
  email?: 'emailRequired' | 'emailInvalid'
  password?: 'passwordRequired' | 'passwordShort'
  confirm?: 'confirmRequired' | 'confirmMismatch'
}

export function AuthPanel() {
  const { strings } = useLang()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<AuthMode>('login')
  const copy = strings.auth[mode]
  const formId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const pointsRef = useRef<HTMLUListElement>(null)
  const pointsInView = useInView(pointsRef, { once: true, margin: '-40px' })
  const lit = pointsInView || Boolean(reduce)

  useEffect(() => {
    document.title = copy.pageTitle
  }, [copy.pageTitle])

  useEffect(() => {
    setErrors({})
    setUnavailable(false)
    setSubmitting(false)
    setConfirm('')
    setShowPassword(false)
  }, [mode])

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: EASE }
  })

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) next.email = 'emailRequired'
    else if (!EMAIL_RE.test(trimmed)) next.email = 'emailInvalid'
    if (!password) next.password = 'passwordRequired'
    else if (password.length < 8) next.password = 'passwordShort'
    if (mode === 'register') {
      if (!confirm) next.confirm = 'confirmRequired'
      else if (confirm !== password) next.confirm = 'confirmMismatch'
    }
    return next
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setSubmitting(true)
    setUnavailable(false)
    await new Promise((resolve) => setTimeout(resolve, 720))
    setSubmitting(false)
    setUnavailable(true)
  }

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:border focus:border-border-default focus:bg-content focus:px-3 focus:py-2 focus:text-[13px] focus:text-text-primary"
      >
        {strings.nav.skipToContent}
      </a>
      <Nav />
      <main
        id="main"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:py-14"
      >
        <div className="overflow-hidden rounded-2xl border border-border-default bg-content shadow-[0_28px_70px_-36px_var(--hrack-shadow-popover)]">
          <div className="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,22rem)]">
            <motion.section
              {...fadeUp(0)}
              className="order-2 flex flex-col border-t border-border-default p-7 sm:p-9 lg:order-1 lg:border-t-0 lg:border-r"
            >
              <div className="flex items-center gap-2.5">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-flame shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-accent-flame)_60%,transparent)]"
                />
                <Eyebrow>{strings.auth.eyebrow}</Eyebrow>
              </div>
              <p className="mt-5">
                <Brand className="text-[40px] sm:text-[48px]" />
              </p>
              <h1 className="mt-5 max-w-md text-[24px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[28px]">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-md text-[14px] leading-relaxed text-text-muted">
                {copy.lead}
              </p>

              <ul ref={pointsRef} className="mt-8 max-w-md space-y-4">
                {strings.auth.points.map((text, index) => {
                  const lamp = POINT_LAMPS[index]
                  const color = statusColor[lamp]
                  return (
                    <li key={strings.auth.pointKeys[index]} className="flex gap-3">
                      <span
                        aria-hidden
                        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${lamp === 'working' && lit ? 'dot-breathe' : ''}`}
                        style={{
                          backgroundColor: lit
                            ? color
                            : 'var(--hrack-status-idle-dot)',
                          boxShadow: lit
                            ? `0 0 12px color-mix(in srgb, ${color} 55%, transparent)`
                            : 'none',
                          transition: 'background-color 700ms, box-shadow 700ms',
                          transitionDelay: lit ? `${index * 120}ms` : '0ms'
                        }}
                      />
                      <div>
                        <p className="font-maple text-[10px] tracking-[0.18em] text-text-faint uppercase">
                          {strings.auth.pointKeys[index]}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-relaxed text-text-secondary">
                          {text}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 pt-10 font-maple text-[11px] tracking-wide">
                <dt className="text-text-faint">{strings.auth.consoleLabel}</dt>
                <dd className="text-text-secondary">{strings.auth.consoleIdle}</dd>
                <dt className="text-text-faint">{strings.auth.sessionsLabel}</dt>
                <dd className="text-text-faint">—</dd>
              </dl>
            </motion.section>

            <motion.section
              {...fadeUp(0.12)}
              className="order-1 flex flex-col bg-app/60 p-7 sm:p-9 lg:order-2"
            >
              <div
                className="grid grid-cols-2 rounded-lg border border-border-default bg-surface-strong p-0.5"
                role="tablist"
                aria-label={`${strings.nav.login} / ${strings.nav.register}`}
              >
                <ModeTab
                  active={mode === 'login'}
                  label={strings.nav.login}
                  onSelect={() => setMode('login')}
                />
                <ModeTab
                  active={mode === 'register'}
                  label={strings.nav.register}
                  onSelect={() => setMode('register')}
                />
              </div>

              <form
                className="mt-7 flex flex-col gap-4"
                onSubmit={onSubmit}
                noValidate
              >
                <AnimatePresence>
                  {unavailable && (
                    <motion.div
                      key="unavailable"
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="flex gap-2.5 rounded-lg border border-border-default bg-content px-3 py-2.5"
                      role="status"
                    >
                      <span
                        aria-hidden
                        className="mt-1 size-2.5 shrink-0 rounded-full bg-status-needs-you-dot shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-status-needsYou)_55%,transparent)]"
                      />
                      <p className="text-[13px] leading-relaxed text-text-secondary">
                        {strings.auth.unavailable}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field
                  id={`${formId}-email`}
                  name="email"
                  label={strings.auth.email}
                  error={
                    errors.email ? strings.auth.errors[errors.email] : undefined
                  }
                >
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    inputMode="email"
                    aria-label={strings.auth.email}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                    }}
                    placeholder={strings.auth.emailPlaceholder}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    className="hrack-field h-11 w-full rounded-lg border border-border-default bg-content px-3 text-[14px] text-text-primary placeholder:text-text-faint"
                  />
                </Field>

                <Field
                  id={`${formId}-password`}
                  name="password"
                  label={strings.auth.password}
                  hint={mode === 'register' ? strings.auth.passwordHint : undefined}
                  error={
                    errors.password
                      ? strings.auth.errors[errors.password]
                      : undefined
                  }
                >
                  <div className="relative">
                    <input
                      id={`${formId}-password`}
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                      aria-label={strings.auth.password}
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value)
                        if (errors.password)
                          setErrors((prev) => ({ ...prev, password: undefined }))
                      }}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={
                        errors.password ? `${formId}-password-error` : undefined
                      }
                      className="hrack-field h-11 w-full rounded-lg border border-border-default bg-content py-0 pr-11 pl-3 text-[14px] text-text-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={
                        showPassword
                          ? strings.auth.hidePassword
                          : strings.auth.showPassword
                      }
                      className="hrack-press-chip absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-md text-text-faint hover:bg-surface-strong hover:text-text-secondary"
                    >
                      {showPassword ? (
                        <EyeOff className="size-4" strokeWidth={1.75} />
                      ) : (
                        <Eye className="size-4" strokeWidth={1.75} />
                      )}
                    </button>
                  </div>
                </Field>

                {mode === 'register' && (
                  <Field
                    id={`${formId}-confirm`}
                    name="confirm"
                    label={strings.auth.confirm}
                    error={
                      errors.confirm
                        ? strings.auth.errors[errors.confirm]
                        : undefined
                    }
                  >
                    <input
                      id={`${formId}-confirm`}
                      name="confirm"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      aria-label={strings.auth.confirm}
                      value={confirm}
                      onChange={(event) => {
                        setConfirm(event.target.value)
                        if (errors.confirm)
                          setErrors((prev) => ({ ...prev, confirm: undefined }))
                      }}
                      aria-invalid={Boolean(errors.confirm)}
                      aria-describedby={
                        errors.confirm ? `${formId}-confirm-error` : undefined
                      }
                      className="hrack-field h-11 w-full rounded-lg border border-border-default bg-content px-3 text-[14px] text-text-primary"
                    />
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="hrack-press hrack-press-primary mt-2 inline-flex h-11 items-center justify-center rounded-full bg-button-primary text-[14px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:pointer-events-none disabled:opacity-60"
                >
                  {submitting ? strings.auth.submitting : copy.submit}
                </button>
              </form>

              <p className="mt-5 text-center text-[13px] text-text-muted">
                {copy.switchHint}{' '}
                <button
                  type="button"
                  onClick={() =>
                    setMode(mode === 'login' ? 'register' : 'login')
                  }
                  className="font-medium text-text-secondary underline-offset-4 transition-colors duration-200 hover:text-text-primary hover:underline"
                >
                  {copy.switch}
                </button>
              </p>

              <div className="mt-8 flex justify-center">
                <a
                  href="/"
                  className="hrack-press inline-flex items-center gap-2 rounded-full border border-border-default bg-content px-4 py-2 text-[12px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={1.75} />
                  {strings.auth.back}
                </a>
              </div>
            </motion.section>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function ModeTab({
  active,
  label,
  onSelect
}: {
  active: boolean
  label: string
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`rounded-md px-3 py-1.5 text-center text-[12px] leading-none font-medium transition-colors duration-200 ${
        active
          ? 'bg-content text-text-primary shadow-[0_1px_2px_rgb(0_0_0/8%)]'
          : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {label}
    </button>
  )
}

function Field({
  id,
  name,
  label,
  hint,
  error,
  children
}: {
  id: string
  name: string
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={id}
          className="font-maple text-[10px] font-medium tracking-[0.18em] text-text-faint uppercase"
        >
          <span className="sr-only">{label}</span>
          <span aria-hidden>{name}</span>
        </label>
        {hint && !error ? (
          <span className="font-maple text-[10px] tracking-wide text-text-faint">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12px] text-status-error">
          {error}
        </p>
      ) : null}
    </div>
  )
}
