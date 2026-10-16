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

export const PLANS: Array<{ key: PlanKey; tab: string; title: string }> = [
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
              planned ? 'bg-[#f1f1ef] text-lp-ink-3' : 'bg-[#eef7d9] text-[#4d6516]',
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

/** The hero's laptop frame: dark bezel around the window, with a base. */
function Laptop({ children }: { children: ReactNode }) {
  return (
    <div className="px-1 sm:px-4">
      <div className="relative rounded-[18px] bg-lp-ink p-1.5 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.45)] sm:rounded-[22px] sm:p-2.5">
        {children}
      </div>
      <div aria-hidden="true" className="mx-auto h-2.5 w-[106%] -translate-x-[2.8%] rounded-b-[16px] bg-gradient-to-b from-[#d9d9d6] to-[#bdbdb9] sm:h-3.5" />
    </div>
  )
}

function SlideHeading({ children }: { children: ReactNode }) {
  return <div className="mb-4 flex flex-wrap items-center justify-center gap-2 sm:mb-5">{children}</div>
}

function FreeSlide() {
  return (
    <div>
      <SlideHeading>
        <PlanLabel tone="free">Free plan</PlanLabel>
        <span className="text-[13.5px] text-lp-muted">Available today</span>
      </SlideHeading>
      <Laptop>
        <AppWindow label="opennote — free" />
      </Laptop>
      <div className="mt-8 px-1">
        <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-lp-ink">Included in Free</h3>
        <FeatureList items={FREE_FEATURES} />
      </div>
    </div>
  )
}

/** Soft frosted blur, glow and "Coming Soon" card laid over a Pro preview. */
export function ProOverlay({ showBadge = true }: { showBadge?: boolean }) {
  return (
    <>
      {/* Soft frost: the calendar stays recognisable underneath. */}
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.35)_0%,rgba(255,255,255,0.55)_60%,rgba(255,255,255,0.8)_100%)] backdrop-blur-[3px]" />

      {/* Planned Pro-only surfaces, hinted behind the frost. */}
      <div aria-hidden="true" className="pointer-events-none absolute top-[14%] right-[3%] hidden w-[22%] rounded-[14px] border border-lp-line bg-white/80 p-3 shadow-[0_18px_36px_-24px_rgba(0,0,0,0.35)] blur-[1.5px] md:block">
        <div className="h-2 w-1/2 rounded-full bg-[#e3e3e0]" />
        <div className="mt-3 flex h-14 items-end gap-1.5">
          {[40, 65, 50, 85, 70, 95].map((h, i) => (
            <span key={i} className={cn('flex-1 rounded-t-[4px]', i === 5 ? 'bg-lime-bright' : 'bg-[#dcdbd7]')} style={{ height: `${h}%` }} />
          ))}
        </div>
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute bottom-[12%] left-[4%] hidden items-center rounded-full border border-lp-line bg-white/85 py-1.5 pr-3 pl-1.5 shadow-[0_14px_28px_-20px_rgba(0,0,0,0.35)] blur-[1px] md:flex">
        {['#bef264', '#f9a8c8', '#fdba74', '#dcdbd7'].map((c, i) => (
          <span key={c} className="h-6 w-6 rounded-full border-2 border-white" style={{ background: c, marginLeft: i ? -8 : 0 }} />
        ))}
        <span className="ml-2 h-2 w-14 rounded-full bg-[#e3e3e0]" />
      </div>

      {showBadge && <div className="absolute top-3 right-3 z-10 sm:top-4 sm:right-4">
        <PlanLabel tone="pro">
          <Lock className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> Pro
        </PlanLabel>
      </div>}

      <div className="absolute inset-0 grid place-items-center p-3 sm:p-6">
        <div className="w-full max-w-[340px] rounded-[18px] border-[1.5px] border-lp-ink bg-white px-5 py-4 text-center shadow-[4px_4px_0_0_#191919] sm:max-w-[380px] sm:px-7 sm:py-6">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-[11px] border-[1.5px] border-lp-ink bg-lime-bright text-lp-ink shadow-[2px_2px_0_0_#191919] sm:h-11 sm:w-11">
            <Lock className="h-[18px] w-[18px]" strokeWidth={2.4} aria-hidden="true" />
          </span>
          <p className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-lp-ink sm:mt-4 sm:text-[27px]">OpenNote Pro</p>
          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-lp-ink px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white sm:text-[11px]">
            <Sparkles className="h-3 w-3 text-lime-bright" aria-hidden="true" /> Coming soon
          </span>
          <p className="mx-auto mt-3 hidden max-w-[32ch] text-[13.5px] leading-relaxed text-lp-body sm:block">
            Unlock more powerful tools to manage your business, organise your work, and stay productive.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:mt-4">
            {['Team workspaces', 'Business tools', 'Smart insights'].map((t) => (
              <span key={t} className="rounded-full border border-lp-line bg-lp-sunken px-2.5 py-1 text-[11px] font-medium text-lp-ink-3 sm:text-[11.5px]">
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function ProSlide() {
  return (
    <div>
      <SlideHeading>
        <PlanLabel tone="pro">
          <Lock className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" /> Pro plan
        </PlanLabel>
        <span className="text-[13.5px] text-lp-muted">Coming soon</span>
      </SlideHeading>
      <Laptop>
        <div className="relative overflow-hidden rounded-[14px]">
          {/* Preview only: blurred, non-interactive, hidden from assistive tech. */}
          <div aria-hidden="true" inert className="pointer-events-none select-none">
            <AppWindow label="opennote — pro" />
          </div>
          <ProOverlay showBadge={false} />
        </div>
      </Laptop>
      <div className="mt-8 px-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[18px] font-semibold tracking-[-0.01em] text-lp-ink">Planned for Pro</h3>
          <span className="rounded-full bg-lp-ink px-2 py-0.5 text-[11.5px] font-medium text-white">Not yet available</span>
        </div>
        <p className="mt-1.5 text-[14px] text-lp-muted sm:hidden">
          Unlock more powerful tools to manage your business, organise your work, and stay productive.
        </p>
        <FeatureList items={PRO_FEATURES} planned />
      </div>
    </div>
  )
}

/** Drag / swipe / keyboard state for a two-slide plan carousel. */
export function usePlanSwipe(tabIdPrefix: string) {
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
    document.getElementById(`${tabIdPrefix}-${PLANS[next].key}`)?.focus()
  }

  const transition = dragging || reduced ? 'none' : 'transform 350ms cubic-bezier(0.22, 1, 0.36, 1)'

  const trackStyle = { transform: `translateX(calc(${-index * 100}% + ${dragPx}px))`, transition }
  const viewportProps = {
    ref: viewportRef,
    style: { touchAction: 'pan-y' } as const,
    'aria-roledescription': 'carousel',
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture: (e: { preventDefault(): void; stopPropagation(): void }) => {
      if (suppressClick.current) { e.preventDefault(); e.stopPropagation(); suppressClick.current = false }
    },
    onDragStart: (e: { preventDefault(): void }) => e.preventDefault(),
  }
  return { index, go, dragging, onKeyDown, trackStyle, viewportProps }
}

export function PlanSwipe() {
  const { index, go, dragging, trackStyle, viewportProps } = usePlanSwipe('plan-tab')

  return (
    <Section id="plans">
      <Reveal>
        <div className="mx-auto max-w-[640px] text-center">
          <h2 className="text-[32px] font-semibold tracking-[-0.03em] text-lp-ink sm:text-[44px]">Explore OpenNote</h2>
          <p className="mt-3 text-[17px] text-lp-body">One workspace. More possibilities.</p>
        </div>
      </Reveal>

      <Reveal>
        <div className="relative mt-8">
          <div
            {...viewportProps}
            className={cn('overflow-hidden rounded-[22px] select-none', dragging ? 'cursor-grabbing' : 'cursor-grab')}
          >
            <div
              className="flex"
              style={trackStyle}
            >
              {PLANS.map((plan, i) => (
                <div
                  key={plan.key}
                  id={`plan-panel-${plan.key}`}
                  aria-label={plan.title}
                  aria-hidden={index !== i}
                  inert={index !== i}
                  className="w-full shrink-0 px-1 py-3 sm:px-4 sm:py-4"
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
          Swipe, drag or use the arrows. Pro features are planned and not yet available.
        </p>
      </Reveal>
    </Section>
  )
}
