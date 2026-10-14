import { useLayoutEffect, useRef, useState } from 'react'
import { cn } from '../../../lib/id'
import {
  MockDayTimeline,
  MockMiniCalendar,
  MockMonthGrid,
  MockNotes,
  MockSidebar,
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

const BASE_W = 1080
const BASE_H = 592
const CHROME_H = 34

function useFitScale(baseWidth: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const width = el.clientWidth
      if (width > 0) setScale(Math.min(1, width / baseWidth))
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

/** The full three-column OpenNote layout. */
function AppBody({
  view,
  onViewChange,
  dateLabel,
}: {
  view: MockView
  onViewChange?: (view: MockView) => void
  dateLabel: string
}) {
  return (
    <div className="flex h-full w-full flex-col bg-[#f4f5f7]">
      <MockTopBar view={view} activeDateLabel={dateLabel} onViewChange={onViewChange} />
      <div className="flex min-h-0 flex-1 gap-1.5 p-1.5">
        <div className="hidden overflow-hidden rounded-xl border border-[#e9eaee] bg-white md:block">
          <MockSidebar view={view} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e9eaee] bg-white">
          {view === 'month' ? (
            <MockMonthGrid />
          ) : view === 'day' ? (
            <MockDayTimeline dateLabel={dateLabel} />
          ) : (
            <MockWeekTimeline />
          )}
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-[#e9eaee] bg-white xl:block">
          <MockNotes />
        </div>
      </div>
    </div>
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
  className,
}: {
  view?: MockView
  onViewChange?: (view: MockView) => void
  dateLabel?: string
  label?: string
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
          <AppBody view={view} onViewChange={onViewChange} dateLabel={dateLabel} />
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
  className,
}: {
  view?: MockView
  onViewChange?: (view: MockView) => void
  dateLabel?: string
  label?: string
  className?: string
}) {
  return (
    <>
      <div className={cn('hidden sm:block', className)}>
        <AppWindow view={view} onViewChange={onViewChange} dateLabel={dateLabel} label={label} />
      </div>
      <div className={cn('sm:hidden', className)}>
        <AppWindowMobile view={view} />
      </div>
    </>
  )
}