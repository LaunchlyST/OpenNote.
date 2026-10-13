import type { ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FolderOpen,
  GripVertical,
  Pin,
  Plus,
  Search,
  Settings,
  StickyNote,
  Sun,
} from 'lucide-react'
import { COLORS } from '../../../lib/colors'
import type { EventColorId } from '../../../lib/colors'
import { cn } from '../../../lib/id'
import {
  DEMO_CALENDARS,
  DEMO_DAY_NUMBERS,
  DEMO_EVENTS,
  DEMO_NOTES,
  DEMO_WEEK_TITLE,
  DEMO_WEEKDAYS,
  demoClock,
} from '../../demo'

/**
 * Read-only miniatures of the real OpenNote interface.
 *
 * Every colour, radius and control here is copied from the live components in
 * `src/components/` so the marketing page shows the actual product rather than
 * a stylised invention. Nothing in this file reads or writes user data.
 */

const HAIRLINE = '#eceef2'

/* ------------------------------------------------------------------ */
/* Top bar                                                             */
/* ------------------------------------------------------------------ */

export type MockView = 'day' | 'week' | 'month'

const VIEW_TABS: Array<{ value: MockView; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Full Week' },
  { value: 'month', label: 'Month' },
]

export function MockTopBar({
  view,
  activeDateLabel,
  onViewChange,
  className,
}: {
  view: MockView
  activeDateLabel: string
  /** Omitted in the static hero mockup. */
  onViewChange?: (view: MockView) => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex h-10 shrink-0 items-center gap-1.5 border-b bg-white px-2.5',
        className,
      )}
      style={{ borderColor: HAIRLINE }}
    >
      <span className="flex items-center gap-1.5 pr-1.5">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-[7px] bg-[#bef264] text-[#33400f]">
          <StickyNote className="h-3 w-3" strokeWidth={2.4} />
        </span>
        <span className="text-[11.5px] font-semibold tracking-[-0.015em] text-[#1f2330]">
          OpenNote
        </span>
      </span>

      <span className="ml-1 flex items-center gap-0.5">
        <MockIcon><ChevronLeft className="h-3 w-3" /></MockIcon>
        <MockIcon><ChevronRight className="h-3 w-3" /></MockIcon>
        <span className="ml-1 rounded-md border border-[#e4e6ec] bg-white px-2 py-[3px] text-[9.5px] font-medium text-[#3d4354]">
          Today
        </span>
      </span>

      <span className="hidden min-w-0 flex-1 truncate pl-1.5 text-[10.5px] font-semibold tracking-[-0.01em] text-[#1f2330] md:block">
        {activeDateLabel}
      </span>

      <span className="ml-auto flex items-center gap-1">
        <span className="flex rounded-[9px] bg-[#f1f2f5] p-[2px] ring-1 ring-black/[0.03]">
          {VIEW_TABS.map((tab) => {
            const selected = view === tab.value
            const content = (
              <span
                className={cn(
                  'block rounded-[7px] px-2 py-[3px] text-[9.5px] font-medium transition-colors',
                  selected
                    ? 'bg-white text-[#1f2330] shadow-[0_1px_3px_rgba(16,24,40,0.12)]'
                    : 'text-[#6b7183]',
                )}
              >
                {tab.label}
              </span>
            )
            // Static mocks render plain spans; the interactive preview wires buttons.
            return onViewChange ? (
              <button
                key={tab.value}
                type="button"
                onClick={() => onViewChange(tab.value)}
                aria-pressed={selected}
                className="rounded-[7px] transition-transform duration-150 active:scale-95"
              >
                {content}
              </button>
            ) : (
              <span key={tab.value}>{content}</span>
            )
          })}
        </span>
        <MockIcon><Search className="h-3 w-3" /></MockIcon>
        <MockIcon><Settings className="h-3 w-3" /></MockIcon>
      </span>
    </div>
  )
}

function MockIcon({ children }: { children: ReactNode }) {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-md text-[#565d70]">
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Mini month calendar                                                 */
/* ------------------------------------------------------------------ */

/** Leading blanks so the 5–11 week lines up under M T W T F S S. */
const MINI_BLANKS = 4
const MINI_ROWS = [28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2]

export function MockMiniCalendar({
  className,
  showCurrent = true,
}: {
  className?: string
  /** The lime "today" pill from the real mini calendar. */
  showCurrent?: boolean
}) {
  return (
    <div className={cn('border-b px-2.5 pt-2.5 pb-3', className)} style={{ borderColor: HAIRLINE }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10.5px] font-semibold tracking-[-0.01em] text-[#1f2330]">
          October <span className="font-normal text-[#8b90a0]">2026</span>
        </span>
        <span className="flex items-center gap-0.5 text-[#8b90a0]">
          <ChevronLeft className="h-2.5 w-2.5" />
          <ChevronRight className="h-2.5 w-2.5" />
        </span>
      </div>

      <div className="mb-0.5 grid grid-cols-7">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span
            key={i}
            className="grid h-3.5 place-items-center text-[7px] font-semibold tracking-[0.04em] text-[#a5aab8] uppercase"
          >
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-px">
        {Array.from({ length: MINI_BLANKS }).map((_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {MINI_ROWS.map((day, i) => {
          const inMonth = i < 14 || (i >= 14 && i < 31) || i === 31
          const isDemoWeek = DEMO_DAY_NUMBERS.includes(day)
          const isToday = showCurrent && day === 8
          return (
            <span key={day} className="relative grid h-[17px] place-items-center">
              <span
                className={cn(
                  'relative grid h-[15px] w-[15px] place-items-center rounded-full text-[7.5px] tabular-nums',
                  isToday
                    ? 'bg-[#bef264] font-semibold text-[#33400f] ring-1 ring-inset ring-[#a3d922]/60'
                    : inMonth
                      ? 'font-medium text-[#3d4354]'
                      : 'font-medium text-[#ccd0d9]',
                )}
              >
                {day}
                {isDemoWeek && !isToday && (
                  <span
                    className={cn(
                      'absolute bottom-[0.5px] h-[2px] w-[2px] rounded-full',
                      inMonth ? 'bg-[#a3d922]' : 'bg-[#d4d8e0]',
                    )}
                  />
                )}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

function SidebarRow({
  icon,
  label,
  active,
  dot,
}: {
  icon: ReactNode
  label: string
  active?: boolean
  dot?: string
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 rounded-md px-1.5 py-[3px] text-[9.5px] font-medium',
        active
          ? 'bg-white text-[#1f2330] shadow-[0_1px_2px_rgba(16,24,40,0.07)] ring-1 ring-black/[0.04]'
          : 'text-[#6b7183]',
      )}
    >
      <span className={cn('shrink-0', active ? 'text-[#3f4a14]' : 'text-[#a5aab8]')}>
        {icon}
      </span>
      <span className="truncate">{label}</span>
      {dot && (
        <span
          className="ml-auto h-[4px] w-[4px] shrink-0 rounded-full"
          style={{ background: dot }}
        />
      )}
    </span>
  )
}

export function MockSidebar({ view, className }: { view: MockView; className?: string }) {
  const block = DEMO_EVENTS.filter((e) => e.day === 2).slice(0, 2)

  return (
    <aside
      className={cn('flex h-full w-[172px] shrink-0 flex-col border-r bg-[#fafbfc]', className)}
      style={{ borderColor: HAIRLINE }}
    >
      <MockMiniCalendar />

      <div className="min-h-0 flex-1 overflow-hidden px-2 pb-2">
        <div className="pt-2">
          <p className="mb-1 px-1.5 text-[7px] font-semibold tracking-[0.09em] text-[#a5aab8] uppercase">
            Menu
          </p>
          <div className="space-y-px">
            <SidebarRow
              icon={<CalendarDays className="h-2.5 w-2.5" />}
              label="Calendar"
              active={view !== 'month'}
            />
            <SidebarRow icon={<StickyNote className="h-2.5 w-2.5" />} label="Notes" />
            <SidebarRow icon={<Sun className="h-2.5 w-2.5" />} label="Today" />
          </div>
        </div>

        <div className="my-2 h-px" style={{ background: HAIRLINE }} />

        <div className="flex items-center justify-between px-1.5">
          <p className="text-[7px] font-semibold tracking-[0.09em] text-[#a5aab8] uppercase">
            My Calendars
          </p>
          <Plus className="h-2.5 w-2.5 text-[#a5aab8]" strokeWidth={2.6} />
        </div>
        <div className="mt-1 space-y-px">
          {DEMO_CALENDARS.map((cal) => (
            <span key={cal.name} className="flex items-center gap-1.5 px-1.5 py-[2px]">
              <span
                className="grid h-[9px] w-[9px] shrink-0 place-items-center rounded-[3px]"
                style={{ background: COLORS[cal.color].dot }}
              >
                <Check className="h-[6px] w-[6px] text-white" strokeWidth={4} />
              </span>
              <span className="truncate text-[9.5px] text-[#1f2330]">{cal.name}</span>
            </span>
          ))}
        </div>

        <div className="my-2 h-px" style={{ background: HAIRLINE }} />

        <div className="flex items-center gap-1 px-1.5 text-[7px] font-semibold tracking-[0.09em] text-[#a5aab8] uppercase">
          <ChevronDown className="h-2 w-2" strokeWidth={3} />
          10:00 – 12:00
        </div>
        <div className="mt-1 space-y-px">
          {block.map((e) => (
            <span key={e.title} className="flex items-start gap-1.5 rounded-md px-1.5 py-1">
              <span
                className="mt-[3px] h-[4px] w-[4px] shrink-0 rounded-full"
                style={{ background: COLORS[e.color].dot }}
              />
              <span className="min-w-0">
                <span className="block truncate text-[9px] font-medium leading-tight text-[#1f2330]">
                  {e.title}
                </span>
                <span className="block text-[7.5px] leading-tight text-[#8b90a0]">
                  {demoClock(e.start)} – {demoClock(e.start + e.duration)}
                </span>
              </span>
            </span>
          ))}
        </div>

        <div className="my-2 h-px" style={{ background: HAIRLINE }} />
        <div className="flex items-center gap-1 px-1.5 text-[7px] font-semibold tracking-[0.09em] text-[#a5aab8] uppercase">
          <ChevronDown className="h-2 w-2" strokeWidth={3} />
          Upcoming
        </div>
        <p className="px-1.5 py-1 text-[7.5px] text-[#a5aab8]">Coming Soon</p>
      </div>

      <div className="shrink-0 border-t px-2 py-2" style={{ borderColor: HAIRLINE }}>
        <span className="flex items-center gap-1.5 rounded-lg border bg-white px-1.5 py-1" style={{ borderColor: '#e4e6ec' }}>
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-lp-lime text-[6.5px] font-bold text-[#3f4a14]">
            A
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[8px] font-semibold leading-tight text-[#1f2330]">
              Sign In / Sign Up
            </span>
            <span className="block truncate text-[7px] leading-tight text-[#a5aab8]">
              Save your planner to an account
            </span>
          </span>
        </span>
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Notes rail                                                          */
/* ------------------------------------------------------------------ */

export function MockNotes({
  className,
  count = 4,
  notes = DEMO_NOTES,
}: {
  className?: string
  count?: number
  notes?: typeof DEMO_NOTES
}) {
  return (
    <aside
      className={cn('flex h-full w-[196px] shrink-0 flex-col border-l bg-[#fdfefb]', className)}
      style={{ borderColor: HAIRLINE }}
    >
      <div
        className="flex items-center justify-between border-b bg-white px-2.5 py-2"
        style={{ borderColor: HAIRLINE }}
      >
        <span className="flex items-center gap-1.5">
          <FolderOpen className="h-3 w-3 text-[#d8b31a]" strokeWidth={2.2} />
          <span className="text-[10px] font-semibold tracking-[-0.01em] text-[#1f2330]">Notes</span>
          <span className="rounded-full bg-[#f2f3f6] px-1 py-px text-[7px] font-semibold text-[#6b7183]">
            {count}
          </span>
        </span>
        <span className="flex items-center gap-0.5 rounded-md bg-[#bef264] px-1.5 py-[2px] text-[8px] font-semibold text-[#3f4a14]">
          <Plus className="h-2 w-2" strokeWidth={3} />
          New
        </span>
      </div>

      <div className="border-b bg-white px-2.5 py-1.5" style={{ borderColor: HAIRLINE }}>
        <span className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[#dfe2e8] py-[3px] text-[8px] font-medium text-[#6b7183]">
          <Clock className="h-2.5 w-2.5" />
          Pin note to Today · 2
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden p-2">
        {notes.map((note) => (
          <div
            key={note.title}
            className={cn(
              'relative rounded-xl border border-[#f2e79c] bg-[#fdf6ab] p-2 shadow-[0_1px_3px_rgba(176,146,20,0.12)]',
              note.tilt,
            )}
          >
            <span className="flex items-start gap-1">
              <GripVertical className="mt-[1px] h-2 w-2 shrink-0 text-[#cdbd50]" />
              <span className="min-w-0 flex-1 truncate text-[9px] font-semibold leading-snug text-[#6b5b12]">
                {note.title}
              </span>
            </span>
            <span className="mt-1 block space-y-px">
              {note.body.map((line) => (
                <span
                  key={line}
                  className="block truncate text-[8px] leading-[1.45] text-[#7d6c1c]"
                >
                  {line}
                </span>
              ))}
            </span>
            <span className="mt-1.5 flex items-center gap-1">
              <span className="flex items-center gap-0.5 rounded bg-[#f6ea92] px-1 py-px text-[7px] font-semibold text-[#7a6812]">
                <Pin className="h-1.5 w-1.5" />
                {note.pinned ?? 'Pin to day'}
              </span>
              <span className="ml-auto text-[6.5px] text-[#cbbb55]">drag to reorder</span>
            </span>
          </div>
        ))}
      </div>
    </aside>
  )
}

/* ------------------------------------------------------------------ */
/* Event blocks                                                        */
/* ------------------------------------------------------------------ */

function EventBlock({
  title,
  start,
  duration,
  color,
  pxPerMinute,
  dense,
  className,
  style,
}: {
  title: string
  start: number
  duration: number
  color: EventColorId
  pxPerMinute: number
  dense?: boolean
  className?: string
  style?: React.CSSProperties
}) {
  const c = COLORS[color]
  return (
    <span
      className={cn(
        'absolute overflow-hidden rounded-[5px] border text-left leading-tight',
        dense ? 'px-1 py-[2px]' : 'px-1.5 py-[3px]',
        className,
      )}
      style={{
        top: start * pxPerMinute,
        height: Math.max(duration * pxPerMinute - 2, dense ? 12 : 18),
        background: c.bg,
        borderColor: c.border,
        color: c.text,
        ...style,
      }}
    >
      <span className={cn('block truncate font-semibold', dense ? 'text-[7px]' : 'text-[8.5px]')}>
        {title}
      </span>
      <span className={cn('block truncate opacity-70', dense ? 'text-[6px]' : 'text-[7px]')}>
        {demoClock(start)} – {demoClock(start + duration)}
      </span>
    </span>
  )
}

/* ------------------------------------------------------------------ */
/* Week timeline                                                       */
/* ------------------------------------------------------------------ */

export const GRID_START = 8 * 60
export const GRID_END = 21 * 60
export const HOUR_H = 26

/** One event can span multiple day columns when it crosses midnight. */
function eventsOnDay(day: number) {
  return DEMO_EVENTS.filter((e) => e.day === day)
}

export function MockWeekTimeline({
  pxPerMinute = HOUR_H / 60,
  hours = true,
  dense = false,
}: {
  pxPerMinute?: number
  hours?: boolean
  dense?: boolean
}) {
  const hourList = Array.from(
    { length: (GRID_END - GRID_START) / 60 + 1 },
    (_, i) => GRID_START / 60 + i,
  )
  const gridHeight = (GRID_END - GRID_START) * pxPerMinute

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      {/* Day headers */}
      <div
        className="grid shrink-0 border-b"
        style={{
          gridTemplateColumns: hours ? '34px repeat(7, 1fr)' : 'repeat(7, 1fr)',
          borderColor: HAIRLINE,
        }}
      >
        <span />
        {DEMO_WEEKDAYS.map((d, i) => {
          const isToday = i === 3
          return (
            <span
              key={d}
              className="flex flex-col items-center gap-0.5 border-l py-1.5"
              style={{ borderColor: HAIRLINE }}
            >
              <span className="text-[7px] font-semibold tracking-[0.06em] text-[#8b90a0] uppercase">
                {d}
              </span>
              <span
                className={cn(
                  'grid h-[18px] w-[18px] place-items-center rounded-full text-[8.5px] font-semibold tabular-nums',
                  isToday
                    ? 'bg-[#bef264] text-[#33400f] ring-1 ring-inset ring-[#a3d922]/60'
                    : 'text-[#1f2330]',
                )}
              >
                {DEMO_DAY_NUMBERS[i]}
              </span>
            </span>
          )
        })}
      </div>

      {/* Body */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="absolute inset-0 grid"
          style={{
            gridTemplateColumns: hours
              ? '34px repeat(7, 1fr)'
              : 'repeat(7, 1fr)',
          }}
        >
          {/* Hour gutter */}
          <span className="relative">
            {hourList.map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[6.5px] tabular-nums text-[#a5aab8]"
                style={{ top: (h * 60 - GRID_START) * pxPerMinute }}
              >
                {`${h}`.padStart(2, '0')}:00
              </span>
            ))}
          </span>

          {/* Day columns */}
          {DEMO_WEEKDAYS.map((_, day) => (
            <span key={day} className="relative block border-l" style={{ borderColor: HAIRLINE }}>
              {hourList.map((h) => (
                <span
                  key={h}
                  className="absolute inset-x-0 border-t"
                  style={{ top: (h * 60 - GRID_START) * pxPerMinute, borderColor: '#f0f1f4' }}
                />
              ))}
              <span className="absolute inset-0 block">
                {eventsOnDay(day).map((e) => (
                  <EventBlock
                    key={e.title}
                    title={e.title}
                    start={e.start - GRID_START}
                    duration={e.duration}
                    color={e.color}
                    pxPerMinute={pxPerMinute}
                    dense={dense}
                    className="left-[3px] right-[3px]"
                  />
                ))}
              </span>
            </span>
          ))}
        </div>
        <span className="sr-only">{`${gridHeight}px demo grid`}</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Day timeline                                                        */
/* ------------------------------------------------------------------ */

export function MockDayTimeline({
  dayIndex = 3,
  dateLabel,
  pxPerMinute = HOUR_H / 60,
  dense = false,
}: {
  dayIndex?: number
  dateLabel: string
  pxPerMinute?: number
  dense?: boolean
}) {
  const hourList = Array.from(
    { length: (GRID_END - GRID_START) / 60 + 1 },
    (_, i) => GRID_START / 60 + i,
  )
  const events = DEMO_EVENTS.filter((e) => e.day === dayIndex)
  // "Now" marker sits mid-morning, as it would on a live calendar.
  const nowMinutes = 10 * 60 + 40

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: '38px 1fr', borderColor: HAIRLINE }}
      >
        <span />
        <span className="flex flex-col items-center gap-0.5 border-l py-1.5" style={{ borderColor: HAIRLINE }}>
          <span className="text-[7px] font-semibold tracking-[0.06em] text-[#8b90a0] uppercase">
            {DEMO_WEEKDAYS[dayIndex]}
          </span>
          <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-[#bef264] text-[8.5px] font-semibold text-[#33400f] ring-1 ring-inset ring-[#a3d922]/60">
            {DEMO_DAY_NUMBERS[dayIndex]}
          </span>
        </span>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <span className="relative block h-full" style={{ display: 'grid', gridTemplateColumns: '38px 1fr' }}>
          <span className="relative">
            {hourList.map((h) => (
              <span
                key={h}
                className="absolute right-1.5 -translate-y-1/2 text-[6.5px] tabular-nums text-[#a5aab8]"
                style={{ top: (h * 60 - GRID_START) * pxPerMinute }}
              >
                {`${h}`.padStart(2, '0')}:00
              </span>
            ))}
          </span>

          <span className="relative block border-l" style={{ borderColor: HAIRLINE }}>
            {hourList.map((h) => (
              <span
                key={h}
                className="absolute inset-x-0 border-t"
                style={{ top: (h * 60 - GRID_START) * pxPerMinute, borderColor: '#f0f1f4' }}
              />
            ))}

            {events.map((e) => (
              <EventBlock
                key={e.title}
                title={e.title}
                start={e.start - GRID_START}
                duration={e.duration}
                color={e.color}
                pxPerMinute={pxPerMinute}
                dense={dense}
                className="left-1.5 right-3"
              />
            ))}

            {/* Current-time rule */}
            <span
              className="absolute inset-x-0 flex items-center"
              style={{ top: (nowMinutes - GRID_START) * pxPerMinute }}
            >
              <span className="-ml-[3px] h-[5px] w-[5px] rounded-full bg-[#f472b6]" />
              <span className="h-px flex-1 bg-[#f9a8c8]" />
            </span>
          </span>
        </span>
      </div>

      <span className="sr-only">{dateLabel}</span>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Month grid                                                          */
/* ------------------------------------------------------------------ */

const MONTH_LABEL = 'October 2026'
const MONTH_DAYS = [
  28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 1, 2,
]

/** Date → the chips shown in the month cells, mirroring `seedEvents`. */
const MONTH_CHIPS: Record<number, Array<{ label: string; color: EventColorId }>> = {
  5: [{ label: 'Morning planning', color: 'lime' }, { label: 'Design review', color: 'lime' }],
  6: [{ label: 'Team meeting', color: 'lime' }],
  7: [{ label: 'Morning yoga', color: 'orange' }],
  8: [{ label: 'Study session', color: 'purple' }, { label: 'Marketing sync', color: 'lime' }],
  9: [{ label: 'Product review', color: 'lime' }, { label: 'Lunch & learn', color: 'pink' }],
  10: [{ label: 'Personal appointment', color: 'orange' }],
  11: [{ label: 'Weekly review', color: 'orange' }, { label: 'Read a chapter', color: 'purple' }],
  14: [{ label: 'Team sync', color: 'lime' }],
  16: [{ label: 'Dentist', color: 'blue' }],
  21: [{ label: 'Roadmap review', color: 'purple' }],
}

export function MockMonthGrid({ dense = false }: { dense?: boolean }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div
        className="grid shrink-0 border-b"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', borderColor: HAIRLINE }}
      >
        {DEMO_WEEKDAYS.map((d) => (
          <span
            key={d}
            className="py-1.5 text-center text-[7px] font-semibold tracking-[0.06em] text-[#8b90a0] uppercase"
          >
            {d}
          </span>
        ))}
      </div>

      <div
        className="grid min-h-0 flex-1"
        style={{ gridTemplateColumns: 'repeat(7, 1fr)', gridAutoRows: 'minmax(0, 1fr)' }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <span key={`blank-${i}`} className="border-r border-t" style={{ borderColor: '#f0f1f4' }} />
        ))}
        {MONTH_DAYS.map((day) => {
          const index = MONTH_DAYS.indexOf(day)
          const inMonth = index >= 3
          const isToday = day === 8
          const chips = (MONTH_CHIPS[day] ?? []).slice(0, dense ? 1 : 2)
          return (
            <span
              key={`${day}-${index}`}
              className="min-w-0 overflow-hidden border-r border-t px-1 py-1"
              style={{ borderColor: '#f0f1f4' }}
            >
              <span
                className={cn(
                  'mb-0.5 grid h-[13px] w-[13px] place-items-center rounded-full text-[7.5px] font-semibold tabular-nums',
                  isToday
                    ? 'bg-[#bef264] text-[#33400f]'
                    : inMonth
                      ? 'text-[#3d4354]'
                      : 'text-[#ccd0d9]',
                )}
              >
                {day}
              </span>
              <span className="block space-y-px">
                {chips.map((chip) => (
                  <span
                    key={chip.label}
                    className="flex items-center gap-1 truncate rounded-[3px] px-1 py-px text-[6.5px] font-medium"
                    style={{
                      background: COLORS[chip.color].bg,
                      color: COLORS[chip.color].text,
                    }}
                  >
                    <span
                      className="h-[3px] w-[3px] shrink-0 rounded-full"
                      style={{ background: COLORS[chip.color].dot }}
                    />
                    <span className="truncate">{chip.label}</span>
                  </span>
                ))}
              </span>
            </span>
          )
        })}
      </div>

      <span className="sr-only">{MONTH_LABEL}</span>
    </div>
  )
}

export { DEMO_WEEK_TITLE }