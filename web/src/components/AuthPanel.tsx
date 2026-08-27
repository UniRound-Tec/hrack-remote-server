'use client'

import Github from '@lobehub/icons/es/Github/components/Mono'
import Google from '@lobehub/icons/es/Google/components/Color'
import { useLang } from '@/i18n/lang-context'
import { authClient } from '@/lib/auth-client'
import type { AuthMethods } from '@/lib/auth-methods'
import { allowNext } from '@/lib/auth-navigation'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ArrowLeft, Eye, EyeOff, Mail } from 'lucide-react'
import {
  useEffect,
  useId,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode
} from 'react'
import { Brand } from './Brand'
import { Footer } from './Footer'
import { Nav } from './Nav'
import { Eyebrow } from './Reveal'

const EASE = [0.22, 1, 0.36, 1] as const
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const OTP_RE = /^\d{6}$/
const LAST_EMAIL_KEY = 'hrack-auth-email'

export type AuthMode = 'login' | 'register' | 'verify'
export type AuthPageError = 'email_not_verified' | 'email_not_found' | 'oauth'

type FieldErrors = {
  email?: 'emailRequired' | 'emailInvalid'
  password?: 'passwordRequired' | 'passwordShort'
  confirm?: 'confirmRequired' | 'confirmMismatch'
  otp?: 'otpRequired' | 'otpFormat'
}

type Feedback =
  | 'verificationSent'
  | 'invalidCredentials'
  | 'emailNotVerified'
  | 'mailUnavailable'
  | 'otpInvalid'
  | 'otpExpired'
  | 'tooManyAttempts'
  | 'rateLimited'
  | 'banned'
  | 'oauthFailed'
  | 'emailNotFound'
  | 'generic'

type OAuthProvider = 'github' | 'google' | 'linux-do'

type ClientError = {
  status?: number
  code?: string
  message?: string
  body?: { code?: string; message?: string }
}

function errorCode(error: ClientError): string {
  return (error.code ?? error.body?.code ?? '').toUpperCase()
}

function errorFeedback(error: ClientError, otp = false): Feedback {
  const code = errorCode(error)
  if (error.status === 429) return 'rateLimited'
  if (code.includes('MAIL_UNAVAILABLE')) return 'mailUnavailable'
  if (code.includes('TOO_MANY_ATTEMPTS')) return 'tooManyAttempts'
  if (code.includes('EXPIRED')) return 'otpExpired'
  if (code.includes('BANNED') || code.includes('BAN')) return 'banned'
  if (otp || code.includes('OTP')) return 'otpInvalid'
  return 'invalidCredentials'
}

export function AuthPanel({
  initialMethods,
  initialMode = 'login',
  nextPath,
  initialError
}: {
  initialMethods: AuthMethods
  initialMode?: Exclude<AuthMode, 'verify'>
  nextPath?: string
  initialError?: AuthPageError
}) {
  const { strings } = useLang()
  const reduce = useReducedMotion()
  const [mode, setMode] = useState<AuthMode>(
    initialError === 'email_not_verified' ? 'verify' : initialMode
  )
  const [direction, setDirection] = useState<1 | -1>(1)
  const copy = strings.auth[mode]
  const formId = useId()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)
  const [sendingCode, setSendingCode] = useState(false)
  const [mockSubmitting, setMockSubmitting] = useState(false)
  const [oauthSubmitting, setOauthSubmitting] = useState<OAuthProvider | null>(
    null
  )
  const methods = initialMethods
  const [cooldown, setCooldown] = useState(0)
  const [feedback, setFeedback] = useState<Feedback | null>(() => {
    if (initialError === 'email_not_found') return 'emailNotFound'
    if (initialError === 'oauth') return 'oauthFailed'
    if (initialError === 'email_not_verified') return 'emailNotVerified'
    return null
  })

  useEffect(() => {
    document.title = copy.pageTitle
  }, [copy.pageTitle])

  useEffect(() => {
    if (mode !== 'verify' || email) return
    const saved = window.localStorage.getItem(LAST_EMAIL_KEY)
    if (saved) setEmail(saved)
  }, [email, mode])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setInterval(
      () => setCooldown((value) => Math.max(0, value - 1)),
      1000
    )
    return () => window.clearInterval(timer)
  }, [cooldown])

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.55, delay, ease: EASE }
  })

  function selectMode(next: Exclude<AuthMode, 'verify'>): void {
    if (next === mode) return
    setDirection(next === 'register' ? 1 : -1)
    setMode(next)
    setErrors({})
    setFeedback(null)
    setSubmitting(false)
    setConfirm('')
    setOtp('')
    setShowPassword(false)
  }

  function validate(): FieldErrors {
    const next: FieldErrors = {}
    const trimmed = email.trim()
    if (!trimmed) next.email = 'emailRequired'
    else if (!EMAIL_RE.test(trimmed)) next.email = 'emailInvalid'

    if (mode === 'verify') {
      if (!otp) next.otp = 'otpRequired'
      else if (!OTP_RE.test(otp)) next.otp = 'otpFormat'
      return next
    }

    if (!password) next.password = 'passwordRequired'
    else if (password.length < 8) next.password = 'passwordShort'
    if (mode === 'register') {
      if (!confirm) next.confirm = 'confirmRequired'
      else if (confirm !== password) next.confirm = 'confirmMismatch'
    }
    return next
  }

  function finish(): void {
    window.location.assign(allowNext(nextPath) ?? '/dashboard')
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const next = validate()
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setSubmitting(true)
    setFeedback(null)
    const normalized = email.trim().toLowerCase()
    window.localStorage.setItem(LAST_EMAIL_KEY, normalized)

    try {
      if (mode === 'verify') {
        const result = await authClient.emailOtp.verifyEmail({
          email: normalized,
          otp
        })
        if (result.error) {
          setFeedback(errorFeedback(result.error as ClientError, true))
          return
        }
        window.localStorage.removeItem(LAST_EMAIL_KEY)
        finish()
        return
      }

      if (mode === 'register') {
        const result = await authClient.signUp.email({
          email: normalized,
          password,
          name: normalized.split('@')[0] || 'HRack user',
          callbackURL: allowNext(nextPath) ?? '/dashboard'
        })
        if (result.error) {
          setFeedback(errorFeedback(result.error as ClientError))
          return
        }
        if (methods.emailVerificationRequired) {
          setDirection(1)
          setMode('verify')
          setFeedback('verificationSent')
          setCooldown(60)
          return
        }
        window.localStorage.removeItem(LAST_EMAIL_KEY)
        finish()
        return
      }

      const result = await authClient.signIn.email({
        email: normalized,
        password,
        callbackURL: allowNext(nextPath) ?? '/dashboard'
      })
      if (result.error) {
        const clientError = result.error as ClientError
        const code = errorCode(clientError)
        if (
          clientError.status === 403 ||
          code.includes('EMAIL_NOT_VERIFIED')
        ) {
          setDirection(1)
          setMode('verify')
          setFeedback('emailNotVerified')
          setCooldown(60)
          return
        }
        setFeedback(errorFeedback(clientError))
        return
      }
      window.localStorage.removeItem(LAST_EMAIL_KEY)
      finish()
    } catch {
      setFeedback('generic')
    } finally {
      setSubmitting(false)
    }
  }

  async function resend(): Promise<void> {
    if (cooldown > 0 || sendingCode || !EMAIL_RE.test(email.trim())) return
    setFeedback(null)
    setSendingCode(true)
    try {
      const result = await authClient.emailOtp.sendVerificationOtp({
        email: email.trim().toLowerCase(),
        type: 'email-verification'
      })
      if (result.error) {
        const mapped = errorFeedback(result.error as ClientError, true)
        setFeedback(mapped)
        return
      }
      setFeedback('verificationSent')
      setCooldown(60)
    } catch {
      setFeedback('generic')
    } finally {
      setSendingCode(false)
    }
  }

  async function signInWith(provider: OAuthProvider): Promise<void> {
    setOauthSubmitting(provider)
    setFeedback(null)
    try {
      const result = await authClient.signIn.social({
        provider,
        callbackURL: allowNext(nextPath) ?? '/dashboard',
        errorCallbackURL: '/auth'
      })
      if (result.error) setFeedback('oauthFailed')
    } catch {
      setFeedback('oauthFailed')
    } finally {
      setOauthSubmitting(null)
    }
  }

  async function mockSignIn(): Promise<void> {
    if (mockSubmitting) return
    setFeedback(null)
    setMockSubmitting(true)
    try {
      const response = await fetch('/api/dev/mock-login', { method: 'POST' })
      if (!response.ok) throw new Error('mock sign in failed')
      finish()
    } catch {
      setFeedback('generic')
      setMockSubmitting(false)
    }
  }

  function onOtpPaste(event: ClipboardEvent<HTMLInputElement>): void {
    const digits = event.clipboardData.getData('text').match(/\d{6}/)?.[0]
    if (!digits) return
    event.preventDefault()
    setOtp(digits)
    setErrors((previous) => ({ ...previous, otp: undefined }))
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
        className="mx-auto flex w-full max-w-[31rem] flex-1 flex-col justify-center px-5 py-10 sm:px-8 lg:py-14"
      >
        <motion.section
          {...fadeUp(0)}
          className="overflow-hidden rounded-2xl border border-border-default bg-content p-7 shadow-[0_28px_70px_-36px_var(--hrack-shadow-popover)] sm:p-10"
        >
              <header className="text-center">
                <div className="flex items-center justify-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full bg-flame shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-accent-flame)_60%,transparent)]"
                  />
                  <Eyebrow>{strings.auth.eyebrow}</Eyebrow>
                </div>
                <p className="mt-4">
                  <Brand className="text-[42px] sm:text-[48px]" />
                </p>
                <AnimatePresence initial={false} mode="wait" custom={direction}>
                  <motion.div
                    key={mode}
                    custom={direction}
                    initial={
                      reduce
                        ? false
                        : { opacity: 0, x: direction * 12, filter: 'blur(3px)' }
                    }
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={
                      reduce
                        ? { opacity: 0 }
                        : { opacity: 0, x: direction * -10, filter: 'blur(2px)' }
                    }
                    transition={{ duration: 0.26, ease: EASE }}
                  >
                    <h1 className="mt-5 text-[24px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[26px]">
                      {copy.title}
                    </h1>
                    <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-text-muted">
                      {copy.lead}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </header>

              <div className="mt-7 border-t border-border-faint pt-7">
              {mode === 'verify' ? (
                <p className="rounded-lg border border-border-default bg-surface-strong px-3 py-2 text-center font-maple text-[10px] tracking-[0.18em] text-text-faint uppercase">
                  {strings.auth.verifyLabel}
                </p>
              ) : (
                <div
                  className="grid grid-cols-2 rounded-lg border border-border-default bg-surface-strong p-0.5"
                  role="tablist"
                  aria-label={`${strings.nav.login} / ${strings.nav.register}`}
                >
                  <ModeTab
                    active={mode === 'login'}
                    label={strings.nav.login}
                    onSelect={() => selectMode('login')}
                    reduced={Boolean(reduce)}
                  />
                  <ModeTab
                    active={mode === 'register'}
                    label={strings.nav.register}
                    onSelect={() => selectMode('register')}
                    reduced={Boolean(reduce)}
                  />
                </div>
              )}

              <AnimatePresence initial={false} mode="popLayout" custom={direction}>
                <motion.div
                  key={mode}
                  layout
                  custom={direction}
                  initial={
                    reduce
                      ? false
                      : { opacity: 0, x: direction * 22, filter: 'blur(4px)' }
                  }
                  animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                  exit={
                    reduce
                      ? { opacity: 0 }
                      : { opacity: 0, x: direction * -18, filter: 'blur(3px)' }
                  }
                  transition={{ duration: 0.32, ease: EASE }}
                >
              <form className="mt-7 flex flex-col gap-4" onSubmit={onSubmit} noValidate>
                <AnimatePresence>
                  {feedback && (
                    <motion.div
                      key={feedback}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.35, ease: EASE }}
                      className="flex gap-2.5 rounded-lg border border-border-default bg-content px-3 py-2.5"
                      role="alert"
                    >
                      <span
                        aria-hidden
                        className={`mt-1 size-2.5 shrink-0 rounded-full ${
                          feedback === 'verificationSent'
                            ? 'bg-status-done-dot shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-status-done)_55%,transparent)]'
                            : 'bg-status-needs-you-dot shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-status-needsYou)_55%,transparent)]'
                        }`}
                      />
                      <p className="text-[13px] leading-relaxed text-text-secondary">
                        {strings.auth.errors[feedback]}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <Field
                  id={`${formId}-email`}
                  label={strings.auth.email}
                  error={errors.email ? strings.auth.errors[errors.email] : undefined}
                >
                  <input
                    id={`${formId}-email`}
                    name="email"
                    type="email"
                    autoComplete="email"
                    autoFocus={mode !== 'verify'}
                    inputMode="email"
                    readOnly={mode === 'verify'}
                    aria-label={strings.auth.email}
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value)
                      if (errors.email) {
                        setErrors((previous) => ({ ...previous, email: undefined }))
                      }
                    }}
                    placeholder={strings.auth.emailPlaceholder}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? `${formId}-email-error` : undefined}
                    className="hrack-field h-11 w-full rounded-lg border border-border-default bg-content px-3 text-[14px] text-text-primary placeholder:text-text-faint read-only:bg-surface-strong read-only:text-text-muted"
                  />
                </Field>

                {mode !== 'verify' && (
                  <Field
                    id={`${formId}-password`}
                    label={strings.auth.password}
                    hint={mode === 'register' ? strings.auth.passwordHint : undefined}
                    error={
                      errors.password ? strings.auth.errors[errors.password] : undefined
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
                          if (errors.password) {
                            setErrors((previous) => ({
                              ...previous,
                              password: undefined
                            }))
                          }
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
                )}

                {mode === 'register' && (
                  <Field
                    id={`${formId}-confirm`}
                    label={strings.auth.confirm}
                    error={
                      errors.confirm ? strings.auth.errors[errors.confirm] : undefined
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
                        if (errors.confirm) {
                          setErrors((previous) => ({
                            ...previous,
                            confirm: undefined
                          }))
                        }
                      }}
                      aria-invalid={Boolean(errors.confirm)}
                      aria-describedby={
                        errors.confirm ? `${formId}-confirm-error` : undefined
                      }
                      className="hrack-field h-11 w-full rounded-lg border border-border-default bg-content px-3 text-[14px] text-text-primary"
                    />
                  </Field>
                )}

                {mode === 'verify' && (
                  <Field
                    id={`${formId}-otp`}
                    label={strings.auth.otp}
                    hint={strings.auth.latestOtp}
                    error={errors.otp ? strings.auth.errors[errors.otp] : undefined}
                  >
                    <input
                      id={`${formId}-otp`}
                      name="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      autoFocus
                      aria-label={strings.auth.otp}
                      value={otp}
                      onPaste={onOtpPaste}
                      onChange={(event) => {
                        setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                        if (errors.otp) {
                          setErrors((previous) => ({ ...previous, otp: undefined }))
                        }
                      }}
                      placeholder={strings.auth.otpPlaceholder}
                      aria-invalid={Boolean(errors.otp)}
                      aria-describedby={errors.otp ? `${formId}-otp-error` : undefined}
                      className="hrack-field h-12 w-full rounded-lg border border-border-default bg-content px-3 text-center font-maple text-[22px] tracking-[0.35em] text-text-primary placeholder:text-text-faint"
                    />
                  </Field>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="hrack-press hrack-press-primary mt-2 inline-flex h-11 items-center justify-center rounded-full bg-button-primary text-[14px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:pointer-events-none disabled:opacity-60"
                >
                  {submitting
                    ? mode === 'register' &&
                      methods.emailVerificationRequired
                      ? strings.auth.sendingCode
                      : strings.auth.submitting
                    : mode === 'register' &&
                        !methods.emailVerificationRequired
                      ? strings.auth.createAccount
                      : copy.submit}
                </button>

                {process.env.NODE_ENV === 'development' && mode !== 'verify' ? (
                  <button
                    type="button"
                    disabled={mockSubmitting || submitting}
                    onClick={() => void mockSignIn()}
                    className="hrack-press inline-flex h-11 items-center justify-center rounded-full border border-dashed border-border-strong bg-content px-4 text-[13px] font-medium text-text-secondary hover:bg-surface-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-60"
                  >
                    {mockSubmitting
                      ? strings.auth.mockLoading
                      : strings.auth.mockLogin}
                  </button>
                ) : null}

                {mode === 'verify' && (
                  <button
                    type="button"
                    disabled={cooldown > 0 || sendingCode}
                    onClick={() => void resend()}
                    className="hrack-press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-default bg-content px-4 text-[13px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:text-text-faint"
                  >
                    <Mail className="size-4" strokeWidth={1.75} aria-hidden />
                    {sendingCode
                      ? strings.auth.sendingCode
                      : cooldown > 0
                      ? strings.auth.resendIn(cooldown)
                      : strings.auth.resend}
                  </button>
                )}
              </form>

              {mode !== 'verify' &&
              (methods.github || methods.google || methods['linux-do']) ? (
                <div className="mt-6">
                  <div className="flex items-center gap-3" aria-hidden>
                    <span className="h-px flex-1 bg-border-default" />
                    <span className="font-maple text-[10px] tracking-[0.18em] text-text-faint uppercase">
                      {strings.auth.socialDivider}
                    </span>
                    <span className="h-px flex-1 bg-border-default" />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {methods.github ? (
                      <OAuthButton
                        disabled={oauthSubmitting !== null}
                        icon={<Github className="size-4" />}
                        label={strings.auth.social.github}
                        onClick={() => void signInWith('github')}
                      />
                    ) : null}
                    {methods.google ? (
                      <OAuthButton
                        disabled={oauthSubmitting !== null}
                        icon={<Google className="size-4" />}
                        label={strings.auth.social.google}
                        onClick={() => void signInWith('google')}
                      />
                    ) : null}
                    {methods['linux-do'] ? (
                      <OAuthButton
                        disabled={oauthSubmitting !== null}
                        icon={<LinuxDoIcon className="size-4" />}
                        label={strings.auth.social['linux-do']}
                        onClick={() => void signInWith('linux-do')}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              <p className="mt-5 text-center text-[13px] text-text-muted">
                {copy.switchHint}{' '}
                <button
                  type="button"
                  onClick={() =>
                    selectMode(mode === 'login' ? 'register' : 'login')
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
                </motion.div>
              </AnimatePresence>
              </div>
        </motion.section>
      </main>
      <Footer />
    </div>
  )
}

function LinuxDoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 120 120"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id="linux-do-icon-clip">
          <circle cx="60" cy="60" r="47" />
        </clipPath>
      </defs>
      <circle cx="60" cy="60" fill="#f0f0f0" r="50" />
      <rect
        clipPath="url(#linux-do-icon-clip)"
        fill="#1c1c1e"
        height="30"
        width="100"
        x="10"
        y="10"
      />
      <rect
        clipPath="url(#linux-do-icon-clip)"
        fill="#f0f0f0"
        height="40"
        width="100"
        x="10"
        y="40"
      />
      <rect
        clipPath="url(#linux-do-icon-clip)"
        fill="#ffb003"
        height="30"
        width="100"
        x="10"
        y="80"
      />
    </svg>
  )
}

function OAuthButton({
  disabled,
  icon,
  label,
  onClick
}: {
  disabled: boolean
  icon: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="hrack-press inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border-default bg-content px-4 text-[13px] font-medium text-text-secondary hover:border-border-strong hover:text-text-primary disabled:pointer-events-none disabled:opacity-60"
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function ModeTab({
  active,
  label,
  onSelect,
  reduced
}: {
  active: boolean
  label: string
  onSelect: () => void
  reduced: boolean
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onSelect}
      className={`relative isolate overflow-hidden rounded-md px-3 py-1.5 text-center text-[12px] leading-none font-medium transition-colors duration-200 ${
        active
          ? 'text-text-primary'
          : 'text-text-muted hover:text-text-secondary'
      }`}
    >
      {active ? (
        <motion.span
          layoutId="auth-mode-indicator"
          className="absolute inset-0 z-0 rounded-md bg-content shadow-[0_1px_2px_rgb(0_0_0/8%)]"
          transition={reduced ? { duration: 0 } : { duration: 0.32, ease: EASE }}
        />
      ) : null}
      <span className="relative z-10">{label}</span>
    </button>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children
}: {
  id: string
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
          className="text-[12px] font-medium text-text-secondary"
        >
          {label}
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
