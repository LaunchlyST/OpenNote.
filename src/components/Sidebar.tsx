import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Clock,
  LayoutDashboard,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  StickyNote,
  Trash2,
} from 'lucide-react'
import { useApp } from '../store'
import { useAuth } from '../auth'
import type { Calendar, CalendarEvent } from '../lib/types'
import { COLOR_IDS, colorOf } from '../lib/colors'
import {
  dateKey,
  formatClock,
  isSameDay,
  startOfDay,
} from '../lib/date'
import { BLOCK_MS, blockStartOf, eventsInBlock } from '../lib/block'
import { cn } from '../lib/id'
import { useNow } from '../hooks'
import { MiniCalendar } from './MiniCalendar'
import { AccountCard } from './AccountCard'
import { Avatar } from './Avatar'

interface SidebarProps {
  onToggleNotes?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** Uppercase group heading shown above each navigation cluster. */
function GroupLabel({ children }: { children: string }) {
  return (
    <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">
      {children}
    </p>
  )
}

function NavItem({
  icon,
  label,
  active,
  onClick,
  badge,
  rail,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick?: () => void
  badge?: string
  /** Renders as an icon-only button with a hover tooltip. */
  rail?: boolean
}) {
  const base =
    'group relative flex w-full items-center gap-2.5 rounded-xl text-left text-[13px] transition-all duration-150'

  if (rail) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          base,
          'group/rail justify-center px-0 py-2.5',
          active
            ? 'bg-accent-soft text-accent-text'
            : 'text-ink-soft hover:bg-surface hover:text-ink',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className="pointer-events-none absolute left-[calc(100%+10px)] z-50 hidden whitespace-nowrap rounded-lg bg-charcoal px-2.5 py-1.5 text-[11.5px] font-medium text-white opacity-0 shadow-lg transition-opacity group-hover/rail:block group-hover/rail:opacity-100">
          {label}
        </span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        base,
        'px-3 py-2',
        active
          ? 'bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04]'
          : 'font-medium text-ink-soft hover:bg-white/70 hover:text-ink',
      )}
    >
      {/* Active marker rail */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent-deep transition-all duration-200',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
      <span
        className={cn(
          'shrink-0 transition-colors',
          active ? 'text-accent-text' : 'text-faint group-hover:text-ink-soft',
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {badge && (
        <span className="shrink-0 rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-ink-soft">
          {badge}
        </span>
      )}
    </button>
  )
}

function CalendarRow({ calendar }: { calendar: Calendar }) {
  const { toggleCalendar, updateCalendar, deleteCalendar } = useApp()
  const [editing, setEditing] = useState(false)
  const color = colorOf(calendar.color)

  if (editing) {
    return (
      <div className="animate-rise rounded-xl bg-white p-2 shadow-[0_1px_3px_rgba(16,24,40,0.08)] ring-1 ring-black/[0.04]">
        <input
          autoFocus
          value={calendar.name}
          onChange={(e) => updateCalendar(calendar.id, { name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(false)
          }}
          className="w-full rounded-lg border border-line bg-white px-2 py-1 text-[12px]"
        />
        <div className="mt-2 flex items-center gap-1">
          {COLOR_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-label={colorOf(id).name}
              onClick={() => updateCalendar(calendar.id, { color: id })}
              className={cn(
                'h-4 w-4 rounded-full ring-offset-1 transition hover:scale-110',
                calendar.color === id && 'ring-2 ring-[#9aa0b0]',
              )}
              style={{ background: colorOf(id).dot }}
            />
          ))}
          <span className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Delete calendar"
              onClick={() => deleteCalendar(calendar.id)}
              className="grid h-5 w-5 place-items-center rounded text-ghost transition hover:bg-[#fdf1f1] hover:text-[#c0392b]"
            >
              <Trash2 className="h-3 w-3" />
            </button>
            <button
              type="button"
              aria-label="Done"
              onClick={() => setEditing(false)}
              className="grid h-5 w-5 place-items-center rounded text-ink-soft transition hover:bg-surface"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-center gap-2.5 rounded-lg px-2 py-[5px] transition hover:bg-white/70">
      <button
        type="button"
        aria-label={calendar.visible ? `Hide ${calendar.name}` : `Show ${calendar.name}`}
        onClick={() => toggleCalendar(calendar.id)}
        className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[5px] border transition"
        style={{
          borderColor: color.dot,
          background: calendar.visible ? color.dot : 'transparent',
        }}
      >
        {calendar.visible && (
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
        )}
      </button>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[12.5px]',
          calendar.visible ? 'text-ink' : 'text-faint line-through',
        )}
      >
        {calendar.name}
      </span>
      <button
        type="button"
        aria-label={`Rename ${calendar.name}`}
        onClick={() => setEditing(true)}
        className="grid h-5 w-5 place-items-center rounded text-faint opacity-0 transition hover:bg-white group-hover:opacity-100 focus:opacity-100"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const { calendars, openEdit, settings } = useApp()
  const color = colorOf(calendars.find((c) => c.id === event.calendarId)?.color)
  const start = new Date(event.start)
  const end = new Date(event.end)
  return (
    <button
      type="button"
      onClick={() => openEdit(event)}
      className="group flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white"
    >
      <span
        className="mt-[6px] h-[7px] w-[7px] shrink-0 rounded-full"
        style={{ background: color.dot }}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium leading-snug text-ink">
          {event.title || 'Untitled'}
        </span>
        <span className="block text-[11px] leading-snug text-muted">
          {formatClock(start, settings.hour12)} –{' '}
          {formatClock(end, settings.hour12)}
        </span>
      </span>
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* Sidebar                                                             */
/* ------------------------------------------------------------------ */

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: SidebarProps = {}) {
  const {
    calendars,
    events,
    selectedDate,
    addCalendar,
    toggleCalendar,
    settings,
    section,
    settingsOpen,
    openDashboard,
    openCalendar,
    openSettings,
  } = useApp()
  const { user } = useAuth()
  const now = useNow(30_000)

  const miniRef = useRef<HTMLDivElement | null>(null)

  const [followToday, setFollowToday] = useState(true)
  const [miniOpen, setMiniOpen] = useState(true)
  const [blockOpen, setBlockOpen] = useState(true)
  const prevDayRef = useRef(dateKey(now))

  useEffect(() => {
    const k = dateKey(now)
    const rolled = prevDayRef.current !== k
    prevDayRef.current = k
    if (rolled) return
    if (followToday && !isSameDay(selectedDate, now)) setFollowToday(false)
  }, [now, selectedDate, followToday])

  const realToday = startOfDay(now)
  const effectiveDay = followToday ? realToday : selectedDate

  const blockStart = useMemo(() => blockStartOf(now), [now])
  const blockEnd = blockStart + BLOCK_MS

  const blockEvents = useMemo(
    () => eventsInBlock(events, calendars, effectiveDay, blockStart),
    [events, calendars, effectiveDay, blockStart],
  )

  const rangeLabel = `${formatClock(new Date(blockStart), settings.hour12, false)} – ${formatClock(new Date(blockEnd), settings.hour12, false)}`

  /** Reveal the mini calendar at the top of the panel and bring it into view. */
  const toggleMini = () => {
    const next = !miniOpen
    setMiniOpen(next)
    if (next) {
      window.requestAnimationFrame(() =>
        miniRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
      )
    }
  }

  /* ---------------------------- rail ---------------------------- */

  if (collapsed) {
    return (
      <aside className="flex h-full w-[68px] shrink-0 flex-col border-r border-line bg-white">
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-line">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-lime-bright to-lime-deep text-[#1f2937] shadow-[0_4px_12px_rgba(163,217,34,0.35)] transition hover:scale-105"
          >
            <StickyNote className="h-4 w-4" strokeWidth={2.3} />
          </button>
        </div>

        <div className="scroll-area flex-1 space-y-0.5 overflow-y-auto p-2">
          {calendars.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleCalendar(c.id)}
              aria-label={`Toggle ${c.name}`}
              className="flex w-full justify-center rounded-lg py-2 transition hover:bg-surface"
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full transition-opacity',
                  c.visible ? 'opacity-100' : 'opacity-30',
                )}
                style={{ background: colorOf(c.color).dot }}
              />
            </button>
          ))}

          <div className="my-2 h-px bg-line" />

          <NavItem
            rail
            label="Dashboard"
            icon={<LayoutDashboard className="h-[17px] w-[17px]" />}
            active={section === 'dashboard' && !settingsOpen}
            onClick={openDashboard}
          />
          <NavItem
            rail
            label="Calendar"
            icon={<CalendarDays className="h-[17px] w-[17px]" />}
            active={section === 'calendar' && !settingsOpen}
            onClick={openCalendar}
          />

          <div className="my-2 h-px bg-line" />

          <NavItem
            rail
            label="Mini calendar"
            icon={<CalendarDays className="h-[17px] w-[17px]" />}
            active={miniOpen}
            onClick={toggleMini}
          />
          <NavItem
            rail
            label={rangeLabel}
            icon={<Clock className="h-[17px] w-[17px]" />}
            active={blockOpen}
            onClick={() => setBlockOpen((v) => !v)}
          />
        </div>

        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-line px-2 py-3">
          {user && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Account"
              className="rounded-full transition hover:opacity-80"
            >
              <Avatar size={32} name={user.fullName} src={user.avatar} />
            </button>
          )}
          <NavItem
            rail
            label="Settings"
            icon={<SettingsIcon className="h-[17px] w-[17px]" />}
            active={settingsOpen}
            onClick={() => openSettings()}
          />
        </div>
      </aside>
    )
  }

  /* -------------------------- expanded -------------------------- */

  return (
    <aside className="flex h-full w-[260px] shrink-0 flex-col border-r border-line bg-white">
      {/* 1. Branding */}
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-line px-4">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-lime-bright to-lime-deep text-[#1f2937] shadow-[0_4px_12px_rgba(163,217,34,0.35)]">
          <StickyNote className="h-4 w-4" strokeWidth={2.3} />
        </div>
        <span className="truncate text-[15px] font-bold tracking-[-0.02em] text-ink">
          OpenNote
        </span>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="ml-auto grid h-7 w-7 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-ink-soft"
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Scrollable body */}
      <div className="scroll-area flex-1 overflow-y-auto px-3 pb-2">
        {/* 2. Workspace */}
        <nav className="pt-3">
          <GroupLabel>Workspace</GroupLabel>
          <div className="space-y-0.5">
            <NavItem
              icon={<LayoutDashboard className="h-[16px] w-[16px]" />}
              label="Dashboard"
              active={section === 'dashboard' && !settingsOpen}
              onClick={openDashboard}
            />
            <NavItem
              icon={<CalendarDays className="h-[16px] w-[16px]" />}
              label="Calendar"
              active={section === 'calendar' && !settingsOpen}
              onClick={openCalendar}
            />
          </div>
        </nav>

        <div className="my-3 h-px bg-line" />

        {/* 3. Mini calendar */}
        <div ref={miniRef} className="scroll-mt-2">
          {miniOpen ? (
            <MiniCalendar />
          ) : (
            <button
              type="button"
              onClick={toggleMini}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-2.5 text-[11.5px] font-medium text-ink-soft transition hover:border-accent hover:bg-accent-soft hover:text-accent-text"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Show mini calendar
            </button>
          )}
        </div>

        <div className="my-3 h-px bg-line" />

        {/* 4. TOOLS */}
        <nav>
          <GroupLabel>Tools</GroupLabel>
          <div className="space-y-0.5">
            <NavItem
              icon={<CalendarDays className="h-[16px] w-[16px]" />}
              label="Mini Calendar"
              active={miniOpen}
              onClick={toggleMini}
            />
            <NavItem
              icon={<Clock className="h-[16px] w-[16px]" />}
              label={rangeLabel}
              active={blockOpen}
              onClick={() => setBlockOpen((v) => !v)}
            />
          </div>
        </nav>

        {blockOpen && (
          <div className="pt-3">
            <div className="flex items-baseline justify-between px-3 pb-1.5">
              <span className="text-[11.5px] font-semibold text-ink">
                {rangeLabel}
              </span>
              <span className="text-[10.5px] tabular-nums text-muted">
                {blockEvents.length}{' '}
                {blockEvents.length === 1 ? 'event' : 'events'}
              </span>
            </div>
            <div className="space-y-1">
              {blockEvents.map((e) => (
                <EventRow key={e.id} event={e} />
              ))}
              {blockEvents.length === 0 && (
                <p className="rounded-xl bg-surface px-3 py-2.5 text-[11.5px] leading-snug text-muted">
                  No events in this block.
                </p>
              )}
            </div>
          </div>
        )}

        <div className="my-3 h-px bg-line" />

        {/* 5. MY CALENDARS */}
        <nav>
          <div className="flex items-center justify-between pr-1">
            <GroupLabel>My Calendars</GroupLabel>
            <button
              type="button"
              aria-label="Add calendar"
              onClick={addCalendar}
              className="mb-1.5 grid h-6 w-6 place-items-center rounded-lg text-faint transition hover:bg-surface hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {calendars.map((c) => (
              <CalendarRow key={c.id} calendar={c} />
            ))}
            {calendars.length === 0 && (
              <p className="px-3 py-1.5 text-[11.5px] text-muted">
                No calendars yet — add one above.
              </p>
            )}
          </div>
        </nav>
      </div>

      {/* 5. Settings + 6. Account profile */}
      <div className="shrink-0 border-t border-line bg-white px-3 py-3">
        <nav className="mb-2">
          <div className="space-y-0.5">
            <NavItem
              icon={<SettingsIcon className="h-[16px] w-[16px]" />}
              label="Settings"
              active={settingsOpen}
              onClick={() => openSettings()}
            />
          </div>
        </nav>
        <AccountCard />
      </div>
    </aside>
  )
}