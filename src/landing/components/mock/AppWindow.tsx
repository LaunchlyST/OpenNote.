import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/id'
import {
  MockDayTimeline,
  MockMiniCalendar,
  MockMonthGrid,
  MockTopBar,
  MockWeekTimeline,
} from './AppChrome'
import type { MockView } from './AppChrome'
import { DEMO_WEEK_TITLE } from '../../demo'

/**
 * The showcase window used in the hero and the product preview.
 *
 * It renders at a fixed natural width and is scaled down to fit its column,
 * which keeps the proportions identical to the real app at every breakpoint
 * and makes horizontal overflow impossible.
 */

const BASE_W = 1280
const BASE_H = 800
const CHROME_H = 34

function useFitScale(baseWidth: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const width = el.clientWidth
      if (width > 0) setScale(Math.min(1.25, width / baseWidth))
    }

    measure()
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [baseWidth])

  return { ref, scale }
}

/** Which screen the showcase window is showing. */
export type MockScreen = 'calendar' | 'projects'

/**
 * Real screenshots of the app (taken by scripts/capture-landing.cjs from the
 * live Free workspace), so the landing page shows exactly what users get.
 * Re-run that script after any UI change to refresh them.
 */
const SHOTS: Record<MockView | 'projects', string> = {
  week: '/landing/app-week.png',
  day: '/landing/app-day.png',
  month: '/landing/app-month.png',
  projects: '/landing/app-projects.png',
}

function AppBody({
  view,
  screen,
}: {
  view: MockView
  onViewChange?: (view: MockView) => void
  dateLabel: string
  screen: MockScreen
}) {
  const key = screen === 'projects' ? 'projects' : view
  return (
    <img
      src={SHOTS[key]}
      alt={key === 'projects' ? 'OpenNote My Projects page' : `OpenNote calendar, ${key === 'week' ? 'Full Week' : key === 'day' ? 'Day' : 'Month'} view`}
      width={1920}
      height={1200}
      draggable={false}
      className="block h-full w-full select-none object-cover object-top"
    />
  )
}

/* ------------------------------------------------------------------ */
/* Desktop showcase — scaled to fit                                   */
/* ------------------------------------------------------------------ */

export function AppWindow({
  view = 'week',
  onViewChange,
  dateLabel = `${DEMO_WEEK_TITLE}, 2026`,
  label = 'OpenNote',
  screen = 'calendar',
  className,
}: {
  view?: MockView
  onViewChange?: (view: MockView) => void
  dateLabel?: string
  label?: string
  screen?: MockScreen
  className?: string
}) {
  const { ref, scale } = useFitScale(BASE_W)
  const totalH = BASE_H + CHROME_H

  return (
    <div ref={ref} className={cn('w-full', className)} style={{ height: totalH * scale }}>
      <div
        style={{
          width: BASE_W,
          height: totalH,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
        className="overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-[0_60px_120px_-50px_rgba(40,30,10,0.45),0_24px_48px_-24px_rgba(40,30,10,0.25)]"
      >
        <div className="flex h-[34px] items-center gap-1.5 border-b border-[#ecebe6] bg-[#f8f7f3] px-3.5">
          <span className="h-[9px] w-[9px] rounded-full bg-[#dedcd4]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#dedcd4]" />
          <span className="h-[9px] w-[9px] rounded-full bg-[#dedcd4]" />
          <span className="mx-auto truncate rounded-md bg-[#efede7] px-3 py-0.5 font-mono text-[10px] text-[#8d8a80]">{label}</span>
          <span className="w-[38px]" aria-hidden="true" />
        </div>
        <div style={{ height: BASE_H }}>
          <AppBody view={view} onViewChange={onViewChange} dateLabel={dateLabel} screen={screen} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Mobile showcase — a real layout, not a shrunken desktop one         */
/* ------------------------------------------------------------------ */

export function AppWindowMobile({
  view = 'week',
  className,
}: {
  view?: MockView
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-[0_36px_70px_-30px_rgba(40,30,10,0.45)]',
        className,
      )}
    >
      <div className="flex h-7 items-center justify-center border-b border-[#ecebe6] bg-[#f8f7f3]">
        <span className="h-1 w-12 rounded-full bg-[#dedcd4]" />
      </div>

      <MockTopBar view={view} activeDateLabel={DEMO_WEEK_TITLE} />

      <div className="flex items-center gap-1.5 border-b border-[#eceef2] bg-white px-2.5 py-2">
        <span className="grid h-6 w-6 place-items-center rounded-lg bg-[#bef264] text-[#33400f]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
          </svg>
        </span>
        <span className="text-[11px] font-semibold text-[#1f2330]">October 2026</span>
        <span className="ml-auto rounded-lg border border-[#e4e6ec] px-2 py-1 text-[9.5px] font-medium text-[#3d4354]">
          Today
        </span>
      </div>

      <MockMiniCalendar className="border-b-0 px-3" />

      <div className="flex h-[248px] flex-col border-t border-[#eceef2]">
        {view === 'month' ? (
          <MockMonthGrid dense />
        ) : view === 'day' ? (
          <MockDayTimeline dateLabel={DEMO_WEEK_TITLE} dense />
        ) : (
          <MockWeekTimeline dense />
        )}
      </div>
    </div>
  )
}

/**
 * Responsive showcase: the scaled window from `sm` up, a purpose-built mobile
 * layout below it, so small screens get a readable product story rather than a
 * tiny screenshot of a desktop one.
 */
export function ResponsiveAppWindow({
  view = 'week',
  onViewChange,
  dateLabel,
  label = 'OpenNote',
  screen = 'calendar',
  className,
}: {
  view?: MockView
  onViewChange?: (view: MockView) => void
  dateLabel?: string
  label?: string
  screen?: MockScreen
  className?: string
}) {
  // OpenNote is desktop-only, so every screen size shows the desktop app,
  // scaled to fit.
  return (
    <div className={className}>
      <AppWindow view={view} onViewChange={onViewChange} dateLabel={dateLabel} label={label} screen={screen} />
    </div>
  )
}