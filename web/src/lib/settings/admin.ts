import { reloadAuth } from '../auth'
import { recordAudit } from '../admin/audit'
import {
  isMailReady,
  loadStoredSmtpForResolution,
  resolveMailProvider,
  resolveSmtpConfig
} from '../mail/provider'
import type { SmtpConfig, SmtpSecurity } from '../mail/smtp'
import { emptyToUndef, loadRuntimeConfig, verificationSetting } from './resolve'
import { deleteSetting, readSetting, writeSetting } from './store'
import type { SettingKey, SettingsSource, StoredOAuthProvider } from './types'

export class SettingsMutationError extends Error {
  constructor(
    readonly status: 400 | 409 | 502,
    readonly code: string
  ) {
    super(code)
    this.name = 'SettingsMutationError'
  }
}

export type MailSettingsView = {
  smtp: {
    host: string
    port: number | null
    security: SmtpSecurity
    username: string
    from: string
    passwordConfigured: boolean
    source: SettingsSource
    pinned: boolean
  }
  emailVerificationRequired: {
    value: boolean
    source: SettingsSource
    pinned: boolean
  }
}

export type OAuthProviderId = 'github' | 'google' | 'linux-do'

const OAUTH_ENV_PREFIX: Record<OAuthProviderId, string> = {
  github: 'GITHUB',
  google: 'GOOGLE',
  'linux-do': 'LINUX_DO'
}

export type OAuthSettingsView = Record<
  OAuthProviderId,
  {
    enabled: boolean
    clientId: string
    clientSecretConfigured: boolean
    callbackUrl: string
    source: SettingsSource
    pinned: boolean
  }
>

export type MailSettingsInput = {
  smtp?: {
    host: string
    port: number
    security: SmtpSecurity
    username?: string
    password?: string
    from: string
  }
  emailVerificationRequired?: boolean
}

export type OAuthSettingsInput = {
  provider: OAuthProviderId
  enabled: boolean
  clientId?: string
  clientSecret?: string
}

let mutationChain: Promise<void> = Promise.resolve()

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(operation, operation)
  mutationChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function isPinned(...names: string[]): boolean {
  return names.some((name) => emptyToUndef(process.env[name]) !== undefined)
}

function smtpPinned(): boolean {
  return isPinned(
    'MAIL_PROVIDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'SMTP_SECURITY'
  )
}

function oauthEnv(provider: OAuthProviderId): {
  clientId?: string
  clientSecret?: string
} {
  const prefix = OAUTH_ENV_PREFIX[provider]
  return {
    clientId: emptyToUndef(process.env[`${prefix}_CLIENT_ID`]),
    clientSecret: emptyToUndef(process.env[`${prefix}_CLIENT_SECRET`])
  }
}

function oauthPinned(provider: OAuthProviderId): boolean {
  const env = oauthEnv(provider)
  return Boolean(env.clientId || env.clientSecret)
}

function settingSource(key: SettingKey, pinned: boolean): SettingsSource {
  if (pinned) return 'env'
  return readSetting(key) === undefined ? 'default' : 'db'
}

export function getMailSettingsView(): MailSettingsView {
  const stored = loadStoredSmtpForResolution()
  const pinned = smtpPinned()
  const effective = resolveSmtpConfig(stored) ?? stored
  return {
    smtp: {
      host: effective?.host ?? '',
      port: effective?.port ?? null,
      security: effective?.security ?? 'starttls',
      username: effective?.username ?? '',
      from: effective?.from ?? '',
      passwordConfigured: Boolean(effective?.password),
      source: settingSource('smtp', pinned),
      pinned
    },
    emailVerificationRequired: verificationSetting()
  }
}

function normalizedSmtp(
  input: NonNullable<MailSettingsInput['smtp']>,
  stored: SmtpConfig | undefined
): SmtpConfig {
  const host = input.host.trim()
  const from = input.from.trim()
  const username = emptyToUndef(input.username)
  const suppliedPassword = emptyToUndef(input.password)
  const password = username
    ? suppliedPassword ?? (stored?.username === username ? stored.password : undefined)
    : undefined
  const candidate: SmtpConfig = {
    host,
    port: input.port,
    security: input.security,
    username,
    password,
    from
  }
  if (
    !host ||
    !from ||
    !Number.isInteger(input.port) ||
    input.port < 1 ||
    input.port > 65_535 ||
    !['tls', 'starttls', 'none'].includes(input.security) ||
    Boolean(username) !== Boolean(password) ||
    !resolveSmtpConfig(candidate)
  ) {
    throw new SettingsMutationError(400, 'INVALID_SMTP')
  }
  return candidate
}

function logUpdate(actorId: string, fields: string[]): void {
  console.info(
    JSON.stringify({
      event: 'admin.settings_update',
      outcome: 'saved',
      user_id: actorId,
      fields
    })
  )
}

export function saveMailSettings(
  input: MailSettingsInput,
  actorId: string
): Promise<MailSettingsView> {
  return serialized(async () => {
    if (input.smtp === undefined && input.emailVerificationRequired === undefined) {
      throw new SettingsMutationError(400, 'INVALID_REQUEST')
    }
    if (input.smtp && smtpPinned()) {
      throw new SettingsMutationError(409, 'PINNED')
    }
    if (
      input.emailVerificationRequired !== undefined &&
      verificationSetting().pinned
    ) {
      throw new SettingsMutationError(409, 'PINNED')
    }

    const storedSmtp = smtpPinned()
      ? undefined
      : readSetting('smtp')
    const smtp = input.smtp ? normalizedSmtp(input.smtp, storedSmtp) : storedSmtp
    const currentVerification = verificationSetting().value
    const nextVerification =
      input.emailVerificationRequired ?? currentVerification

    if (
      nextVerification &&
      !currentVerification &&
      !(await isMailReady(smtp))
    ) {
      throw new SettingsMutationError(409, 'MAIL_UNAVAILABLE')
    }

    const fields: string[] = []
    if (input.smtp && smtp) {
      writeSetting('smtp', smtp, actorId)
      fields.push('smtp')
    }
    if (input.emailVerificationRequired !== undefined) {
      writeSetting(
        'emailVerificationRequired',
        input.emailVerificationRequired,
        actorId
      )
      fields.push('emailVerificationRequired')
      await reloadAuth()
    }
    logUpdate(actorId, fields)
    recordAudit(actorId, 'settings.mail.update', 'mail', fields)
    return getMailSettingsView()
  })
}

export function clearMailSettings(actorId: string): Promise<MailSettingsView> {
  return serialized(async () => {
    if (smtpPinned() || verificationSetting().pinned) {
      throw new SettingsMutationError(409, 'PINNED')
    }
    const changed = [
      deleteSetting('smtp'),
      deleteSetting('emailVerificationRequired')
    ].some(Boolean)
    if (changed) await reloadAuth()
    logUpdate(actorId, ['smtp', 'emailVerificationRequired'])
    recordAudit(actorId, 'settings.mail.clear', 'mail', [
      'emailVerificationRequired',
      'smtp'
    ])
    return getMailSettingsView()
  })
}

export async function sendMailTest(
  email: string,
  actorId?: string
): Promise<void> {
  try {
    const provider = await resolveMailProvider(loadStoredSmtpForResolution())
    await provider.sendTest(email)
    if (actorId) recordAudit(actorId, 'settings.mail.test', 'mail')
  } catch {
    console.error(
      JSON.stringify({ event: 'mail.send_fail', outcome: 'test_failed' })
    )
    throw new SettingsMutationError(502, 'MAIL_TEST_FAILED')
  }
}

function oauthView(provider: OAuthProviderId): OAuthSettingsView[OAuthProviderId] {
  const env = oauthEnv(provider)
  const stored =
    env.clientId && env.clientSecret ? undefined : readSetting(provider)
  const clientId = env.clientId ?? stored?.clientId ?? ''
  const clientSecret = env.clientSecret ?? stored?.clientSecret
  const base = emptyToUndef(process.env.BETTER_AUTH_URL)?.replace(/\/$/, '') ?? ''
  return {
    enabled: Boolean(clientId && clientSecret),
    clientId,
    clientSecretConfigured: Boolean(clientSecret),
    callbackUrl: `${base}/api/auth/callback/${provider}`,
    source: settingSource(provider, oauthPinned(provider)),
    pinned: oauthPinned(provider)
  }
}

export function getOAuthSettingsView(): OAuthSettingsView {
  return {
    github: oauthView('github'),
    google: oauthView('google'),
    'linux-do': oauthView('linux-do')
  }
}

export function saveOAuthSettings(
  input: OAuthSettingsInput,
  actorId: string
): Promise<OAuthSettingsView> {
  return serialized(async () => {
    if (oauthPinned(input.provider)) {
      throw new SettingsMutationError(409, 'PINNED')
    }
    if (!input.enabled) {
      deleteSetting(input.provider)
    } else {
      const stored = readSetting(input.provider)
      const value: StoredOAuthProvider = {
        clientId: input.clientId?.trim() ?? '',
        clientSecret:
          emptyToUndef(input.clientSecret) ?? stored?.clientSecret ?? ''
      }
      if (!value.clientId || !value.clientSecret) {
        throw new SettingsMutationError(400, 'INVALID_OAUTH')
      }
      writeSetting(input.provider, value, actorId)
    }
    await reloadAuth()
    logUpdate(actorId, [`oauth.${input.provider}`])
    recordAudit(
      actorId,
      input.enabled ? 'settings.oauth.update' : 'settings.oauth.clear',
      `oauth.${input.provider}`,
      ['clientId', 'clientSecret', 'enabled']
    )
    return getOAuthSettingsView()
  })
}

export function clearOAuthSettings(
  provider: OAuthProviderId,
  actorId: string
): Promise<OAuthSettingsView> {
  return saveOAuthSettings({ provider, enabled: false }, actorId)
}

export function currentRuntimeConfig() {
  return loadRuntimeConfig()
}
