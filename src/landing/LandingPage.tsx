import { useEffect } from 'react'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { HowItWorks } from './components/HowItWorks'
import { Features } from './components/Features'
import { ProductPreview } from './components/ProductPreview'
import { PlanSwipe } from './components/PlanSwipe'
import { Pricing } from './components/Pricing'
import { Faq } from './components/Faq'
import { FinalCta } from './components/FinalCta'
import { Footer } from './components/Footer'
import { useHashOnMount } from './hooks'
import { useScrollMotion } from './motion'
import { Cursor } from './components/Cursor'
import { SITE, useDocumentMeta } from './seo'

export function LandingPage() {
  useDocumentMeta(SITE.title, SITE.description)
  useHashOnMount()
  useScrollMotion()

  // Scoped classes rather than global CSS overrides, so the calendar app is
  // completely unaffected by anything on this page.
  useEffect(() => {
    document.body.classList.add('lp-body')
    document.documentElement.classList.add('lp-smooth')
    return () => {
      document.body.classList.remove('lp-body')
      document.documentElement.classList.remove('lp-smooth')
    }
  }, [])

  return (
    <div className="relative min-h-full overflow-x-clip bg-lp-bg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:rounded-full focus:bg-lp-ink focus:px-4 focus:py-2.5 focus:text-[14px] focus:font-medium focus:text-white"
      >
        Skip to content
      </a>

      <Cursor />
      <Nav />

      <main id="main">
        <Hero />
        <HowItWorks />
        <Features />
        <ProductPreview />
        <PlanSwipe />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  )
}
