import type { Metadata, Viewport } from 'next'
import { zhCN } from '@/i18n/zh-CN'
import { LangProvider } from '@/i18n/lang-context'
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

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="antialiased">
        {/* 主仓 SidebarTint 的画布思想：极淡的环境光晕垫在整页之下 */}
        <div
          aria-hidden
          className="ambient-tint pointer-events-none fixed inset-0 z-0"
        />
        <TerminalBackdrop />
        <div className="relative z-10">
          <LangProvider>{children}</LangProvider>
        </div>
      </body>
    </html>
  )
}
