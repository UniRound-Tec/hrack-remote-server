'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { LandingBeams } from './LandingBeams'
import { useDownloadTarget } from '@/lib/use-latest-release'

const ANDROID_RELEASES =
  'https://github.com/UniRound-Tec/hrack-remote-app/releases/latest'
const DOCS_URL = 'https://github.com/UniRound-Tec/HRack#readme'
const CONTACT_URL = 'https://github.com/UniRound-Tec/HRack/issues'
const ABOUT_URL = 'https://github.com/UniRound-Tec'

function ActionLink({
  href,
  variant,
  icon,
  children,
  external = false
}: {
  href: string
  variant: 'windows' | 'android' | 'remote'
  icon: ReactNode
  children: ReactNode
  external?: boolean
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noreferrer' : undefined}
      className={`landing-action landing-action-${variant}`}
    >
      <span className="landing-action-icon">{icon}</span>
      <span>{children}</span>
    </a>
  )
}

export function LandingHero() {
  const { urlFor } = useDownloadTarget()

  return (
    <section className="landing-root">
      <LandingBeams />

      <div className="landing-layout landing-copy">
        <div className="landing-copy-stack">
          <div className="landing-brand-block">
            <div className="landing-brand landing-logo">
              <Brand className="landing-logo-text" />
            </div>
            <p className="landing-tagline">
              <span aria-hidden className="landing-dot" />
              <span>One workspace Every agent in view.</span>
            </p>
          </div>

          <div className="landing-heading-block">
            <h1>
              A modern <span>terminal</span> built for coding agents.
            </h1>
            <p>
              Run multiple coding agents in parallel, follow their progress,
              and manage every task from one focused workspace.
            </p>
          </div>
        </div>

        <div className="landing-actions">
          <ActionLink
            href={urlFor('windows')}
            variant="windows"
            icon={
              <Image
                src="/landing-windows.svg"
                alt=""
                width={32}
                height={32}
              />
            }
            external
          >
            Download for Windows
          </ActionLink>
          <ActionLink
            href={ANDROID_RELEASES}
            variant="android"
            icon={
              <Image
                src="/landing-android.svg"
                alt=""
                width={40}
                height={25}
              />
            }
            external
          >
            Download for Android
          </ActionLink>
          <ActionLink
            href="/auth?tab=register&next=/dashboard"
            variant="remote"
            icon={
              <Image
                src="/landing-phone.svg"
                alt=""
                width={26}
                height={36}
              />
            }
          >
            Generate Remote Control URL
          </ActionLink>
        </div>
      </div>

      <footer className="landing-footer landing-copy">
        <a href={DOCS_URL} target="_blank" rel="noreferrer">
          Docs
        </a>
        <span aria-hidden />
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Contact Us
        </a>
        <span aria-hidden />
        <a href={ABOUT_URL} target="_blank" rel="noreferrer">
          About
        </a>
      </footer>
    </section>
  )
}
