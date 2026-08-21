import type { Metadata } from 'next'
import { LoginClient } from './login-client'

export const metadata: Metadata = {
  title: '登录 · HRack',
  robots: { index: false }
}

export default function LoginPage() {
  return <LoginClient />
}
