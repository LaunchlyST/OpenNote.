import type { Note } from './types'

/**
 * Time-slot notes.
 *
 * A slot is one 5-minute block on one day. A note belongs to a slot when it is
 * pinned to a date and a time (the same `date`/`time` fields the Notes panel
 * uses); its time is floored to the 5-minute block. Each slot holds at most
 * MAX_SLOT_NOTES notes, ordered by when they were created.
 */
export const SLOT_MINUTES = 5
export const MAX_SLOT_NOTES = 3

/**
 * Vertical zoom levels. `interval` is the row size in minutes; `rowPx` is the
 * height of one row (null = use the "Row height" preference for 1-hour rows).
 */
export const ZOOM_LEVELS: Array<{ interval: number; rowPx: number | null; label: string }> = [
  { interval: 60, rowPx: null, label: '1 h' },
  { interval: 30, rowPx: 48, label: '30 min' },
  { interval: 15, rowPx: 44, label: '15 min' },
  { interval: 5, rowPx: 66, label: '5 min' },
]

export function clampZoom(level: number | undefined): number {
  const n = Math.round(Number(level ?? 0))
  return Number.isFinite(n) ? Math.min(ZOOM_LEVELS.length - 1, Math.max(0, n)) : 0
}

/** Pixels per hour at a zoom level. */
export function hourPxFor(level: number, baseHourHeight: number): number {
  const z = ZOOM_LEVELS[clampZoom(level)]
  return z.rowPx === null ? baseHourHeight : (60 / z.interval) * z.rowPx
}

/** "HH:mm" → minutes of the day, or null. */
export function timeToMinutes(time: string | undefined): number | null {
  if (!time) return null
  const m = /^(\d{2}):(\d{2})$/.exec(time)
  if (!m) return null
  const v = Number(m[1]) * 60 + Number(m[2])
  return v >= 0 && v < 1440 ? v : null
}

export function minutesToTime(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/** Start minute of the 5-minute slot a note sits in, or null when not time-pinned. */
export function slotOf(note: Note): number | null {
  const m = timeToMinutes(note.time)
  return m === null ? null : Math.floor(m / SLOT_MINUTES) * SLOT_MINUTES
}

/** date → slot start minute → notes (oldest first). */
export function groupSlotNotes(notes: Note[]): Map<string, Map<number, Note[]>> {
  const out = new Map<string, Map<number, Note[]>>()
  for (const n of notes) {
    if (!n.date) continue
    const slot = slotOf(n)
    if (slot === null) continue
    let day = out.get(n.date)
    if (!day) out.set(n.date, (day = new Map()))
    const list = day.get(slot)
    if (list) list.push(n)
    else day.set(slot, [n])
  }
  for (const day of out.values())
    for (const list of day.values()) list.sort((a, b) => a.createdAt - b.createdAt)
  return out
}
