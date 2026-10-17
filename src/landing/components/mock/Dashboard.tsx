import type { ReactNode } from 'react'
import {
  CalendarDays,
  ArrowLeft,
  Check,
  Cloud,
  ZoomIn,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  Settings,
  Sun,
} from 'lucide-react'
import { COLORS } from '../../../lib/colors'
import { cn } from '../../../lib/id'
import { AppIcon } from '../primitives'
import { DEMO_CALENDARS, DEMO_EVENTS, DEMO_WEEKDAYS, demoClock } from '../../demo'
import { PREVIEW_TODAY as T } from '../../today'
import type { MockView } from './AppChrome'

/**
 * A read-only, full-size copy of the current dashboard (`Sidebar`, `TopBar`,
 * `TimeGrid`, `MonthView`), drawn with the sample week. Sizes, colours and
 * radii are taken from those components so the landing page shows exactly
 * what a signed-in user sees. It reads and writes no user data.
 */

const LINE = '#ececea'
const DAY_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
/** The visitor's real weekday (Monday = 0) is "today" in the sample week. */
const TODAY = T.todayIndex
const HOUR_H = 56
const FIRST_HOUR = 8
const LAST_HOUR = 21
const NOW_MIN = 10 * 60 + 40

const VIEWS: Array<{ value: MockView; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Full Week' },
  { value: 'month', label: 'Month' },
]

const HEADINGS: Record<MockView, [string, string]> = {
  day: [T.dayTitle, T.year],
  week: [T.weekTitle, T.year],
  month: [T.monthName, T.year],
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

/** Monday-first grid of the current month, as the real mini calendar draws it. */
const MINI_DAYS = T.miniCells
const WEEK_KEYS = new Set(T.weekKeys)

function MiniCalendar() {
  return (
    <div className="rounded-2xl border bg-white px-3 pt-3.5 pb-3 shadow-[0_1px_3px_rgba(0,0,0,0.05)]" style={{ borderColor: LINE }}>
      <div className="mb-3 flex items-center justify-between px-0.5">
        <span className="text-[13px] font-semibold tracking-[-0.01em] text-[#191919]">
          {T.monthName} <span className="font-normal text-[#8f8e8a]">{T.year}</span>
        </span>
        <span className="flex items-center gap-2 text-[#8f8e8a]">
          <ChevronLeft className="h-4 w-4" />
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
      <div className="mb-1 grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="grid h-6 place-items-center text-[10px] font-semibold tracking-[0.04em] text-[#a3a29e] uppercase">
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {MINI_DAYS.map((d, i) => {
          const isToday = d.key === T.todayKey
          const hasEvents = WEEK_KEYS.has(d.key)
          return (
            <span key={i} className="grid h-8 place-items-center">
              <span
                className={cn(
                  'relative grid h-7 w-7 place-items-center rounded-full text-[12px] tabular-nums',
                  isToday
                    ? 'bg-[#f1f9dd] font-semibold text-[#191919] ring-2 ring-[#c5ea7a]'
                    : d.inMonth
                      ? 'font-medium text-[#37352f]'
                      : 'font-medium text-[#ccd0d9]',
                )}
              >
                {d.n}
                {hasEvents && <span className="absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-[#a3d922]" />}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

function NavItem({ icon, label, active }: { icon: ReactNode; label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium',
        active
          ? 'bg-white text-[#191919] shadow-[0_1px_2px_rgba(16,24,40,0.07)] ring-1 ring-black/[0.04]'
          : 'text-[#6b6a66]',
      )}
    >
      <span className={active ? 'text-[#191919]' : 'text-[#a3a29e]'}>{icon}</span>
      {label}
    </span>
  )
}

function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-1 flex items-center justify-between px-2 pt-1">
      <span className="flex items-center gap-1.5 text-[10.5px] font-semibold tracking-[0.08em] text-[#a3a29e] uppercase">
        <ChevronDown className="h-3 w-3" strokeWidth={2.6} />
        {children}
      </span>
      {action}
    </div>
  )
}

function Sidebar() {
  const upNext = DEMO_EVENTS.filter((e) => e.day === TODAY || e.day === TODAY + 1)
    .filter((e) => e.day > TODAY || e.start + e.duration > NOW_MIN)
    .slice(0, 3)
  return (
    <aside className="flex h-full w-[264px] shrink-0 flex-col border-r bg-[#fbfbfa]" style={{ borderColor: LINE }}>
      <div className="flex h-[64px] shrink-0 items-center gap-2.5 px-4">
        <AppIcon day={String(T.dayNumber)} className="h-[30px] w-[30px] text-[30px]" />
        <span className="text-[16px] font-semibold tracking-[-0.02em] text-[#191919]">OpenNote</span>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        <div className="px-3">
          <MiniCalendar />
        </div>
        <div className="px-3 pt-3">
          <span className="flex h-10 w-full items-center justify-center gap-2 rounded-[10px] bg-[#191919] text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.6)]">
            <Plus className="h-4 w-4" strokeWidth={2.4} />
            New event
          </span>
        </div>
        <div className="px-3 pb-3">
          <div className="space-y-0.5 pt-2">
            <NavItem icon={<CalendarDays className="h-[15px] w-[15px]" />} label="Calendar" active />
            <NavItem icon={<Sun className="h-[15px] w-[15px]" />} label="Today" />
            <NavItem icon={<Settings className="h-[15px] w-[15px]" />} label="Settings" />
          </div>

          <div className="my-3 h-px" style={{ background: LINE }} />

          <SectionTitle action={<Plus className="h-3.5 w-3.5 text-[#8f8e8a]" />}>My Calendars</SectionTitle>
          <div className="space-y-0.5">
            {DEMO_CALENDARS.map((c) => (
              <span key={c.name} className="flex items-center gap-2.5 rounded-lg px-2 py-[5px]">
                <span
                  className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[5px]"
                  style={{ background: COLORS[c.color].dot }}
                >
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
                </span>
                <span className="truncate text-[12.5px] text-[#191919]">{c.name}</span>
              </span>
            ))}
          </div>

          <div className="my-3 h-px" style={{ background: LINE }} />

          <SectionTitle>Up next</SectionTitle>
          <div className="space-y-0.5">
            {upNext.map((e) => (
              <span key={e.title} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5">
                <span className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: COLORS[e.color].dot }} />
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] leading-snug font-medium text-[#191919]">{e.title}</span>
                  <span className="block text-[11px] leading-snug text-[#8f8e8a]">
                    {demoClock(e.start)} – {demoClock(e.start + e.duration)}
                  </span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t px-3 py-3" style={{ borderColor: LINE }}>
        <span className="flex w-full items-center gap-2.5 rounded-2xl border border-[#e9e9e7] bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(16,24,40,0.05)]">
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[linear-gradient(145deg,#3a3a37,#141414)] text-[14px] font-semibold text-white">
            A
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-[#191919]">Alex Morgan</span>
            <span className="block truncate text-[10.5px] text-[#8f8e8a]">alex@example.com</span>
          </span>
          <ChevronUp className="h-4 w-4 text-[#8f8e8a]" />
        </span>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

function TopBar({ view, onViewChange }: { view: MockView; onViewChange?: (v: MockView) => void }) {
  const [range, year] = HEADINGS[view]
  const active = Math.max(0, VIEWS.findIndex((v) => v.value === view))
  return (
    <header className="flex h-[64px] shrink-0 items-center gap-3 border-b bg-white px-5" style={{ borderColor: LINE }}>
      {/* Free workspaces live inside a project: the way back sits first. */}
      <span className="flex shrink-0 items-center gap-1.5 text-[12.5px] font-medium text-[#37352f]">
        <ArrowLeft className="h-4 w-4 text-[#6b6a66]" />
        Back to Projects
      </span>
      <Cloud className="h-4 w-4 shrink-0 text-[#a3a29e]" aria-hidden="true" />
      <span className="h-6 w-px shrink-0 bg-[#ececea]" />
      <span className="truncate text-[22px] font-semibold tracking-[-0.03em] text-[#191919]">
        {range}
        <span className="ml-2 font-normal text-[#a3a29e]">{year}</span>
      </span>
      <span className="flex shrink-0 items-center rounded-[10px] border border-[#e3e3e0] bg-white p-[2px] text-[#6b6a66] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <span className="grid h-7 w-7 place-items-center"><ChevronLeft className="h-4 w-4" /></span>
        <span className="px-2.5 text-[12.5px] font-medium text-[#37352f]">Today</span>
        <span className="grid h-7 w-7 place-items-center"><ChevronRight className="h-4 w-4" /></span>
      </span>

      <span className="ml-auto flex shrink-0 items-center gap-1.5">
        <span className="relative grid grid-cols-3 rounded-[10px] bg-[#f1f1ef] p-[3px]">
          <span
            aria-hidden="true"
            className="absolute inset-y-[3px] left-[3px] w-[calc((100%-6px)/3)] rounded-[7px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ transform: `translateX(${active * 100}%)` }}
          />
          {VIEWS.map((v) => {
            const cls = cn(
              'relative z-10 px-4 py-[5px] text-[12.5px] font-medium transition-colors',
              view === v.value ? 'text-[#191919]' : 'text-[#6b6a66]',
            )
            // Static mockups render spans; the interactive preview wires buttons.
            return onViewChange ? (
              <button key={v.value} type="button" aria-pressed={view === v.value} onClick={() => onViewChange(v.value)} className={cls}>
                {v.label}
              </button>
            ) : (
              <span key={v.value} className={cls}>{v.label}</span>
            )
          })}
        </span>
        <span className="grid h-9 w-9 place-items-center text-[#6b6a66]"><Search className="h-4 w-4" /></span>
        <span className="grid h-9 w-9 place-items-center text-[#6b6a66]"><Settings className="h-4 w-4" /></span>
      </span>
    </header>
  )
}

/* ------------------------------------------------------------------ */
/* Time grid (Day and Full Week)                                       */
/* ------------------------------------------------------------------ */

function TimeGrid({ days }: { days: number[] }) {
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i)
  const y = (min: number) => ((min - FIRST_HOUR * 60) / 60) * HOUR_H + 14

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Day cards, as in the live TimeGrid: full weekday, big date, today in black. */}
      <div className="flex shrink-0 items-stretch gap-[7px] border-b px-[10px] pt-[9px] pb-[9px]" style={{ borderColor: LINE }}>
        <span className="grid w-[44px] shrink-0 place-items-center rounded-[10px] border border-[#e3e3e0] text-[#8f8e8a]">
          <span className="flex flex-col items-center leading-none">
            <ZoomIn className="h-3.5 w-3.5" />
            <span className="mt-0.5 text-[8.5px] font-medium">1 h</span>
          </span>
        </span>
        {DAY_LONG.map((d, i) => (
          <span
            key={d}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center rounded-[12px] border py-[7px]',
              i === TODAY ? 'border-[#191919] bg-[#191919] text-white shadow-[0_6px_14px_-6px_rgba(0,0,0,0.5)]' : 'border-[#e6e6e3] bg-white text-[#191919]',
            )}
          >
            {i === TODAY && (
              <span className="absolute -top-[7px] rounded-full bg-[#ef4444] px-1.5 py-px text-[7.5px] font-bold tracking-[0.08em] text-white">
                TODAY
              </span>
            )}
            <span className={cn('text-[10.5px] font-medium', i === TODAY ? 'text-white/80' : 'text-[#6b6a66]')}>{d}</span>
            <span className="text-[18px] leading-tight font-semibold tabular-nums">{T.weekNumbers[i]}</span>
          </span>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="relative flex h-full">
          <div className="relative w-[62px] shrink-0">
            {hours.map((h) => (
              <span
                key={h}
                className="absolute right-3 -translate-y-1/2 text-[10.5px] font-medium tabular-nums text-[#a3a29e]"
                style={{ top: y(h * 60) }}
              >
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          <div className="relative flex min-w-0 flex-1 border-l" style={{ borderColor: LINE }}>
            {hours.map((h) => (
              <span key={h} className="pointer-events-none absolute inset-x-0 border-t border-[#e9e9e7]" style={{ top: y(h * 60) }} />
            ))}
            {days.map((day) => (
              <div
                key={day}
                className="relative flex-1 border-l first:border-l-0"
                style={{ borderColor: LINE, background: day === TODAY ? 'rgba(25,25,25,0.018)' : undefined }}
              >
                {DEMO_EVENTS.filter((e) => e.day === day).map((e) => {
                  const c = COLORS[e.color]
                  const height = Math.max(20, (e.duration / 60) * HOUR_H - 3)
                  return (
                    <div
                      key={e.title}
                      className="absolute overflow-hidden rounded-[8px]"
                      style={{
                        top: y(e.start),
                        height,
                        left: 5,
                        right: 4,
                        background: c.bg,
                        color: c.text,
                        boxShadow: `inset 3px 0 0 ${c.dot}, inset 0 0 0 1px ${c.border}80, 0 1px 2px rgba(0,0,0,0.05)`,
                      }}
                    >
                      <div className="py-[5px] pr-2 pl-[11px]">
                        <div className="truncate text-[11.5px] leading-tight font-semibold tracking-[-0.005em]">{e.title}</div>
                        {height > 34 && (
                          <div className="mt-[1px] truncate text-[10.5px] leading-tight font-medium opacity-75">
                            {demoClock(e.start)} – {demoClock(e.start + e.duration)}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {day === TODAY && (
                  <div className="pointer-events-none absolute inset-x-0 z-30" style={{ top: y(NOW_MIN) }}>
                    <div className="relative border-t-[1.5px] border-[#ff5a5f]">
                      <span className="absolute -top-[4px] -left-[4px] h-2 w-2 rounded-full bg-[#ff5a5f]" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Month                                                               */
/* ------------------------------------------------------------------ */

/** Sample events by date, mirroring the demo week plus a few later ones. */
const MONTH_EVENTS: Record<string, Array<{ time: string; title: string; color: keyof typeof COLORS }>> = {}
for (const e of DEMO_EVENTS) {
  ;(MONTH_EVENTS[T.weekKeys[e.day]] ??= []).push({ time: demoClock(e.start), title: e.title, color: e.color })
}
MONTH_EVENTS[T.keyAfterMonday(9)] = [{ time: '10:00', title: 'Team sync', color: 'lime' }]
MONTH_EVENTS[T.keyAfterMonday(11)] = [{ time: '15:30', title: 'Dentist', color: 'blue' }]
MONTH_EVENTS[T.keyAfterMonday(16)] = [{ time: '11:00', title: 'Roadmap review', color: 'purple' }]

function MonthGrid() {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div className="grid h-9 shrink-0 grid-cols-7 border-b" style={{ borderColor: LINE }}>
        {DEMO_WEEKDAYS.map((d) => (
          <span
            key={d}
            className="grid place-items-center border-l text-[10.5px] font-semibold tracking-[0.07em] text-[#8f8e8a] uppercase first:border-l-0"
            style={{ borderColor: LINE }}
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridAutoRows: 'minmax(0, 1fr)' }}>
        {T.monthCells.map((d, i) => {
          const isToday = d.key === T.todayKey
          const events = d.inMonth ? (MONTH_EVENTS[d.key] ?? []) : []
          return (
            <div
              key={i}
              className={cn('flex min-w-0 flex-col gap-1 overflow-hidden border-b border-l p-1.5 [&:nth-child(7n+1)]:border-l-0', !d.inMonth && 'bg-[#fbfbfc]')}
              style={{ borderColor: LINE }}
            >
              <span
                className={cn(
                  'grid h-6 min-w-6 place-items-center self-start rounded-[9px] px-1.5 text-[12px] font-semibold tabular-nums',
                  isToday
                    ? 'bg-[#191919] text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)]'
                    : d.inMonth
                      ? 'text-[#191919]'
                      : 'text-[#c4c3be]',
                )}
              >
                {d.n}
              </span>
              <div className="flex min-h-0 flex-col gap-[3px] overflow-hidden">
                {events.slice(0, 3).map((ev) => (
                  <span
                    key={ev.title}
                    className="flex items-center gap-1 overflow-hidden rounded-[5px] px-1.5 py-[2px] text-[10.5px] leading-tight font-medium"
                    style={{ background: COLORS[ev.color].bg, color: COLORS[ev.color].text }}
                  >
                    <span className="shrink-0 tabular-nums opacity-70">{ev.time}</span>
                    <span className="truncate">{ev.title}</span>
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Whole dashboard                                                     */
/* ------------------------------------------------------------------ */

export function MockDashboard({ view, onViewChange }: { view: MockView; onViewChange?: (v: MockView) => void }) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-white text-left">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar view={view} onViewChange={onViewChange} />
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
          {view === 'month' ? <MonthGrid /> : view === 'day' ? <TimeGrid days={[TODAY]} /> : <TimeGrid days={[0, 1, 2, 3, 4, 5, 6]} />}
        </main>
      </div>
    </div>
  )
}
