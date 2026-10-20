import type { MouseEvent } from 'react'
import { useRouter } from '../router'
import { useDocumentMeta } from '../landing/seo'

/**
 * Comparison workspace for the three Coming Soon directions.
 *
 * Each card embeds the real preview route in an iframe, so what you see is the
 * actual page (not a mock-up) rendering responsively at card size. Open any one
 * full-screen with the link on its card. Nothing here touches the production
 * `/` page — this is a review surface only.
 */

const CONCEPTS = [
  {
    key: 'a',
    name: 'Happy Creative Studio',
    engine: 'Bold colour-blocking · grotesque type',
    hue: '#ff6a2b',
    note: 'Tangerine field, asymmetric stacked headline, ink panel with a studio mark.',
  },
  {
    key: 'b',
    name: 'Interactive Digital Playground',
    engine: 'Kinetic type · cursor-reactive',
    hue: '#c6f24e',
    note: 'Acid-lime field, letters repel from your cursor and spring back.',
  },
  {
    key: 'c',
    name: 'Premium Colourful Editorial',
    engine: 'Oversized serif · magazine grid',
    hue: '#1f3bd6',
    note: 'Ultramarine spread, high-contrast serif, nameplate masthead and drawn rules.',
  },
] as const

export function DesignIndex() {
  useDocumentMeta('Coming Soon — design directions', 'Three visual directions for the Desknoty launch screen.')
  const { navigate } = useRouter()

  // Client-side link that doesn't reload the SPA.
  const go = (href: string) => (e: MouseEvent) => {
    e.preventDefault()
    navigate(href)
  }

  return (
    <section className="min-h-svh bg-[#0e0e0e] text-[#f4efe6]">
      <div className="mx-auto max-w-[1400px] px-5 py-10 sm:px-8 sm:py-14">
        <header className="mb-10 flex flex-wrap items-end justify-between gap-4 border-b border-white/15 pb-6">
          <div>
            <p className="font-sans text-[11px] font-semibold tracking-[0.3em] uppercase text-[#c6f24e]">
              Desknoty · Coming Soon
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Three directions
            </h1>
            <p className="mt-3 max-w-[60ch] text-sm leading-relaxed text-white/60">
              Each preview below is the real, working page — drag the early-access
              control, enter a code, and it talks to the same backend. Open one
              full-screen to feel the motion. The production page is untouched.
            </p>
          </div>
          <div className="font-mono text-[11px] tracking-widest text-white/40 uppercase">
            Preview · Not deployed
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {CONCEPTS.map((c, i) => (
            <article key={c.key} className="flex flex-col overflow-hidden rounded-xl border border-white/12 bg-white/[0.03]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md font-mono text-[13px] font-bold text-black"
                    style={{ background: c.hue }}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="truncate font-mono text-[10px] tracking-wider text-white/45 uppercase">
                      {c.engine}
                    </div>
                  </div>
                </div>
                <a
                  href={`/design/${c.key}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-md border border-white/20 px-2.5 py-1.5 font-mono text-[10px] tracking-widest uppercase transition hover:bg-white hover:text-black"
                >
                  Open ↗
                </a>
              </div>

              {/* live render of the real route */}
              <div className="relative h-[440px] w-full bg-black">
                <iframe
                  src={`/design/${c.key}`}
                  title={`Design ${c.key} preview`}
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              </div>

              <div className="flex-1 px-4 py-3">
                <p className="text-[13px] leading-relaxed text-white/60">{c.note}</p>
                <a
                  href={`/design/${c.key}`}
                  onClick={go(`/design/${c.key}`)}
                  className="mt-3 inline-block font-mono text-[11px] tracking-widest uppercase underline decoration-dotted underline-offset-4 hover:text-[#c6f24e]"
                >
                  View full screen →
                </a>
              </div>
            </article>
          ))}
        </div>

        <footer className="mt-10 flex flex-wrap gap-6 border-t border-white/15 pt-6 font-mono text-[11px] tracking-widest text-white/40 uppercase">
          <a href="/" onClick={go('/')} className="hover:text-white">← Back to page</a>
          <span>Desktop · resize narrow (or DevTools) for mobile</span>
        </footer>
      </div>
    </section>
  )
}
