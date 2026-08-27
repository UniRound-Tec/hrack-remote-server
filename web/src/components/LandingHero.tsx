'use client'

import Image from 'next/image'
import { Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Brand } from './Brand'
import { LandingBeams } from './LandingBeams'
import { LandingFluidGlass } from './LandingFluidGlass'
import { formatGitHubStars, GITHUB_REPOSITORY_URL } from '@/lib/github'
import { useGitHubStars } from '@/lib/use-github-stars'
import { useDownloadTarget } from '@/lib/use-latest-release'
const DOCS_URL = 'https://github.com/UniRound-Tec/HRack#readme'
const CONTACT_URL = 'https://github.com/UniRound-Tec/HRack/issues'
const ABOUT_URL = 'https://github.com/UniRound-Tec'

function GitHubMark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.58 2 12.24c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49v-1.9c-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.56 2.35 1.11 2.92.85.09-.66.35-1.11.64-1.37-2.22-.26-4.55-1.14-4.55-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.33 9.33 0 0 1 12 8.57a9.3 9.3 0 0 1 2.5.35c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.06.36.32.68.94.68 1.89v2.81c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z" />
    </svg>
  )
}

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
  const stars = useGitHubStars()

  return (
    <section className="landing-root">
      <LandingBeams />

      <div className="landing-layout landing-copy">
        <div className="landing-copy-stack">
          <div className="landing-brand-block">
            <a
              aria-label={
                stars === null
                  ? 'Open HRack on GitHub'
                  : `Open HRack on GitHub, ${stars} stars`
              }
              className="landing-github-button"
              href={GITHUB_REPOSITORY_URL}
              target="_blank"
              rel="noreferrer"
            >
              <GitHubMark />
              <span>GitHub</span>
              <span aria-hidden className="landing-github-divider" />
              <Star aria-hidden className="landing-github-star" />
              <span aria-live="polite" className="landing-github-count">
                {formatGitHubStars(stars)}
              </span>
            </a>
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
          <LandingFluidGlass />
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
            href={urlFor('android')}
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
