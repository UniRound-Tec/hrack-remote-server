'use client'

import { Brand } from '@/components/Brand'
import { LanguageMenu } from '@/components/LanguageMenu'
import { ChangePasswordDialog } from '@/components/dashboard/ChangePasswordDialog'
import {
  createPairingAction,
  refreshPairingAction,
  revokePairingAction,
  rotatePairingAction,
  switchPairingNodeAction
} from '@/app/dashboard/actions'
import { authClient } from '@/lib/auth-client'
import type {
  PairingActionError,
  PairingActionResult
} from '@/lib/pairing/action-service'
import type { PairingView } from '@/lib/pairing/lifecycle'
import type { PublicRelayNode } from '@/lib/pairing/nodes'
import { pairingQrDataUrl } from '@/lib/pairing/qr'
import { type Locale } from '@/i18n'
import { useLang } from '@/i18n/lang-context'
import {
  ArrowUpRight,
  Check,
  Copy,
  Gauge,
  KeyRound,
  Link2,
  LoaderCircle,
  LogOut,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  X
} from 'lucide-react'
import Link from 'next/link'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

type PendingOperation = 'create' | 'rotate' | 'switch' | 'revoke' | null
type Confirmation = 'rotate' | 'switch' | 'revoke' | null

function mockPairing(
  node: PublicRelayNode = {
    id: 'us-1',
    region: 'us',
    label: 'United States',
    healthUrl: 'https://remote.hrack.invalid/remote/healthz'
  }
): Extract<PairingView, { kind: 'ready' | 'recovering' }> {
  const version = crypto.randomUUID()
  return {
    kind: 'ready',
    version,
    joinUrl: `https://remote.hrack.invalid/mock/${version}`,
    createdAt: Date.now(),
    nodeId: node.id,
    region: node.region,
    nodeLabel: node.label
  }
}

function mockPairingAction(
  operation: Exclude<PendingOperation, null>,
  node?: PublicRelayNode
): Promise<PairingActionResult> {
  return Promise.resolve({
    ok: true,
    pairing: operation === 'revoke' ? { kind: 'empty' } : mockPairing(node)
  })
}

export function PairingDashboard({
  initialPairing,
  relayNodes,
  email,
  isAdmin,
  isMock
}: {
  initialPairing: PairingView
  relayNodes: PublicRelayNode[]
  email: string
  isAdmin: boolean
  isMock: boolean
}) {
  const { strings, lang } = useLang()
  const copyInput = useRef<HTMLInputElement>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const [pairing, setPairing] = useState(initialPairing)
  const [pending, setPending] = useState<PendingOperation>(null)
  const [confirmation, setConfirmation] = useState<Confirmation>(null)
  const [error, setError] = useState<PairingActionError | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFailed, setCopyFailed] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState(
    relayNodes[0]?.id ?? 'us-1'
  )
  const [switchTargetNodeId, setSwitchTargetNodeId] = useState<string | null>(
    null
  )
  const active = pairing.kind === 'ready' || pairing.kind === 'recovering'
  const qrSource = useMemo(
    () => (active ? pairingQrDataUrl(pairing.joinUrl) : null),
    [active, pairing]
  )

  useEffect(() => {
    const dialog = confirmDialog.current
    if (!dialog) return
    if (confirmation && !dialog.open) dialog.showModal()
    if (!confirmation && dialog.open) dialog.close()
  }, [confirmation])

  useEffect(() => {
    if (isMock || !active || pending) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let stopped = false
    const delay = pairing.kind === 'recovering' ? 2_000 : 5_000

    async function refresh(): Promise<void> {
      if (stopped) return
      if (!document.hidden) {
        const result = await refreshPairingAction().catch(
          (): PairingActionResult => ({ ok: false, error: 'INTERNAL_ERROR' })
        )
        if (stopped) return
        if (result.ok) setPairing(result.pairing)
        else if (result.error === 'UNAUTHORIZED') window.location.assign('/auth')
      }
      timer = setTimeout(refresh, delay)
    }

    timer = setTimeout(refresh, delay)
    const onVisibility = (): void => {
      if (!document.hidden) {
        if (timer) clearTimeout(timer)
        void refresh()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, isMock, pairing.kind, pending])

  async function apply(
    operation: Exclude<PendingOperation, null>,
    request: () => Promise<PairingActionResult>
  ): Promise<void> {
    setPending(operation)
    setError(null)
    setCopyFailed(false)
    try {
      const result = await request()
      if (result.ok) {
        setPairing(result.pairing)
        setConfirmation(null)
      } else if (result.error === 'UNAUTHORIZED') {
        window.location.assign('/auth')
      } else {
        setError(result.error)
      }
    } catch {
      setError('INTERNAL_ERROR')
    } finally {
      setPending(null)
    }
  }

  async function copyUrl(): Promise<void> {
    if (!active) return
    setCopied(false)
    setCopyFailed(false)
    try {
      await navigator.clipboard.writeText(pairing.joinUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1_800)
    } catch {
      copyInput.current?.focus()
      copyInput.current?.select()
      setCopyFailed(true)
    }
  }

  async function signOut(): Promise<void> {
    await authClient.signOut().catch(() => undefined)
    window.location.assign('/auth')
  }

  const destructiveDisabled = pending !== null || pairing.kind === 'recovering'

  return (
    <div className="min-h-screen bg-transparent">
      <header className="nav-on-dark sticky top-0 z-40 border-b border-white/10 bg-black/80 shadow-[0_10px_35px_-28px_rgb(0_0_0/90%)] backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center gap-4 px-5 sm:px-8">
          <Link href="/dashboard" className="flex items-baseline gap-3">
            <Brand className="text-[22px]" />
            <span className="font-maple text-[10px] tracking-[0.2em] text-text-faint uppercase">
              {strings.dashboard.eyebrow}
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-52 truncate font-maple text-[11px] text-text-muted md:block">
              {email}
            </span>
            <LanguageMenu compact />
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="hrack-press hrack-press-chip inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-text-muted hover:bg-surface-strong hover:text-text-secondary"
              aria-label={strings.dashboard.password.trigger}
            >
              <KeyRound className="size-3.5" strokeWidth={1.75} />
              <span className="hidden lg:inline">{strings.dashboard.password.trigger}</span>
            </button>
            {isAdmin ? (
              <Link
                href="/admin"
                className="hrack-press hrack-press-chip hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-text-muted hover:bg-surface-strong sm:inline-flex"
              >
                {strings.dashboard.admin}
                <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => void signOut()}
              className="hrack-press hrack-press-chip inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-strong"
              aria-label={strings.dashboard.signOut}
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="max-w-2xl">
          <p className="font-maple text-[10px] tracking-[0.2em] text-white/45 uppercase">
            pairing · account-owned
          </p>
          <h1 className="mt-3 text-[30px] font-semibold tracking-tight text-white sm:text-[36px]">
            {strings.dashboard.title}
          </h1>
          <p className="mt-3 max-w-xl text-[14px] leading-7 text-white/65">
            {strings.dashboard.lead}
          </p>
        </div>

        <section
          className="mt-9 overflow-hidden rounded-2xl border border-white/20 bg-content/95 shadow-[0_28px_70px_-32px_rgb(0_0_0/65%)] backdrop-blur-xl"
          aria-live="polite"
        >
          {pairing.kind === 'empty' ? (
            <EmptyPairing
              pending={pending === 'create'}
              relayNodes={relayNodes}
              selectedNodeId={selectedNodeId}
              onNodeChange={setSelectedNodeId}
              onCreate={() =>
                void apply(
                  'create',
                  isMock
                    ? () =>
                        mockPairingAction(
                          'create',
                          relayNodes.find((node) => node.id === selectedNodeId)
                        )
                    : () => createPairingAction({ nodeId: selectedNodeId })
                )
              }
            />
          ) : pairing.kind === 'stale' ? (
            <StalePairing
              pending={pending === 'rotate'}
              onRotate={() => setConfirmation('rotate')}
            />
          ) : (
            <ActivePairing
              pairing={pairing}
              qrSource={qrSource ?? ''}
              copyInput={copyInput}
              copied={copied}
              destructiveDisabled={destructiveDisabled}
              pending={pending}
              lang={lang}
              isMock={isMock}
              relayNodes={relayNodes}
              onCopy={() => void copyUrl()}
              onRotate={() => setConfirmation('rotate')}
              onSwitch={(nodeId) => {
                setSwitchTargetNodeId(nodeId)
                setConfirmation('switch')
              }}
              onRevoke={() => setConfirmation('revoke')}
            />
          )}

          {error || copyFailed ? (
            <div className="border-t border-border-subtle bg-[color-mix(in_srgb,var(--hrack-status-error)_7%,white)] px-6 py-4 text-[13px] text-status-error sm:px-8">
              <p className="flex items-start gap-2" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {copyFailed
                  ? strings.dashboard.active.copyFailed
                  : error
                    ? strings.dashboard.errors[error]
                    : null}
              </p>
            </div>
          ) : null}
        </section>

        <p className="mt-5 flex items-center gap-2 text-[12px] text-white/45">
          <ShieldCheck className="size-4" strokeWidth={1.6} />
          {strings.dashboard.account}: <span className="truncate">{email}</span>
        </p>
      </main>

      <ChangePasswordDialog
        open={passwordOpen}
        isMock={isMock}
        onOpenChange={setPasswordOpen}
      />

      <dialog
        ref={confirmDialog}
        onCancel={(event) => {
          event.preventDefault()
          if (!pending) setConfirmation(null)
        }}
        onClose={() => {
          if (!pending) setConfirmation(null)
        }}
        className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-border-default bg-content p-0 text-text-primary shadow-[0_30px_90px_-28px_var(--hrack-shadow-popover)] backdrop:bg-black/25"
      >
        {confirmation ? (
          <div className="p-6 sm:p-7">
            <div className="flex items-start gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-strong text-text-secondary">
                {confirmation === 'revoke' ? (
                  <Trash2 className="size-5" />
                ) : (
                  <RotateCcw className="size-5" />
                )}
              </span>
              <div>
                <h2 className="text-[18px] font-semibold tracking-tight">
                  {confirmation === 'rotate'
                    ? strings.dashboard.confirm.rotateTitle
                    : confirmation === 'switch'
                      ? strings.dashboard.confirm.switchTitle
                      : strings.dashboard.confirm.revokeTitle}
                </h2>
                <p className="mt-2 text-[13px] leading-6 text-text-muted">
                  {confirmation === 'rotate'
                    ? strings.dashboard.confirm.rotateBody
                    : confirmation === 'switch'
                        ? strings.dashboard.confirm.switchBody.replace(
                          '{region}',
                          relayNodes.find(
                            (node) => node.id === switchTargetNodeId
                          )?.label ?? ''
                        )
                      : strings.dashboard.confirm.revokeBody}
                </p>
              </div>
            </div>
            <div className="mt-7 flex justify-end gap-2">
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => setConfirmation(null)}
                className="hrack-press h-9 rounded-md px-4 text-[13px] text-text-muted hover:bg-surface-strong disabled:opacity-50"
              >
                {strings.dashboard.confirm.cancel}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                onClick={() => {
                  if (pairing.kind === 'empty') return
                  if (confirmation === 'switch' && !switchTargetNodeId) return
                  const input = { version: pairing.version }
                  void apply(
                    confirmation,
                    isMock
                      ? () =>
                          mockPairingAction(
                            confirmation,
                            confirmation === 'switch'
                              ? relayNodes.find(
                                  (node) => node.id === switchTargetNodeId
                                )
                              : pairing.kind === 'ready' ||
                                  pairing.kind === 'recovering'
                                ? relayNodes.find(
                                    (node) => node.id === pairing.nodeId
                                  )
                                : undefined
                          )
                      : confirmation === 'rotate'
                        ? () => rotatePairingAction(input)
                        : confirmation === 'switch'
                          ? () => switchPairingNodeAction({
                              ...input,
                              nodeId: switchTargetNodeId
                            })
                          : () => revokePairingAction(input)
                  )
                }}
                className="hrack-press inline-flex h-9 items-center gap-2 rounded-md bg-button-primary px-4 text-[13px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:opacity-50"
              >
                {pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : null}
                {confirmation === 'rotate'
                  ? pending === 'rotate'
                    ? strings.dashboard.active.rotating
                    : strings.dashboard.confirm.rotate
                  : confirmation === 'switch'
                    ? pending === 'switch'
                      ? strings.dashboard.active.switching
                      : strings.dashboard.confirm.switch
                  : pending === 'revoke'
                    ? strings.dashboard.active.revoking
                    : strings.dashboard.confirm.revoke}
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </div>
  )
}

function EmptyPairing({
  pending,
  relayNodes,
  selectedNodeId,
  onNodeChange,
  onCreate
}: {
  pending: boolean
  relayNodes: PublicRelayNode[]
  selectedNodeId: string
  onNodeChange: (nodeId: string) => void
  onCreate: () => void
}) {
  const { strings } = useLang()
  return (
    <div className="grid min-h-80 place-items-center px-6 py-14 text-center sm:px-10">
      <div className="w-full max-w-2xl">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full border border-border-default bg-surface-strong text-text-muted">
          <Link2 className="size-5" strokeWidth={1.6} />
        </span>
        <h2 className="mt-5 text-[21px] font-semibold tracking-tight">
          {strings.dashboard.empty.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-text-muted">
          {strings.dashboard.empty.lead}
        </p>
        <div className="mx-auto mt-7 w-full max-w-[40rem] text-left">
          <p className="font-maple text-[10px] tracking-[0.14em] text-text-faint uppercase">
            {strings.dashboard.region.label}
          </p>
          <RegionCards
            nodes={relayNodes}
            selectedNodeId={selectedNodeId}
            selectedLabel={strings.dashboard.region.selected}
            disabled={pending}
            onSelect={onNodeChange}
          />
        </div>
        <button
          type="button"
          disabled={pending || relayNodes.length === 0}
          onClick={onCreate}
          className="hrack-press mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-button-primary px-6 text-[13px] font-medium text-button-primary-fg shadow-[0_12px_25px_-15px_var(--hrack-shadow-popover)] hover:bg-button-primary-hover disabled:opacity-55"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}
          {pending
            ? strings.dashboard.empty.creating
            : strings.dashboard.empty.create}
        </button>
      </div>
    </div>
  )
}

function StalePairing({
  pending,
  onRotate
}: {
  pending: boolean
  onRotate: () => void
}) {
  const { strings } = useLang()
  return (
    <div className="grid min-h-80 place-items-center px-6 py-14 text-center sm:px-10">
      <div className="max-w-lg">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--hrack-status-error)_10%,white)] text-status-error">
          <TriangleAlert className="size-5" strokeWidth={1.7} />
        </span>
        <StatusPill kind="stale" />
        <h2 className="mt-5 text-[21px] font-semibold tracking-tight">
          {strings.dashboard.stale.title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-text-muted">
          {strings.dashboard.stale.lead}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={onRotate}
          className="hrack-press mt-7 inline-flex h-10 items-center gap-2 rounded-md bg-button-primary px-5 text-[13px] font-medium text-button-primary-fg hover:bg-button-primary-hover disabled:opacity-55"
        >
          {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
          {strings.dashboard.stale.rotate}
        </button>
      </div>
    </div>
  )
}

function ActivePairing({
  pairing,
  qrSource,
  copyInput,
  copied,
  destructiveDisabled,
  pending,
  lang,
  isMock,
  relayNodes,
  onCopy,
  onRotate,
  onSwitch,
  onRevoke
}: {
  pairing: Extract<PairingView, { kind: 'ready' | 'recovering' }>
  qrSource: string
  copyInput: React.RefObject<HTMLInputElement | null>
  copied: boolean
  destructiveDisabled: boolean
  pending: PendingOperation
  lang: Locale
  isMock: boolean
  relayNodes: PublicRelayNode[]
  onCopy: () => void
  onRotate: () => void
  onSwitch: (nodeId: string) => void
  onRevoke: () => void
}) {
  const { strings } = useLang()
  return (
    <div className="grid gap-0 lg:grid-cols-[1fr_18rem]">
      <div className="p-6 sm:p-8 lg:p-10">
        <StatusPill kind={pairing.kind} />
        <h2 className="mt-5 text-[22px] font-semibold tracking-tight">
          {strings.dashboard.active.title}
        </h2>
        <p className="mt-2 text-[13px] leading-6 text-text-muted">
          {strings.dashboard.active.lead}
        </p>

        {isMock ? (
          <div className="mt-5 rounded-lg border border-dashed border-[color-mix(in_srgb,var(--hrack-status-needsYou)_30%,transparent)] bg-[color-mix(in_srgb,var(--hrack-status-needsYou)_7%,white)] px-4 py-3 text-[12px] leading-5 text-status-needs-you">
            {strings.dashboard.mockNotice}
          </div>
        ) : null}

        {pairing.kind === 'recovering' ? (
          <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-[color-mix(in_srgb,var(--hrack-status-working)_18%,transparent)] bg-[color-mix(in_srgb,var(--hrack-status-working)_6%,white)] px-4 py-3 text-[12px] leading-5 text-status-working">
            <RefreshCw className="mt-0.5 size-3.5 shrink-0 animate-spin [animation-duration:2.4s]" />
            {strings.dashboard.active.recovering}
          </div>
        ) : null}

        <label className="mt-7 block font-maple text-[10px] tracking-[0.16em] text-text-faint uppercase">
          {strings.dashboard.active.urlLabel}
        </label>
        <div className="mt-2 flex gap-2">
          <input
            ref={copyInput}
            readOnly
            value={pairing.joinUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-border-default bg-surface-strong px-3 font-maple text-[12px] text-text-secondary outline-none focus:border-border-strong focus:ring-2 focus:ring-focus-ring/30"
            aria-label={strings.dashboard.active.urlLabel}
          />
          <button
            type="button"
            onClick={onCopy}
            className="hrack-press inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-border-default bg-content px-3 text-[12px] font-medium text-text-secondary hover:bg-surface-strong"
          >
            {copied ? <Check className="size-4 text-status-done" /> : <Copy className="size-4" />}
            <span className="hidden sm:inline">
              {copied
                ? strings.dashboard.active.copied
                : strings.dashboard.active.copy}
            </span>
          </button>
        </div>

        <p className="mt-3 font-maple text-[11px] text-text-faint">
          Relay · {pairing.nodeLabel}
        </p>
        <p className="mt-1 font-maple text-[11px] text-text-faint">
          {strings.dashboard.active.createdAt}{' '}
          <time
            dateTime={new Date(pairing.createdAt).toISOString()}
            suppressHydrationWarning
          >
            {new Intl.DateTimeFormat(lang, {
              dateStyle: 'medium',
              timeStyle: 'short'
            }).format(pairing.createdAt)}
          </time>
        </p>

        {relayNodes.length > 1 ? (
          <div className="mt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-maple text-[10px] tracking-[0.14em] text-text-faint uppercase">
                  {strings.dashboard.region.switchLabel}
                </p>
                <p className="mt-1 text-[11px] text-text-muted">
                  {strings.dashboard.region.switchHint}
                </p>
              </div>
            </div>
            <RegionCards
              nodes={relayNodes}
              selectedNodeId={pairing.nodeId}
              selectedLabel={strings.dashboard.region.current}
              disabled={destructiveDisabled}
              onSelect={(nodeId) => {
                if (nodeId !== pairing.nodeId) onSwitch(nodeId)
              }}
            />
          </div>
        ) : null}

        <div className="mt-8 flex flex-wrap gap-2 border-t border-border-subtle pt-6">
          <button
            type="button"
            disabled={destructiveDisabled}
            onClick={onRotate}
            className="hrack-press inline-flex h-9 items-center gap-2 rounded-md border border-border-default px-3.5 text-[12px] font-medium text-text-secondary hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending === 'rotate' ? <LoaderCircle className="size-4 animate-spin" /> : <RotateCcw className="size-4" />}
            {strings.dashboard.active.rotate}
          </button>
          <button
            type="button"
            disabled={destructiveDisabled}
            onClick={onRevoke}
            className="hrack-press inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-[12px] font-medium text-status-error hover:bg-[color-mix(in_srgb,var(--hrack-status-error)_7%,white)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending === 'revoke' ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {strings.dashboard.active.revoke}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-center border-t border-border-subtle bg-surface-strong/60 p-7 lg:border-t-0 lg:border-l">
        <div className="text-center">
          <div className="rounded-2xl border border-border-default bg-white p-3 shadow-sm">
            {/* The SVG remains an image source; no generated markup enters the DOM. */}
            <img
              src={qrSource}
              alt={strings.dashboard.qrAlt}
              width={216}
              height={216}
              className="size-[min(58vw,13.5rem)]"
            />
          </div>
          <p className="mt-3 flex items-center justify-center gap-1.5 font-maple text-[10px] text-text-faint">
            <Smartphone className="size-3.5" /> scan · open · pair
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ kind }: { kind: 'ready' | 'recovering' | 'stale' }) {
  const { strings } = useLang()
  const presentation: Record<
    typeof kind,
    { label: string; icon: ReactNode; className: string }
  > = {
    ready: {
      label: strings.dashboard.status.ready,
      icon: <span className="size-1.5 rounded-full bg-status-done-dot" />,
      className: 'text-status-done'
    },
    recovering: {
      label: strings.dashboard.status.recovering,
      icon: <RefreshCw className="size-3 animate-spin [animation-duration:2.4s]" />,
      className: 'text-status-working'
    },
    stale: {
      label: strings.dashboard.status.stale,
      icon: <X className="size-3" />,
      className: 'text-status-error'
    }
  }
  const item = presentation[kind]
  return (
    <span
      className={`inline-flex h-6 items-center gap-2 rounded-full border border-border-subtle bg-surface-strong px-2.5 font-maple text-[10px] ${item.className}`}
    >
      {item.icon}
      {item.label}
    </span>
  )
}

type LatencyResult =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ready'; milliseconds: number }
  | { kind: 'failed' }

function RegionCards({
  nodes,
  selectedNodeId,
  selectedLabel,
  disabled,
  onSelect
}: {
  nodes: PublicRelayNode[]
  selectedNodeId: string
  selectedLabel: string
  disabled: boolean
  onSelect: (nodeId: string) => void
}) {
  const { strings } = useLang()
  const [latency, setLatency] = useState<Record<string, LatencyResult>>({})

  async function measure(node: PublicRelayNode): Promise<void> {
    setLatency((current) => ({ ...current, [node.id]: { kind: 'testing' } }))
    const startedAt = performance.now()
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 6_000)
    try {
      const url = new URL(node.healthUrl)
      url.searchParams.set('_latency', crypto.randomUUID())
      const sameOrigin = url.origin === window.location.origin
      const response = await fetch(url, {
        cache: 'no-store',
        mode: sameOrigin ? 'same-origin' : 'no-cors',
        signal: controller.signal
      })
      if (sameOrigin && !response.ok) throw new Error('Relay health failed')
      const milliseconds = Math.max(1, Math.round(performance.now() - startedAt))
      setLatency((current) => ({
        ...current,
        [node.id]: { kind: 'ready', milliseconds }
      }))
    } catch {
      setLatency((current) => ({ ...current, [node.id]: { kind: 'failed' } }))
    } finally {
      window.clearTimeout(timeout)
    }
  }

  return (
    <div className="mt-2.5 grid w-full gap-3 sm:grid-cols-2">
      {nodes.map((node) => {
        const selected = node.id === selectedNodeId
        const result = latency[node.id] ?? { kind: 'idle' as const }
        return (
          <div
            key={node.id}
            className={`group relative min-w-0 overflow-hidden rounded-2xl border bg-[linear-gradient(145deg,var(--hrack-bg-content)_0%,color-mix(in_srgb,var(--hrack-bg-surface-strong)_38%,var(--hrack-bg-content))_100%)] text-left transition-[border-color,box-shadow,transform] duration-200 ${
              selected
                ? 'border-border-strong shadow-[0_16px_38px_-25px_var(--hrack-shadow-popover)] ring-1 ring-black/5'
                : 'border-border-default shadow-[0_12px_32px_-27px_var(--hrack-shadow-popover)] hover:-translate-y-px hover:border-border-strong hover:shadow-[0_18px_38px_-24px_var(--hrack-shadow-popover)]'
            }`}
          >
            {selected ? (
              <span className="pointer-events-none absolute top-3.5 right-3.5 z-10 inline-flex h-6 min-w-[3.75rem] items-center justify-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--hrack-status-done)_10%,white)] px-2 font-maple text-[9px] text-status-done">
                <Check className="size-3" strokeWidth={2.2} />
                {selectedLabel}
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled || selected}
              onClick={() => onSelect(node.id)}
              className="hrack-press block min-h-[5.75rem] w-full px-4 py-4 text-left disabled:cursor-default"
              aria-pressed={selected}
            >
              <span className="flex items-center gap-3.5">
                <span
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                    selected
                      ? 'border-[color-mix(in_srgb,var(--hrack-status-done)_18%,transparent)] bg-[color-mix(in_srgb,var(--hrack-status-done)_7%,white)] text-status-done'
                      : 'border-border-subtle bg-surface-strong text-text-muted group-hover:text-text-secondary'
                  }`}
                >
                  <MapPin className="size-[18px]" strokeWidth={1.65} />
                </span>
                <span className="min-w-0 flex-1 pr-[4.25rem]">
                  <span className="block truncate text-[14px] font-medium tracking-[-0.01em] text-text-primary">
                    {node.label}
                  </span>
                </span>
              </span>
            </button>
            <div className="mx-4 border-t border-border-subtle">
              <button
                type="button"
                disabled={disabled || result.kind === 'testing'}
                onClick={() => void measure(node)}
                className="hrack-press flex h-11 w-full items-center justify-between rounded-md text-[10px] text-text-muted hover:text-text-secondary disabled:opacity-55"
              >
                <span className="inline-flex items-center gap-1.5 font-maple tracking-[0.04em]">
                  {result.kind === 'testing' ? (
                    <LoaderCircle className="size-3 animate-spin" />
                  ) : (
                    <Gauge className="size-3" strokeWidth={1.8} />
                  )}
                  {strings.dashboard.region.latency}
                </span>
                <span className="font-maple text-text-secondary">
                  {result.kind === 'testing'
                    ? strings.dashboard.region.testing
                    : result.kind === 'ready'
                      ? `${result.milliseconds} ms`
                      : result.kind === 'failed'
                        ? strings.dashboard.region.failed
                        : strings.dashboard.region.test}
                </span>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
