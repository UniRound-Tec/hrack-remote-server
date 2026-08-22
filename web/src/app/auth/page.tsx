import type { Metadata } from 'next'
import { AuthPanel } from '@/components/AuthPanel'

export const metadata: Metadata = {
  title: '登录 · HRack',
  robots: { index: false }
}

export default function AuthPage() {
  return <AuthPanel />
}
