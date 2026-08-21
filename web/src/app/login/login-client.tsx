'use client'

import { Brand } from '@/components/Brand'
import { Footer } from '@/components/Footer'
import { Nav } from '@/components/Nav'
import { Reveal } from '@/components/Reveal'
import { useLang } from '@/i18n/lang-context'
import { ArrowLeft } from 'lucide-react'

/** 登录占位页：账号体系上线前，安静地告诉来访者这里会成为什么。 */
export function LoginClient() {
  const { strings } = useLang()

  return (
    <>
      <Nav />
      <main
        id="main"
        className="mx-auto flex min-h-[72vh] w-full max-w-6xl flex-col items-center justify-center px-5 py-20 sm:px-8"
      >
        <Reveal className="w-full max-w-md">
          <div className="rounded-2xl border border-border-default bg-content p-10 text-center shadow-[0_24px_60px_-30px_var(--hrack-shadow-popover)]">
            <Brand className="text-[30px]" />
            <h1 className="mt-7 text-[22px] font-semibold tracking-wide text-text-primary">
              {strings.login.title}
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
              {strings.login.body}
            </p>
            <div className="mt-8 flex justify-center">
              <a
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-border-default bg-content px-5 py-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                <ArrowLeft className="size-3.5" strokeWidth={1.75} />
                {strings.login.back}
              </a>
            </div>
          </div>
        </Reveal>
      </main>
      <Footer />
    </>
  )
}
