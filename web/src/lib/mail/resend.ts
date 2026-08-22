import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailResponse
} from 'resend'
import { testEmail, verificationEmail } from './message'
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
  async function send(email: string, content: ReturnType<typeof testEmail>) {
    const result = await client.emails.send({
      from: config.from,
      to: email,
      ...content
    })
    if (result.error) {
      throw new Error('Resend rejected the verification email')
    }
  }

  return {
    kind: 'resend',
    async send(message) {
      await send(message.email, verificationEmail(message.otp))
    },
    async sendTest(email) {
      await send(email, testEmail())
    }
  }
}
