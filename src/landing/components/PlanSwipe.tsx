import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Clock, Lock, Sparkles } from 'lucide-react'
import { cn } from '../../lib/id'
import { AppWindow } from './mock/AppWindow'
import { Reveal, Section } from './primitives'

/**
 * Free vs Pro comparison: a two-slide carousel over the sample calendar.
 *
 * Purely presentational — it never touches auth, subscriptions or the real
 * calendar. The Pro slide is a blurred preview of planned features only.
 */

type PlanKey = 'free' | 'pro'

const PLANS: Array<{ key: PlanKey; tab: string; title: string }> = [
  { key: 'free', tab: 'Free', title: 'OpenNote Free' },
  { key: 'pro', tab: 'Pro — Coming Soon', title: 'OpenNote Pro (coming soon)' },
]

const FREE_FEATURES = [
  'Calendar and event management',
  'Create and manage notes',
  'Basic task organisation',
  'Daily, weekly, and monthly calendar views',
  'Personal workspace',
  'Essential productivity tools',
]

const PRO_FEATURES = [
  'Everything included in Free',
  'Advanced business management tools',
  'Advanced task tracking',
  'Team collaboration and shared workspaces',
  'Advanced calendar management',
  'Business communication tools',
  'Smart productivity insights',
  'Priority support',
  'More customisation options',
  'Additional premium features coming soon',
]

const DRAG_THRESHOLD = 0.18 // fraction of slide width needed to change slide
const CLICK_SLOP = 6 // px of movement before a press counts as a drag

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReduced(mq.matches)
    update()
    mq.addEventListener?.('change', update)
    return () => mq.removeEventListener?.('change', update)
  }, [])
  return reduced
}

function PlanLabel({ children, tone }: { children: ReactNode; tone: PlanKey }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]',
        tone === 'free' ? 'bg-[#eef7d9] text-[#3f5212]' : 'bg-lp-ink text-white',
      )}
    >
      {children}
    </span>
  )
}

function FeatureList({ items, planned }: { items: string[]; planned?: boolean }) {
  return (
    <ul className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5 text-[14.5px] leading-snug text-lp-body">
          <span
            aria-hidden="true"
            className={cn(
              'mt-[1px] grid h-5 w-5 shrink-0 place-items-center rounded-full',
              planned ? 'bg-[#f1eefc] text-[#6b55c9]' : 'bg-[#eef7d9] text-[#4d6516]',
            )}
          >
            {planned ? <Clock className="h-3 w-3" strokeWidth={2.5} /> : <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          {item}
        </li>
      ))}
    </ul>
  )
}

function FreeSlide() {
  return (
    <div>
      <div className="relative">
        <div className="absolute top-3 left-3 z-10 sm:top-4 sm:left-4">
          <PlanLabel tone="free">Free plan</PlanLabel>
        </div>
        <AppWindow label="opennote — free" />
      </div>
      <div className="mt-6 px-1">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-lp-ink">Included in Free</h3>
        <FeatureList items={FREE_FEATURES} />
      </div>
    </div>
  )
}

function ProSlide() {
  return (
    <div>
      <div className="relative overflow-hidden rounded-[14px]">
        {/* Preview only: blurred, non-interactive, hidden from assistive tech. */}
        <div aria-hidden="true" inert className="pointer-events-none select-none">
          <AppWindow label="opennote — pro" />
        </div>
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/45 to-white/70 backdrop-blur-[5px]"
        />
        <div aria-hidden="true" className="lp-pro-glow pointer-events-none absolute inset-0" />
        <div className="absolute top-3 left-3 z-10 sm:top-4 sm:left-4">
          <PlanLabel tone="pro">
            <Lock className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> Pro
          </PlanLabel>
        </div>
        <div className="absolute inset-0 grid place-items-center p-3 sm:p-6">
          <div className="w-full max-w-[420px] rounded-[20px] border border-white/80 bg-white/70 px-5 py-5 text-center shadow-[0_30px_60px_-30px_rgba(40,30,80,0.45),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl sm:px-8 sm:py-8">
            <div className="mx-auto flex w-fit items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lp-ink text-white sm:h-10 sm:w-10">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#f1eefc] text-[#6b55c9] sm:h-10 sm:w-10">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-3 text-[20px] font-semibold tracking-[-0.02em] text-lp-ink sm:mt-4 sm:text-[26px]">OpenNote Pro</p>
            <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.14em] text-[#6b55c9] sm:text-[13px]">Coming Soon</p>
            <p className="mt-2 hidden text-[14.5px] leading-relaxed text-lp-body sm:block">
              Unlock more powerful tools to manage your business, organise your work, and stay productive.
            </p>
          </div>
        </div>
      </div>
      <div className="mt-6 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-lp-ink">Planned for Pro</h3>
          <span className="rounded-full bg-[#f1eefc] px-2 py-0.5 text-[11.5px] font-medium text-[#6b55c9]">Not yet available</span>
        </div>
        <p className="mt-1.5 text-[14px] text-lp-muted sm:hidden">
          Unlock more powerful tools to manage your business, organise your work, and stay productive.
        </p>
        <FeatureList items={PRO_FEATURES} planned />
      </div>
    </div>
  )
}

export function PlanSwipe() {
  const [index, setIndex] = useState(0)
  const [dragPx, setDragPx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const reduced = usePrefersReducedMotion()
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean; locked: 'x' | 'y' | null } | null>(null)
  const suppressClick = useRef(false)

  const go = useCallback((next: number) => setIndex(Math.max(0, Math.min(PLANS.length - 1, next))), [])

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, locked: null }
    suppressClick.current = false
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const dx = e.clientX - d.x
    const dy = e.clientY - d.y
    if (!d.locked) {
      if (Math.abs(dx) < CLICK_SLOP && Math.abs(dy) < CLICK_SLOP) return
      d.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (d.locked === 'y') {
        drag.current = null // vertical scroll wins
        return
      }
      d.moved = true
      setDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    e.preventDefault()
    // Rubber-band past the ends.
    const atEdge = (index === 0 && dx > 0) || (index === PLANS.length - 1 && dx < 0)
    setDragPx(atEdge ? dx * 0.3 : dx)
  }

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId || !d.moved) return
    suppressClick.current = true
    const width = viewportRef.current?.clientWidth || 1
    const dx = e.clientX - d.x
    if (dx < -width * DRAG_THRESHOLD) go(index + 1)
    else if (dx > width * DRAG_THRESHOLD) go(index - 1)
    setDragPx(0)
    setDragging(false)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const target = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: PLANS.length - 1 }[e.key]
    if (target === undefined) return
    e.preventDefault()
    const next = Math.max(0, Math.min(PLANS.length - 1, target))
    go(next)
    document.getElementById(`plan-tab-${PLANS[next].key}`)?.focus()
  }

  const transition = dragging || reduced ? 'none' : 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)'

  return (
    <Section id="plans">
      <Reveal>
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-lp-ink sm:text-[44px]">Explore OpenNote</h2>
          <p className="mt-3 text-[17px] text-lp-body">One workspace. More possibilities.</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="mt-8 flex justify-center">
          <div role="tablist" aria-label="OpenNote plans" className="relative grid w-full max-w-[380px] grid-cols-2 rounded-[12px] bg-[#ececea] p-1">
            <span
              aria-hidden="true"
              className="absolute inset-y-1 left-1 w-[calc((100%-8px)/2)] rounded-[9px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] motion-safe:transition-transform motion-safe:duration-300"
              style={{ transform: `translateX(${index * 100}%)` }}
            />
            {PLANS.map((plan, i) => (
              <button
                key={plan.key}
                id={`plan-tab-${plan.key}`}
                type="button"
                role="tab"
                aria-selected={index === i}
                aria-controls={`plan-panel-${plan.key}`}
                tabIndex={index === i ? 0 : -1}
                onClick={() => go(i)}
                onKeyDown={onKeyDown}
                className={cn(
                  'relative z-10 inline-flex items-center justify-center gap-1.5 rounded-[9px] py-2 text-[14px] font-medium transition-colors',
                  index === i ? 'text-lp-ink' : 'text-lp-body hover:text-lp-ink',
                )}
              >
                {plan.key === 'pro' && <Sparkles className="h-3.5 w-3.5 text-[#6b55c9]" aria-hidden="true" />}
                {plan.tab}
              </button>
            ))}
          </div>
        </div>

        <div className="relative mt-8">
          <div
            ref={viewportRef}
            className={cn('overflow-hidden rounded-[22px] bg-lp-sunken select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
            style={{ touchAction: 'pan-y' }}
            aria-roledescription="carousel"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onClickCapture={(e) => {
              if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false }
            }}
            onDragStart={(e) => e.preventDefault()}
          >
            <div
              className="flex"
              style={{ transform: `translateX(calc(${-index * 100}% + ${dragPx}px))`, transition }}
            >
              {PLANS.map((plan, i) => (
                <div
                  key={plan.key}
                  id={`plan-panel-${plan.key}`}
                  role="tabpanel"
                  aria-labelledby={`plan-tab-${plan.key}`}
                  aria-hidden={index !== i}
                  inert={index !== i}
                  className="w-full shrink-0 p-3 sm:p-6"
                >
                  {plan.key === 'free' ? <FreeSlide /> : <ProSlide />}
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            aria-label="Show Free plan"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="absolute top-[30%] -left-3 z-20 hidden h-10 w-10 place-items-center rounded-full border border-lp-line bg-white/90 text-lp-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] backdrop-blur transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:grid lg:-left-5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Show Pro plan preview"
            onClick={() => go(index + 1)}
            disabled={index === PLANS.length - 1}
            className="absolute top-[30%] -right-3 z-20 hidden h-10 w-10 place-items-center rounded-full border border-lp-line bg-white/90 text-lp-ink shadow-[0_6px_18px_-8px_rgba(0,0,0,0.35)] backdrop-blur transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0 sm:grid lg:-right-5"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {PLANS.map((plan, i) => (
            <button
              key={plan.key}
              type="button"
              aria-label={`Go to ${plan.title}`}
              aria-current={index === i}
              onClick={() => go(i)}
              className="grid h-6 w-6 place-items-center"
            >
              <span
                className={cn(
                  'block h-2 rounded-full motion-safe:transition-all motion-safe:duration-300',
                  index === i ? 'w-6 bg-lp-ink' : 'w-2 bg-[#cfcdc6]',
                )}
              />
            </button>
          ))}
        </div>
        <p aria-live="polite" className="sr-only">
          Showing {PLANS[index].title}
        </p>
        <p className="mt-3 text-center text-[13px] text-lp-muted">
          Swipe, drag or use the arrow keys. Pro features are planned and not yet available.
        </p>
      </Reveal>
    </Section>
  )
}
