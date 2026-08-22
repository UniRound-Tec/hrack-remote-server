export type VerificationOtp = {
  email: string
  otp: string
  at: number
}

export type MailProviderKind = 'console' | 'smtp' | 'resend'

export type MailProvider = {
  readonly kind: MailProviderKind
  send(message: VerificationOtp): Promise<void>
  sendTest(email: string): Promise<void>
}
