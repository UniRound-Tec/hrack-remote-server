import type { Metadata, Viewport } from 'next'
import { cookies, headers } from 'next/headers'
import { zhCN } from '@/i18n/zh-CN'
import { LangProvider } from '@/i18n/lang-context'
import { isLocale, parseAcceptLanguage, resolveLocale } from '@/i18n/locale'
import { TerminalBackdrop } from '@/components/TerminalBackdrop'
import '@fontsource/noto-sans-sc/400.css'
import '@fontsource/noto-sans-sc/500.css'
import '@fontsource/noto-sans-sc/700.css'
import './globals.css'

export const metadata: Metadata = {
  title: zhCN.meta.title,
  description: zhCN.meta.description
}

export const viewport: Viewport = {
  themeColor: '#f6f6f5'
}

export default async function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const cookieLang = cookieStore.get('hrack-lang')?.value
  const initialLang =
    cookieLang && isLocale(cookieLang)
      ? cookieLang
      : resolveLocale(parseAcceptLanguage(headerStore.get('accept-language')))

  return (
    <html lang={initialLang} suppressHydrationWarning>
      <body className="antialiased">
        {/* 主仓 SidebarTint 的画布思想：极淡的环境光晕垫在整页之下 */}
        <div
          aria-hidden
          className="ambient-tint pointer-events-none fixed inset-0 z-0"
        />
        <TerminalBackdrop />
        <div className="relative z-10">
          <LangProvider initialLang={initialLang}>{children}</LangProvider>
        </div>
      </body>
    </html>
  )
}
