import type { SmtpConfig } from '../mail/smtp'

export type SettingsSource = 'env' | 'db' | 'default'

export type StoredOAuthProvider = {
  clientId: string
  clientSecret: string
}

export type StoredSettings = {
  smtp: SmtpConfig
  github: StoredOAuthProvider
  google: StoredOAuthProvider
  emailVerificationRequired: boolean
}

export type SettingKey = keyof StoredSettings
