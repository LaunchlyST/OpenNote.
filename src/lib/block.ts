import type { Calendar, CalendarEvent } from './types'
import { isSameDay } from './date'

/** Length of one sidebar time block: 2 hours. */
export const BLOCK_MS = 2 * 60 * 60 * 1000

/**
 * Start timestamp (ms) of the 2-hour block containing `now`.
 * Blocks run 00:00–02:00, 02:00–04:00, …, 22:00–00:00.
 */
export function blockStartOf(now: Date): number {
  const d = new Date(now)
  d.setHours(Math.floor(d.getHours() / 2) * 2, 0, 0, 0)
  return d.getTime()
}

/**
 * Events from visible calendars that are scheduled within the 2-hour block
 * starting at `blockStart` on the given day. An event counts when it overlaps
 * the block at all (e.g. a 09:00–09:30 event shows in the 08:00–10:00 block).
 */
export function eventsInBlock(
  events: CalendarEvent[],
  calendars: Calendar[],
  day: Date,
  blockStart: number,
): CalendarEvent[] {
  const visible = new Set(calendars.filter((c) => c.visible).map((c) => c.id))
  const blockEnd = blockStart + BLOCK_MS
  return events
    .filter((e) => visible.has(e.calendarId))
    .filter((e) => {
      const s = new Date(e.start).getTime()
      const en = new Date(e.end).getTime()
      return isSameDay(new Date(s), day) && s < blockEnd && en > blockStart
    })
    .sort((a, b) => a.start.localeCompare(b.start))
}
