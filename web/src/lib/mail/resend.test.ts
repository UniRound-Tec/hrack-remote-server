import { describe, expect, it, vi } from 'vitest'
import { createResendProvider } from './resend'

describe('Resend provider', () => {
  it('sends a bilingual OTP message', async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: 'email-id' },
      error: null
    })
    const provider = createResendProvider(
      { apiKey: 're_test_key', from: 'HRack <hello@example.test>' },
      { emails: { send } }
    )

    await provider.send({
      email: 'user@example.test',
      otp: '654321',
      at: 1
    })

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'HRack <hello@example.test>',
        to: 'user@example.test',
        subject: expect.stringContaining('verification'),
        text: expect.stringContaining('654321'),
        html: expect.stringContaining('654321')
      })
    )

    await provider.sendTest('operator@example.test')
    expect(send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: 'operator@example.test',
        subject: 'HRack mail delivery test'
      })
    )
  })

  it('turns an API error result into a rejected send', async () => {
    const provider = createResendProvider(
      { apiKey: 're_test_key', from: 'HRack <hello@example.test>' },
      {
        emails: {
          send: vi.fn().mockResolvedValue({
            data: null,
            error: { name: 'validation_error', message: 'invalid from' }
          })
        }
      }
    )

    await expect(
      provider.send({
        email: 'user@example.test',
        otp: '654321',
        at: 1
      })
    ).rejects.toThrow('Resend rejected the verification email')
  })
})
