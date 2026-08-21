'use client'

import { Download } from '@/components/Download'
import { Flow } from '@/components/Flow'
import { Footer } from '@/components/Footer'
import { Harnesses } from '@/components/Harnesses'
import { Hero } from '@/components/Hero'
import { Nav } from '@/components/Nav'
import { States } from '@/components/States'
import { useLang } from '@/i18n/lang-context'

export default function LandingPage() {
  const { strings } = useLang()

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-md focus:border focus:border-border-default focus:bg-content focus:px-3 focus:py-2 focus:text-[13px] focus:text-text-primary"
      >
        {strings.nav.skipToContent}
      </a>
      <div id="top" />
      <Nav />
      <main id="main">
        <div data-section="hero">
          <Hero />
        </div>
        <div data-section="states">
          <States />
        </div>
        <div data-section="flow">
          <Flow />
        </div>
        <div data-section="harnesses">
          <Harnesses />
        </div>
        <div data-section="download">
          <Download />
        </div>
      </main>
      <Footer />
    </>
  )
}
