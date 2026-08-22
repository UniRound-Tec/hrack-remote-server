import fs from 'node:fs/promises'
import path from 'node:path'
import type { VerificationOtp } from './types'

function dataDir(): string {
  return process.env.HRACK_WEB_DATA ?? path.join(process.cwd(), 'data')
}

export async function sendConsoleOtp(message: VerificationOtp): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.info('[mail.console] verification OTP suppressed in production')
    return
  }

  // Keep the OTP and full address out of the same log line.
  console.info(`[mail.console] verification OTP: ${message.otp}`)
  const file = path.join(dataDir(), 'last-otp.json')
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, `${JSON.stringify(message)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  await fs.chmod(file, 0o600)
}
