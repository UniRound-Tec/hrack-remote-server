'use client'

import { useLang } from '@/i18n/lang-context'
import { authClient } from '@/lib/auth-client'
import {
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  ShieldCheck,
  X
} from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent
} from 'react'

type PasswordError =
  | 'currentRequired'
  | 'newRequired'
  | 'newShort'
  | 'newLong'
  | 'newSame'
  | 'confirmRequired'
  | 'confirmMismatch'
  | 'currentInvalid'
  | 'noCredential'
  | 'rateLimited'
  | 'unauthorized'
  | 'failed'

function serverError(code?: string, status?: number): PasswordError {
  if (code === 'INVALID_PASSWORD') return 'currentInvalid'
  if (code === 'CREDENTIAL_ACCOUNT_NOT_FOUND') return 'noCredential'
  if (code === 'PASSWORD_TOO_SHORT') return 'newShort'
  if (code === 'PASSWORD_TOO_LONG') return 'newLong'
  if (status === 401) return 'unauthorized'
  if (status === 429) return 'rateLimited'
  return 'failed'
}

export function ChangePasswordDialog({
  open,
  isMock,
  onOpenChange
}: {
  open: boolean
  isMock: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { strings } = useLang()
  const copy = strings.dashboard.password
  const dialogRef = useRef<HTMLDialogElement>(null)
  const currentInputRef = useRef<HTMLInputElement>(null)
  const formId = useId()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true)
  const [showPasswords, setShowPasswords] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<PasswordError | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      requestAnimationFrame(() => currentInputRef.current?.focus())
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  function clearFeedback(): void {
    setError(null)
    setSuccess(false)
  }

  function close(): void {
    if (pending) return
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setShowPasswords(false)
    clearFeedback()
    onOpenChange(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    clearFeedback()
    if (isMock) return
    if (!currentPassword) return setError('currentRequired')
    if (!newPassword) return setError('newRequired')
    if (newPassword.length < 8) return setError('newShort')
    if (newPassword.length > 128) return setError('newLong')
    if (newPassword === currentPassword) return setError('newSame')
    if (!confirmPassword) return setError('confirmRequired')
    if (confirmPassword !== newPassword) return setError('confirmMismatch')

    setPending(true)
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions
      })
      if (result.error) {
        setError(serverError(result.error.code, result.error.status))
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setSuccess(true)
    } catch {
      setError('failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
      onClose={() => {
        if (open && !pending) close()
      }}
      className="m-auto max-h-[90svh] w-[min(92vw,30rem)] overflow-y-auto rounded-2xl border border-border-default bg-content p-0 text-text-primary shadow-[0_30px_90px_-28px_var(--hrack-shadow-popover)] backdrop:bg-black/45 backdrop:backdrop-blur-sm"
      aria-labelledby={`${formId}-title`}
    >
      <form onSubmit={(event) => void submit(event)} noValidate>
        <div className="flex items-start gap-4 border-b border-border-subtle px-6 py-5 sm:px-7">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-text-secondary">
            <KeyRound className="size-5" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`${formId}-title`} className="text-[19px] font-semibold tracking-tight">
              {copy.title}
            </h2>
            <p className="mt-1.5 text-[13px] leading-5 text-text-muted">
              {copy.lead}
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={close}
            aria-label={copy.close}
            className="hrack-press-chip inline-flex size-8 shrink-0 items-center justify-center rounded-md text-text-faint hover:bg-surface-strong hover:text-text-secondary disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-6 sm:px-7">
          {isMock ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border-strong bg-surface-strong px-4 py-3 text-[12px] leading-5 text-text-muted">
              <ShieldCheck className="mt-0.5 size-4 shrink-0" />
              {copy.mockUnavailable}
            </div>
          ) : null}

          <PasswordField
            id={`${formId}-current`}
            inputRef={currentInputRef}
            label={copy.current}
            value={currentPassword}
            show={showPasswords}
            autoComplete="current-password"
            disabled={pending || isMock}
            onChange={(value) => {
              setCurrentPassword(value)
              clearFeedback()
            }}
          />

          <PasswordField
            id={`${formId}-new`}
            label={copy.new}
            hint={copy.hint}
            value={newPassword}
            show={showPasswords}
            autoComplete="new-password"
            disabled={pending || isMock}
            onChange={(value) => {
              setNewPassword(value)
              clearFeedback()
            }}
          />

          <PasswordField
            id={`${formId}-confirm`}
            label={copy.confirm}
            value={confirmPassword}
            show={showPasswords}
            autoComplete="new-password"
            disabled={pending || isMock}
            onChange={(value) => {
              setConfirmPassword(value)
              clearFeedback()
            }}
          />

          <div className="flex items-center justify-between gap-4">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-text-muted">
              <input
                type="checkbox"
                checked={showPasswords}
                disabled={pending || isMock}
                onChange={(event) => setShowPasswords(event.target.checked)}
                className="size-4 rounded border-border-default accent-black"
              />
              {showPasswords ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showPasswords ? copy.hide : copy.show}
            </label>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border-subtle bg-surface-strong/70 px-4 py-3.5">
            <input
              type="checkbox"
              checked={revokeOtherSessions}
              disabled={pending || isMock}
              onChange={(event) => setRevokeOtherSessions(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-border-default accent-black"
            />
            <span>
              <span className="block text-[13px] font-medium text-text-secondary">
                {copy.revokeOther}
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-text-faint">
                {copy.revokeOtherHint}
              </span>
            </span>
          </label>

          {error ? (
            <p className="rounded-lg bg-[color-mix(in_srgb,var(--hrack-status-error)_7%,white)] px-3.5 py-3 text-[12px] leading-5 text-status-error" role="alert">
              {copy.errors[error]}
            </p>
          ) : null}
          {success ? (
            <p className="flex items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--hrack-status-done)_7%,white)] px-3.5 py-3 text-[12px] leading-5 text-status-done" role="status">
              <Check className="size-4 shrink-0" />
              {copy.success}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border-subtle bg-surface-strong/45 px-6 py-4 sm:px-7">
          <button
            type="button"
            disabled={pending}
            onClick={close}
            className="hrack-press h-9 rounded-md px-4 text-[13px] text-text-muted hover:bg-surface-strong disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="submit"
            disabled={pending || isMock}
            className="hrack-press inline-flex h-9 items-center gap-2 rounded-md bg-button-primary px-4 text-[13px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
            {pending ? copy.saving : copy.save}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function PasswordField({
  id,
  inputRef,
  label,
  hint,
  value,
  show,
  autoComplete,
  disabled,
  onChange
}: {
  id: string
  inputRef?: React.RefObject<HTMLInputElement | null>
  label: string
  hint?: string
  value: string
  show: boolean
  autoComplete: 'current-password' | 'new-password'
  disabled: boolean
  onChange: (value: string) => void
}) {
  return (
    <label htmlFor={id} className="block">
      <span className="flex items-center justify-between gap-3 text-[12px] font-medium text-text-secondary">
        {label}
        {hint ? <span className="font-maple text-[10px] font-normal text-text-faint">{hint}</span> : null}
      </span>
      <input
        ref={inputRef}
        id={id}
        type={show ? 'text' : 'password'}
        autoComplete={autoComplete}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="hrack-field mt-2 h-11 w-full rounded-lg border border-border-default bg-content px-3 text-[14px] text-text-primary disabled:cursor-not-allowed disabled:bg-surface-strong disabled:opacity-65"
      />
    </label>
  )
}
