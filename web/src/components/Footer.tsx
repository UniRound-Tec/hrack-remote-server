'use client'

import { useLang } from '@/i18n/lang-context'
import { Brand } from './Brand'

const REPO_URL = 'https://github.com/UniRound-Tec/HRack'
const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'
const LICENSE_URL =
  'https://github.com/UniRound-Tec/HRack/blob/main/LICENSE'

export function Footer() {
  const { strings } = useLang()

  return (
    <footer className="border-t border-border-faint">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Brand className="text-[18px]" />
          <p className="text-[13px] text-text-muted">
            {strings.footer.tagline}
          </p>
        </div>
        <nav className="flex items-center gap-5 font-maple text-[11px] tracking-wide text-text-faint">
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text-secondary"
          >
            {strings.footer.links.github}
          </a>
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text-secondary"
          >
            {strings.footer.links.releases}
          </a>
          <a
            href={LICENSE_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-text-secondary"
          >
            {strings.footer.links.license}
          </a>
        </nav>
      </div>
    </footer>
  )
}
