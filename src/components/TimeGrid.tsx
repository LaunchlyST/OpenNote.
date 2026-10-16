import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react'
import { StickyNote } from 'lucide-react'
import { useApp } from '../store'
import { colorOf } from '../lib/colors'
import type { CalendarEvent } from '../lib/types'
import {
  addDays,
  clamp,
  dateKey,
  formatClock,
  fromMinutes,
  hourLabel,
  isSameDay,
  minutesOfDay,
  startOfDay,
  weekdayShort,
} from '../lib/date'
import { cn } from '../lib/id'
import { useNow } from '../hooks'

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SNAP = 15
const DAY_MINUTES = 1440
/** Gap between the week-header day cards. Must match the `gap-*` class used below. */
const DAY_HEADER_GAP = 6

interface Placed {
  event: CalendarEvent
  startMin: number
  endMin: number
  col: number
  cols: number
}

interface DragState {
  id: string
  mode: 'move' | 'resize'
  originX: number
  originY: number
  dayIndex: number
  startMin: number
  duration: number
  colWidth: number
  offsetDays: number
  offsetMin: number
  moved: boolean
}

function segment(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime()
  const s = Math.max(new Date(event.start).getTime(), dayStart)
  const e = Math.min(new Date(event.end).getTime(), dayStart + DAY_MINUTES * 60_000)
  const startMin = (s - dayStart) / 60_000
  const endMin = Math.max((e - dayStart) / 60_000, startMin + SNAP)
  return { startMin, endMin }
}

function layoutDay(eventsIn: CalendarEvent[], day: Date): Placed[] {
  const items = eventsIn
    .map((ev) => ({ ev, ...segment(ev, day) }))
    .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

  const out: Placed[] = []
  let cluster: typeof items = []
  let clusterEnd = -1

  const flush = () => {
    if (cluster.length === 0) return
    const colEnds: number[] = []
    const assign = new Map<string, number>()
    for (const it of cluster) {
      let idx = colEnds.findIndex((end) => end <= it.startMin)
      if (idx === -1) {
        idx = colEnds.length
        colEnds.push(it.endMin)
      } else {
        colEnds[idx] = it.endMin
      }
      assign.set(it.ev.id, idx)
    }
    const cols = colEnds.length
    for (const it of cluster) {
      out.push({
        event: it.ev,
        startMin: it.startMin,
        endMin: it.endMin,
        col: assign.get(it.ev.id) ?? 0,
        cols,
      })
    }
    cluster = []
    clusterEnd = -1
  }

  for (const it of items) {
    if (cluster.length > 0 && it.startMin >= clusterEnd) flush()
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.endMin)
  }
  flush()
  return out
}

export function TimeGrid({
  days,
  gridDays = days,
}: {
  days: Date[]
  gridDays?: Date[]
}) {
  const {
    events,
    calendars,
    notes,
    settings,
    openCreate,
    openEdit,
    saveEvent,
    selectDate,
    selectedDate,
    view,
    focusOnDate,
  } = useApp()
  const now = useNow(30_000)
  const { hourHeight, hour12 } = settings

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [gridWidth, setGridWidth] = useState(0)

  const isSingleDay = gridDays.length === 1

  useLayoutEffect(() => {
    const el = gridRef.current
    if (!el) return
    const update = () => setGridWidth(el.clientWidth)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    window.addEventListener('resize', update)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [])

  const weekColumnWidth = gridWidth > 0 ? gridWidth / 7 : 0

  /**
   * Splits `gridWidth` across `count` columns.
   *
   * `gaps` is the total gap the flex container inserts between columns. It has
   * to come off the top before dividing, otherwise the widths plus the gaps
   * overflow the container and the last column is clipped by the parent's
   * `overflow-hidden`.
   */
  const distribute = (count: number, gaps = 0) => {
    if (gridWidth <= 0 || count <= 0) return null
    const usable = gridWidth - gaps
    const base = Math.floor(usable / count)
    if (base <= 0) return null
    const rem = usable - base * count
    return Array.from({ length: count }, (_, i) => base + (i >= count - rem ? 1 : 0))
  }

  const colWidths = useMemo(
    () => distribute(gridDays.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridWidth, gridDays.length],
  )

  const headerWidths = useMemo(
    () => distribute(days.length, DAY_HEADER_GAP * (days.length - 1)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridWidth, days.length],
  )

  const calMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  )

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const cal = calMap.get(ev.calendarId)
      if (!cal || !cal.visible) continue
      let cur = startOfDay(new Date(ev.start))
      const last = startOfDay(new Date(ev.end))
      let guard = 0
      while (cur.getTime() <= last.getTime() && guard < 400) {
        const key = dateKey(cur)
        const list = map.get(key)
        if (list) list.push(ev)
        else map.set(key, [ev])
        cur = addDays(cur, 1)
        guard += 1
      }
    }
    return map
  }, [events, calMap])

  const noteCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const n of notes) {
      if (!n.date) continue
      map.set(n.date, (map.get(n.date) ?? 0) + 1)
    }
    return map
  }, [notes])

  const totalHeight = 24 * hourHeight
  const nowMin = minutesOfDay(now)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = Math.max(0, 7.5 * hourHeight - 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!drag) return
    document.body.style.userSelect = 'none'
    document.body.style.cursor = drag.mode === 'move' ? 'grabbing' : 'ns-resize'

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX - drag.originX
      const dy = e.clientY - drag.originY
      const moved = drag.moved || Math.abs(dx) > 3 || Math.abs(dy) > 3
      const offsetDays = clamp(
        Math.round(dx / drag.colWidth),
        -drag.dayIndex,
        gridDays.length - 1 - drag.dayIndex,
      )
      const rawMin = Math.round(((dy / hourHeight) * 60) / SNAP) * SNAP
      const offsetMin =
        drag.mode === 'move'
          ? clamp(rawMin, -drag.startMin, DAY_MINUTES - drag.startMin - drag.duration)
          : clamp(rawMin, SNAP - drag.duration, DAY_MINUTES - drag.startMin - drag.duration)
      setDrag({ ...drag, moved, offsetDays, offsetMin })
    }

    const onUp = () => {
      const d = drag
      setDrag(null)
      const ev = events.find((x) => x.id === d.id)
      if (!ev) return
      if (!d.moved) {
        openEdit(ev)
        return
      }
      const day = gridDays[d.dayIndex + d.offsetDays] ?? gridDays[d.dayIndex]
      const newStartMin = d.mode === 'move' ? d.startMin + d.offsetMin : d.startMin
      const newStart = fromMinutes(startOfDay(day), newStartMin)
      const duration =
        d.mode === 'move' ? d.duration : Math.max(SNAP, d.duration + d.offsetMin)
      const newEnd = new Date(newStart.getTime() + duration * 60_000)
      saveEvent({
        ...ev,
        start: newStart.toISOString(),
        end: newEnd.toISOString(),
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [drag, gridDays, events, hourHeight, openEdit, saveEvent])

  const beginDrag = (
    e: ReactPointerEvent<HTMLDivElement>,
    event: CalendarEvent,
    mode: 'move' | 'resize',
    dayIndex: number,
    startMin: number,
    duration: number,
  ) => {
    const grid = gridRef.current
    if (!grid) return
    e.stopPropagation()
    e.preventDefault()
    const colWidth =
      (colWidths && colWidths[dayIndex]) ||
      grid.getBoundingClientRect().width / gridDays.length
    setDrag({
      id: event.id,
      mode,
      originX: e.clientX,
      originY: e.clientY,
      dayIndex,
      startMin,
      duration,
      colWidth: colWidth || 1,
      offsetDays: 0,
      offsetMin: 0,
      moved: false,
    })
  }

  const createAt = (e: ReactMouseEvent<HTMLDivElement>, day: Date) => {
    if (drag) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minutes = clamp(
      Math.floor(((y / hourHeight) * 60) / 30) * 30,
      0,
      DAY_MINUTES - 30,
    )
    openCreate(fromMinutes(day, minutes), 60)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas-warm">
      {/* Day header — rounded cards */}
      <div className="flex h-[84px] shrink-0 border-b border-line bg-white px-3 py-2.5">
        <div className="w-[52px] shrink-0" />
        <div
          className="flex gap-1.5"
          style={
            headerWidths
              ? { width: gridWidth, flex: '0 0 auto' }
              : { flex: '1 1 0%', minWidth: 0 }
          }
        >
          {days.map((day, di) => {
            const isToday = isSameDay(day, now)
            const isSelected = isSameDay(day, selectedDate)
            const count = noteCounts.get(dateKey(day)) ?? 0
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => {
                  if (view === 'week') {
                    focusOnDate(day)
                  } else {
                    selectDate(day)
                  }
                }}
                className={cn(
                  'group relative flex flex-1 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 transition-all duration-200 ease-out',
                  isSelected
                    ? 'border-transparent bg-accent-soft shadow-[0_6px_16px_-8px_rgba(103,138,20,0.5)] ring-2 ring-accent/70'
                    : isToday
                      ? 'border-accent/40 bg-white shadow-[0_2px_8px_-4px_rgba(103,138,20,0.3)]'
                      : 'border-transparent hover:border-border-subtle hover:bg-surface hover:shadow-sm',
                )}
                style={
                  headerWidths
                    ? { width: headerWidths[di], flex: '0 0 auto' }
                    : undefined
                }
              >
                <span
                  className={cn(
                    'flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.09em] transition-colors duration-200',
                    isSelected
                      ? 'text-accent-text/85'
                      : isToday
                        ? 'text-accent-text/70'
                        : 'text-faint group-hover:text-muted',
                  )}
                >
                  {weekdayShort(day)}
                  {count > 0 && (
                    <StickyNote
                      className={cn(
                        'h-2.5 w-2.5',
                        isSelected || isToday
                          ? 'text-accent-deep/70'
                          : 'text-[#d8b31a]',
                      )}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    'grid h-9 min-w-9 place-items-center rounded-full px-2.5 text-[17px] font-bold tabular-nums transition-all duration-200 ease-out',
                    isSelected
                      ? 'bg-white text-accent-text shadow-[0_2px_6px_-1px_rgba(103,138,20,0.4)]'
                      : isToday
                        ? 'bg-accent-soft text-accent-text ring-1 ring-accent/50'
                        : 'text-ink',
                  )}
                >
                  {day.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Timeline */}
      <div
        ref={scrollRef}
        className="scroll-area relative flex-1 overflow-y-auto overflow-x-hidden"
      >
        <div className="relative flex" style={{ height: totalHeight }}>
          {/* Time labels */}
          <div className="relative w-[56px] shrink-0 select-none">
            {HOURS.map((h) => (
              <div
                key={h}
                className={cn(
                  'absolute right-3 text-[10.5px] font-semibold tabular-nums',
                  h === 0 ? 'top-0.5' : '-translate-y-1/2',
                  'text-faint',
                )}
                style={{ top: h * hourHeight }}
              >
                {hourLabel(h, hour12)}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div
            ref={gridRef}
            className="relative flex min-w-0 flex-1 border-l border-line"
          >
            {/* Gridlines */}
            <div className="pointer-events-none absolute inset-0">
              {HOURS.map((h) => (
                <div
                  key={`h${h}`}
                  className="absolute inset-x-0 border-t border-grid-line"
                  style={{ top: h * hourHeight }}
                />
              ))}
              {days.some((d) => isSameDay(d, now)) && (
                <div
                  className="absolute inset-x-0 border-t border-now-line"
                  style={{ top: (nowMin / 60) * hourHeight }}
                />
              )}
            </div>

            {gridDays.map((day, di) => {
              const placed = layoutDay(byDay.get(dateKey(day)) ?? [], day)
              const isToday = isSameDay(day, now)
              return (
                <div
                  key={day.toISOString()}
                  onClick={(e) => createAt(e, day)}
                  className="relative border-l border-grid-line first:border-l-0"
                  style={
                    colWidths
                      ? { width: colWidths[di], flex: '0 0 auto' }
                      : { flex: '1 1 0%', minWidth: 0 }
                  }
                >
                  {placed.map((p) => {
                    const color = colorOf(
                      calMap.get(p.event.calendarId)?.color,
                    )
                    const top = (p.startMin / 60) * hourHeight
                    const height = Math.max(
                      20,
                      ((p.endMin - p.startMin) / 60) * hourHeight - 3,
                    )
                    const widthPct = 100 / p.cols
                    const dragOffset =
                      drag && drag.id === p.event.id ? drag : null
                    const isDragging = dragOffset !== null
                    const isResizing = dragOffset?.mode === 'resize'
                    let renderHeight = height
                    let transform: string | undefined
                    if (dragOffset?.mode === 'move') {
                      transform = `translate(${dragOffset.offsetDays * dragOffset.colWidth}px, ${(dragOffset.offsetMin / 60) * hourHeight}px)`
                    } else if (isResizing) {
                      renderHeight = Math.max(
                        20,
                        ((p.endMin - p.startMin + dragOffset.offsetMin) / 60) *
                          hourHeight -
                          3,
                      )
                    }
                    const start = new Date(p.event.start)
                    const end = new Date(p.event.end)
                    return (
                      <div
                        key={p.event.id}
                        onPointerDown={(e) =>
                          beginDrag(
                            e,
                            p.event,
                            'move',
                            di,
                            p.startMin,
                            p.endMin - p.startMin,
                          )
                        }
                        onClick={(e) => e.stopPropagation()}
                        className={cn(
                          'group absolute overflow-hidden rounded-xl border text-left transition-all duration-150',
                          isDragging
                            ? 'z-40 cursor-grabbing shadow-[0_18px_36px_-10px_rgba(16,24,40,0.45)]'
                            : 'cursor-grab shadow-[0_1px_2px_rgba(16,24,40,0.06)] hover:z-20 hover:-translate-y-px hover:shadow-[0_10px_22px_-8px_rgba(16,24,40,0.28)]',
                        )}
                        style={{
                          top,
                          height: renderHeight,
                          left: `calc(${p.col * widthPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                          maxWidth:
                            isSingleDay && weekColumnWidth > 0
                              ? Math.max(120, weekColumnWidth - 8)
                              : undefined,
                          background: color.bg,
                          borderColor: color.border,
                          color: color.text,
                          transform,
                          touchAction: 'none',
                        }}
                        title={`${p.event.title || 'Untitled'} · ${formatClock(start, hour12)} – ${formatClock(end, hour12)}`}
                      >
                        {/* Calendar colour stripe, so the category reads at a glance */}
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-y-0 left-0 w-[3px] rounded-l-xl opacity-70 transition-opacity group-hover:opacity-100"
                          style={{ background: color.dot }}
                        />
                        <div className="pointer-events-none px-2.5 py-1.5 pl-3">
                          <div className="truncate text-[11.5px] font-semibold leading-tight tracking-[-0.005em]">
                            {p.event.title || 'Untitled'}
                          </div>
                          {height > 34 && (
                            <div className="mt-0.5 truncate text-[10.5px] font-medium leading-tight opacity-75">
                              {formatClock(start, hour12)} –{' '}
                              {formatClock(end, hour12)}
                            </div>
                          )}
                        </div>
                        <div
                          onPointerDown={(e) =>
                            beginDrag(
                              e,
                              p.event,
                              'resize',
                              di,
                              p.startMin,
                              p.endMin - p.startMin,
                            )
                          }
                          className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
                        />
                      </div>
                    )
                  })}

                  {isToday && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-30"
                      style={{ top: (nowMin / 60) * hourHeight }}
                    >
                      <div className="relative border-t-[1.5px] border-now-indicator">
                        <span className="absolute -left-[4px] -top-[4px] h-2 w-2 rounded-full bg-now-indicator" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}