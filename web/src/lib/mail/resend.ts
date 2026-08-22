import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailResponse
} from 'resend'
import { verificationEmail } from './message'
import type { MailProvider } from './types'

export type ResendConfig = {
  apiKey: string
  from: string
}

type ResendClient = {
  emails: {
    send(payload: CreateEmailOptions): Promise<CreateEmailResponse>
  }
}

export function createResendProvider(
  config: ResendConfig,
  client: ResendClient = new Resend(config.apiKey)
): MailProvider {
  return {
    kind: 'resend',
    async send(message) {
      const result = await client.emails.send({
        from: config.from,
        to: message.email,
        ...verificationEmail(message.otp)
      })
      if (result.error) {
        throw new Error('Resend rejected the verification email')
      }
    }
  }
}
