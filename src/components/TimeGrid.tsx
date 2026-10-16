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
import { colorOf as noteColor } from '../lib/colors'
import type { Note } from '../lib/types'
import {
  SLOT_MINUTES,
  ZOOM_LEVELS,
  clampZoom,
  groupSlotNotes,
  hourPxFor,
  minutesToTime,
} from '../lib/slots'
import { SlotNotesPopover } from './SlotNotesPopover'
import type { SlotTarget } from './SlotNotesPopover'

const NOTE_CARD = 18
const NOTE_GAP = 2

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const SNAP = 15
const DAY_MINUTES = 1440

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

/** Minutes of this single day that the event covers, clipped to 0..1440. */
function segment(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day).getTime()
  const s = Math.max(new Date(event.start).getTime(), dayStart)
  const e = Math.min(new Date(event.end).getTime(), dayStart + DAY_MINUTES * 60_000)
  const startMin = (s - dayStart) / 60_000
  const endMin = Math.max((e - dayStart) / 60_000, startMin + SNAP)
  return { startMin, endMin }
}

/** Side-by-side columns for overlapping events. */
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

/**
 * `days` drives the day-name header; `gridDays` drives the timeline columns.
 * They differ while Full Week is focused on a single day: the header keeps all
 * seven names for context while the grid shows just that day, full width.
 */
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
    updateSettings,
    openEdit,
    saveEvent,
    selectDate,
    selectedDate,
    view,
    focusOnDate,
  } = useApp()
  const now = useNow(30_000)
  const { hourHeight: baseHourHeight, hour12 } = settings
  // Vertical zoom only changes how many pixels an hour gets; times, dates and
  // saved data are untouched.
  const zoom = clampZoom(settings.zoomLevel)
  const interval = ZOOM_LEVELS[zoom].interval
  const hourHeight = hourPxFor(zoom, baseHourHeight)
  const setZoom = (next: number) => {
    const z = clampZoom(next)
    if (z !== zoom) updateSettings({ zoomLevel: z })
  }
  const [slotTarget, setSlotTarget] = useState<SlotTarget | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<HTMLDivElement | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [gridWidth, setGridWidth] = useState(0)

  const isSingleDay = gridDays.length === 1

  // Measure the grid so single-day event cards can keep the same
  // width as one week-view column instead of stretching full-width.
  // clientWidth keeps the measurement on whole pixels (the browser rounds
  // it) and matches the column area that the day header must line up with.
  //
  // The columns are laid out at the width measured here, so the container
  // must be allowed to shrink (`min-w-0`). Without that, the default
  // `min-width: auto` keeps the container as wide as its own columns, the
  // measurement never changes again, and a stale width clips the last days.
  // The window listener re-measures in case the panel resizes without the
  // grid itself changing (rail toggles, notes panel opening).
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

  // Width of one week-view column at the current viewport size.
  const weekColumnWidth = gridWidth > 0 ? gridWidth / 7 : 0

  // Integer-pixel column widths shared by the day header and the grid body.
  // Distribution by a flexible row lands the 1px vertical separators on
  // fractional coordinates, which makes the horizontal gridlines look
  // broken or offset at each column join. Distribute the measured width in
  // whole pixels instead so every separator sits on a clean pixel boundary.
  const distribute = (count: number) => {
    if (gridWidth <= 0 || count <= 0) return null
    const base = Math.floor(gridWidth / count)
    if (base <= 0) return null
    const rem = gridWidth - base * count
    return Array.from({ length: count }, (_, i) => base + (i >= count - rem ? 1 : 0))
  }

  const colWidths = useMemo(
    () => distribute(gridDays.length),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gridWidth, gridDays.length],
  )

  // The header can show a different number of cells than the grid, so it gets
  // its own equally-distributed widths spanning the same measured area.
  const headerWidths = useMemo(
    () => distribute(days.length),
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

  // Start the day at a sensible scroll offset.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = Math.max(0, 7.5 * hourHeight - 24)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zooming keeps the time at the middle of the viewport in place.
  const prevHourPx = useRef(hourHeight)
  useLayoutEffect(() => {
    const el = scrollRef.current
    const prev = prevHourPx.current
    prevHourPx.current = hourHeight
    if (!el || prev === hourHeight) return
    const centreMin = ((el.scrollTop + el.clientHeight / 2) / prev) * 60
    el.scrollTop = Math.max(0, (centreMin / 60) * hourHeight - el.clientHeight / 2)
  }, [hourHeight])

  // Zoom by gesture, never by the page: Ctrl/⌘ + wheel and trackpad pinch
  // (reported as ctrl + wheel), Safari's trackpad gesture events, and a
  // two-finger pinch on touch screens.
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom
  const setZoomRef = useRef(setZoom)
  setZoomRef.current = setZoom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let acc = 0
    let last = 0
    const step = (dir: number) => setZoomRef.current(zoomRef.current + dir)
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      acc += e.deltaY
      const now = Date.now()
      if (Math.abs(acc) < 40 || now - last < 120) return
      setZoomRef.current(zoomRef.current + (acc < 0 ? 1 : -1))
      acc = 0
      last = now
    }
    // Pinch: step one level each time the fingers spread or close by ~25%.
    let base = 0
    const ratio = (scale: number) => {
      if (scale > 1.25) step(1)
      else if (scale < 0.8) step(-1)
      else return false
      return true
    }
    const dist = (t: TouchList) =>
      Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) base = dist(e.touches)
    }
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !base) return
      e.preventDefault()
      const d = dist(e.touches)
      if (ratio(d / base)) base = d
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) base = 0
    }
    // Safari (macOS trackpad / iOS) reports pinches as gesture events.
    let gestureBase = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gestureBase = 1
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      const scale = (e as Event & { scale: number }).scale
      if (ratio(scale / gestureBase)) gestureBase = scale
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    el.addEventListener('gesturestart', onGestureStart)
    el.addEventListener('gesturechange', onGestureChange)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
      el.removeEventListener('gesturestart', onGestureStart)
      el.removeEventListener('gesturechange', onGestureChange)
    }
  }, [])

  const slotNotes = useMemo(() => groupSlotNotes(notes), [notes])

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

  /** Clicking the grid opens the slot popover (notes, or a new event). */
  const createAt = (e: ReactMouseEvent<HTMLDivElement>, day: Date) => {
    if (drag) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const minute = clamp(Math.floor((y / hourHeight) * 60), 0, DAY_MINUTES - 1)
    const rangeStart = Math.floor(minute / interval) * interval
    setSlotTarget({
      day,
      rangeStart,
      rangeEnd: rangeStart + interval,
      slot: Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES,
      x: e.clientX + 8,
      y: e.clientY + 8,
    })
  }

  const openSlot = (
    e: ReactMouseEvent<HTMLElement>,
    day: Date,
    rangeStart: number,
    slot: number,
  ) => {
    e.stopPropagation()
    const r = e.currentTarget.getBoundingClientRect()
    setSlotTarget({ day, rangeStart, rangeEnd: rangeStart + interval, slot, x: r.left, y: r.bottom + 4 })
  }

  /** Note cards for one day column, confined to their own rows. */
  const renderNotes = (day: Date, placed: Placed[]) => {
    const bySlot = slotNotes.get(dateKey(day))
    if (!bySlot) return null
    const rows = new Map<number, number[]>()
    for (const slot of [...bySlot.keys()].sort((a, b) => a - b)) {
      const row = Math.floor(slot / interval) * interval
      const list = rows.get(row)
      if (list) list.push(slot)
      else rows.set(row, [slot])
    }
    const rowPx = (interval / 60) * hourHeight
    const fits = Math.max(1, Math.floor((rowPx - NOTE_GAP) / (NOTE_CARD + NOTE_GAP)))
    const color = noteColor('yellow')
    const card =
      'pointer-events-auto flex w-full items-center gap-1 overflow-hidden rounded-[6px] px-1.5 text-left text-[10.5px] font-medium leading-none transition hover:brightness-[0.97]'
    const cardStyle = {
      height: NOTE_CARD,
      background: color.bg,
      color: color.text,
      boxShadow: `inset 2px 0 0 ${color.dot}, inset 0 0 0 1px ${color.border}`,
    }
    const label = (n: Note) => n.title.trim() || 'Untitled note'

    return [...rows.entries()].map(([row, slots]) => {
      // Share the column with events in the same row instead of covering them.
      const busy = placed.some((p) => p.startMin < row + interval && p.endMin > row)
      const items: React.ReactNode[] = []
      if (interval === SLOT_MINUTES) {
        // Fully zoomed in: every note of the slot, as its own card.
        const list = bySlot.get(slots[0]) ?? []
        list.forEach((n, i) =>
          items.push(
            <button
              key={n.id}
              type="button"
              data-note-card
              className={card}
              style={cardStyle}
              title={label(n)}
              onClick={(e) => openSlot(e, day, row, slots[0])}
            >
              <span className="shrink-0 opacity-60">{i + 1}.</span>
              <span className="truncate">{label(n)}</span>
            </button>,
          ),
        )
      } else {
        // Zoomed out: the first note of each occupied slot, with +N for the rest.
        const overflow = slots.length > fits
        const shown = overflow ? slots.slice(0, fits - 1) : slots
        for (const slot of shown) {
          const list = bySlot.get(slot) ?? []
          items.push(
            <div key={slot} data-note-card className={card} style={cardStyle} title={list.map(label).join(' · ')}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1 text-left"
                onClick={(e) => openSlot(e, day, row, slot)}
              >
                {slots.length > 1 || slot !== row ? (
                  <span className="shrink-0 tabular-nums opacity-60">{minutesToTime(slot)}</span>
                ) : null}
                <span className="truncate">{label(list[0])}</span>
              </button>
              {list.length > 1 && (
                <button
                  type="button"
                  aria-label={`Show all ${list.length} notes`}
                  onClick={(e) => openSlot(e, day, row, slot)}
                  className="shrink-0 rounded-[4px] bg-white/70 px-1 py-[2px] text-[9.5px] font-bold"
                >
                  +{list.length - 1}
                </button>
              )}
            </div>,
          )
        }
        if (overflow) {
          const hidden = slots.slice(fits - 1)
          const count = hidden.reduce((t, s) => t + (bySlot.get(s)?.length ?? 0), 0)
          items.push(
            <button
              key="more"
              type="button"
              data-note-card
              className={cn(card, 'justify-center font-semibold')}
              style={cardStyle}
              onClick={(e) => openSlot(e, day, row, hidden[0])}
            >
              +{count} more note{count === 1 ? '' : 's'}
            </button>,
          )
        }
      }
      return (
        <div
          key={`notes-${row}`}
          className="pointer-events-none absolute z-[25] flex flex-col overflow-hidden"
          style={{
            top: (row / 60) * hourHeight + NOTE_GAP,
            height: rowPx - NOTE_GAP * 2,
            left: busy ? '50%' : 4,
            right: 4,
            gap: NOTE_GAP,
          }}
        >
          {items}
        </div>
      )
    })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      {/* Day header */}
      <div className="flex h-[64px] shrink-0 border-b border-[#ececea] bg-white">
        <div
          className="flex w-[62px] shrink-0 items-end justify-center pb-2"
          title="Pinch, or hold Ctrl (⌘ on Mac) and scroll, to zoom the calendar"
        >
          <span className="text-[9.5px] font-medium tabular-nums text-[#a3a29e]" data-testid="zoom-label">
            {ZOOM_LEVELS[zoom].label}
          </span>
        </div>
        <div
          className="flex border-l border-[#ececea]"
          style={
            headerWidths
              ? { width: gridWidth + 1, flex: '0 0 auto' }
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
                  // In Full Week, a day click narrows the grid to that day.
                  // In Day view it just moves the selected date.
                  if (view === 'week') {
                    focusOnDate(day)
                  } else {
                    selectDate(day)
                  }
                }}
                className="group flex flex-col items-center justify-center gap-1 py-2 transition-colors"
                style={
                  headerWidths
                    ? { width: headerWidths[di], flex: '0 0 auto' }
                    : undefined
                }
              >
                <span className="flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#a3a29e] transition-colors group-hover:text-[#6b6a66]">
                  {weekdayShort(day)}
                  {count > 0 && (
                    <StickyNote className="h-2.5 w-2.5 text-[#d8b31a]" />
                  )}
                </span>
                <span
                  className={cn(
                    'grid h-8 min-w-8 place-items-center rounded-xl px-2 text-[15px] font-semibold tabular-nums transition-all duration-150',
                    isSelected
                      ? 'bg-[#191919] font-semibold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)]'
                      : isToday
                        ? 'bg-[#f4fbe0] text-[#5d7a0f] ring-1 ring-inset ring-[#d4f08a] group-hover:bg-[#eef8d4]'
                        : 'text-[#191919] group-hover:bg-[#f3f3f1]',
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
        style={{ touchAction: 'pan-y' }}
      >
        <div className="relative flex" style={{ height: totalHeight }}>
          <div className="relative w-[62px] shrink-0 select-none">
            {HOURS.map((h) => (
              <div
                key={h}
                className={cn(
                  'absolute right-2.5 text-[10.5px] font-medium tabular-nums text-[#9aa0b0]',
                  h === 0 ? 'top-0.5' : '-translate-y-1/2',
                )}
                style={{ top: h * hourHeight }}
              >
                {hourLabel(h, hour12)}
              </div>
            ))}
            {interval < 60 &&
              HOURS.flatMap((h) =>
                Array.from({ length: 60 / interval - 1 }, (_, i) => (i + 1) * interval).map((m) => (
                  <div
                    key={`m${h}-${m}`}
                    className="absolute right-2.5 -translate-y-1/2 text-[9.5px] tabular-nums text-[#c4c3be]"
                    style={{ top: ((h * 60 + m) / 60) * hourHeight }}
                  >
                    :{String(m).padStart(2, '0')}
                  </div>
                )),
              )}
          </div>

          <div
            ref={gridRef}
            className="relative flex min-w-0 flex-1 border-l border-[#ececea]"
          >
            {/* gridlines */}
            <div className="pointer-events-none absolute inset-0">
              {HOURS.map((h) => (
                <div
                  key={`h${h}`}
                  className="absolute inset-x-0 border-t border-[#e9e9e7]"
                  style={{ top: h * hourHeight }}
                />
              ))}
              {interval < 60 &&
                HOURS.flatMap((h) =>
                  Array.from({ length: 60 / interval - 1 }, (_, i) => (i + 1) * interval).map((m) => (
                    <div
                      key={`m${h}-${m}`}
                      className={cn(
                        'absolute inset-x-0 border-t',
                        m % 30 === 0 ? 'border-[#f0f0ee]' : 'border-dashed border-[#f3f3f1]',
                      )}
                      style={{ top: ((h * 60 + m) / 60) * hourHeight }}
                    />
                  )),
                )}
              {days.some((d) => isSameDay(d, now)) && (
                <div
                  className="absolute inset-x-0 border-t border-[#ffd6d7]"
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
                  data-day={dateKey(day)}
                  onClick={(e) => createAt(e, day)}
                  className="relative border-l border-[#ececea] first:border-l-0"
                  style={{
                    ...(colWidths
                      ? { width: colWidths[di], flex: '0 0 auto' }
                      : { flex: '1 1 0%', minWidth: 0 }),
                    // A whisper of tint marks today's column.
                    background: isToday ? 'rgba(25,25,25,0.018)' : undefined,
                  }}
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
                          'absolute overflow-hidden rounded-[8px] text-left transition-[box-shadow,transform] duration-150',
                          isDragging
                            ? 'z-40 cursor-grabbing'
                            : 'cursor-grab hover:z-20 hover:-translate-y-px',
                        )}
                        style={{
                          top,
                          height: renderHeight,
                          left: `calc(${p.col * widthPct}% + 5px)`,
                          width: `calc(${widthPct}% - 9px)`,
                          maxWidth:
                            isSingleDay && weekColumnWidth > 0
                              ? Math.max(120, weekColumnWidth - 9)
                              : undefined,
                          background: color.bg,
                          color: color.text,
                          // Colour bar on the left + hairline in the calendar colour.
                          boxShadow: `inset 3px 0 0 ${color.dot}, inset 0 0 0 1px ${color.border}80${isDragging ? ', 0 12px 28px -8px rgba(0,0,0,0.3)' : ', 0 1px 2px rgba(0,0,0,0.05)'}`,
                          transform,
                          touchAction: 'none',
                        }}
                        title={`${p.event.title || 'Untitled'} · ${formatClock(start, hour12)} – ${formatClock(end, hour12)}`}
                      >
                        <div className="pointer-events-none py-[5px] pr-2 pl-[11px]">
                          <div className="truncate text-[11.5px] font-semibold leading-tight tracking-[-0.005em]">
                            {p.event.title || 'Untitled'}
                          </div>
                          {height > 34 && (
                            <div className="mt-[1px] truncate text-[10.5px] font-medium leading-tight opacity-75">
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

                  {renderNotes(day, placed)}

                  {isToday && (
                    <div
                      className="pointer-events-none absolute inset-x-0 z-30"
                      style={{ top: (nowMin / 60) * hourHeight }}
                    >
                      <div className="relative border-t-[1.5px] border-[#ff5a5f]">
                        <span className="absolute -left-[4px] -top-[4px] h-2 w-2 rounded-full bg-[#ff5a5f]" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {slotTarget && (
        <SlotNotesPopover target={slotTarget} onClose={() => setSlotTarget(null)} />
      )}
    </div>
  )
}
