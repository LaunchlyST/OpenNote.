import { useEffect, useMemo, useRef, useState } from 'react'
import { StickyNote } from 'lucide-react'
import { useApp } from '../store'
import { colorOf } from '../lib/colors'
import type { CalendarEvent } from '../lib/types'
import {
  dateKey,
  formatClock,
  fromMinutes,
  isSameDay,
  isSameMonth,
  isWeekend,
  monthMatrix,
  startOfDay,
  weekdayShort,
} from '../lib/date'
import { cn } from '../lib/id'

export function MonthView() {
  const {
    events,
    calendars,
    notes,
    settings,
    selectedDate,
    selectDate,
    setView,
    openCreate,
    openEdit,
  } = useApp()
  const { weekStartsOn, showWeekends, hour12 } = settings
  const today = new Date()

  const scrollRef = useRef<HTMLDivElement>(null)
  const [rowHeight, setRowHeight] = useState(122)

  const allCells = useMemo(
    () =>
      monthMatrix(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        weekStartsOn,
      ),
    [selectedDate, weekStartsOn],
  )

  const cells = useMemo(
    () => (showWeekends ? allCells : allCells.filter((d) => !isWeekend(d))),
    [allCells, showWeekends],
  )

  const columns = showWeekends ? 7 : 5
  const rows = Math.max(1, Math.ceil(cells.length / columns))

  // Keep the month grid rows on whole pixels so the 1px row borders render as
  // thin, continuous, evenly spaced lines instead of aliased/dotted ones.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      const height = el.clientHeight
      if (height <= 0) return
      setRowHeight(Math.max(122, Math.floor(height / rows)))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [rows])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
    for (const ev of events) {
      if (!visible.has(ev.calendarId)) continue
      const key = dateKey(new Date(ev.start))
      const list = map.get(key)
      if (list) list.push(ev)
      else map.set(key, [ev])
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.start.localeCompare(b.start))
    }
    return map
  }, [events, calendars])

  const noteCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of notes) {
      if (!n.date) continue
      map.set(n.date, (map.get(n.date) ?? 0) + 1)
    }
    return map
  }, [notes])

  const headerDays = useMemo(
    () =>
      showWeekends
        ? cells.slice(0, 7)
        : cells.slice(0, 5),
    [cells, showWeekends],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <div
        className="grid h-9 shrink-0 border-b border-[#ececea]"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {headerDays.map((d, i) => (
          <div
            key={i}
            className="grid place-items-center border-l border-[#ececea] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#8f8e8a] first:border-l-0"
          >
            {weekdayShort(d)}
          </div>
        ))}
      </div>

      <div ref={scrollRef} className="scroll-area flex-1 overflow-y-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gridAutoRows: `${rowHeight}px`,
          }}
        >
          {cells.map((d) => {
            const key = dateKey(d)
            const dayEvents = byDay.get(key) ?? []
            const inMonth = isSameMonth(d, selectedDate)
            const isToday = isSameDay(d, today)
            const noteCount = noteCounts.get(key) ?? 0
            return (
              <div
                key={d.toISOString()}
                onClick={() => openCreate(fromMinutes(startOfDay(d), 9 * 60), 60)}
                className={cn(
                  'group/cell flex cursor-pointer flex-col gap-1 border-b border-l border-[#ececea] p-1.5 transition first:border-l-0',
                  !inMonth && 'bg-[#fbfbfc]',
                )}
              >
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      selectDate(d)
                      setView('day')
                    }}
                    className={cn(
                      'grid h-6 min-w-6 place-items-center rounded-[9px] px-1.5 text-[12px] font-semibold tabular-nums transition',
                      isToday
                        ? 'bg-[#191919] font-semibold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)]'
                        : inMonth
                          ? 'text-[#191919] hover:bg-[#f3f3f1]'
                          : 'text-[#c4c3be] hover:bg-[#f7f7f5]',
                    )}
                  >
                    {d.getDate()}
                  </button>
                  <div className="flex items-center gap-1">
                    {noteCount > 0 && (
                      <StickyNote className="h-2.5 w-2.5 text-[#d8b31a]" />
                    )}
                    <span className="grid h-5 w-5 place-items-center rounded-full text-[#b4b3ae] opacity-0 transition group-hover/cell:opacity-100">
                      <span className="text-[14px] leading-none">+</span>
                    </span>
                  </div>
                </div>

                <div className="flex min-h-0 flex-col gap-[3px] overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const color = colorOf(
                      calendars.find((c) => c.id === ev.calendarId)?.color,
                    )
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          openEdit(ev)
                        }}
                        className="flex w-full items-center gap-1 overflow-hidden rounded-[5px] px-1.5 py-[2px] text-left text-[10.5px] font-medium leading-tight transition hover:brightness-[0.965]"
                        style={{ background: color.bg, color: color.text }}
                      >
                        <span className="shrink-0 tabular-nums opacity-70">
                          {formatClock(new Date(ev.start), hour12, false)}
                        </span>
                        <span className="truncate">
                          {ev.title || 'Untitled'}
                        </span>
                      </button>
                    )
                  })}
                  {dayEvents.length > 3 && (
                    <span className="pl-1.5 text-[10px] font-medium text-[#8f8e8a]">
                      +{dayEvents.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
