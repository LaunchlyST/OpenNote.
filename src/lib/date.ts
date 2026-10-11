import type { ViewMode } from './types'

export const DAY_MS = 86_400_000
export const MINUTE_MS = 60_000

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function endOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(23, 59, 59, 999)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MINUTE_MS)
}

export function addMonths(d: Date, n: number): Date {
  const x = new Date(d)
  const day = x.getDate()
  x.setDate(1)
  x.setMonth(x.getMonth() + n)
  const lastDay = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()
  x.setDate(Math.min(day, lastDay))
  return x
}

export function startOfWeek(d: Date, weekStartsOn: number = 1): Date {
  const x = startOfDay(d)
  const diff = (x.getDay() - weekStartsOn + 7) % 7
  return addDays(x, -diff)
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function isSameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

/** yyyy-mm-dd in local time */
export function dateKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

export function fromMinutes(day: Date, minutes: number): Date {
  const x = startOfDay(day)
  x.setMinutes(minutes)
  return x
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

export function monthMatrix(
  year: number,
  month: number,
  weekStartsOn: number = 1,
): Date[] {
  const first = new Date(year, month, 1)
  const start = startOfWeek(first, weekStartsOn)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function weekDays(anchor: Date, weekStartsOn: number = 1): Date[] {
  const start = startOfWeek(anchor, weekStartsOn)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

export function weekdayShort(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

export function weekdayLong(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

export function monthShort(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short' })
}

export function monthLong(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long' })
}

export function formatClock(d: Date, hour12: boolean, withMinutes = true): string {
  const h = d.getHours()
  const m = d.getMinutes()
  if (hour12) {
    const suffix = h < 12 ? 'AM' : 'PM'
    const hh = h % 12 === 0 ? 12 : h % 12
    return withMinutes ? `${hh}:${`${m}`.padStart(2, '0')} ${suffix}` : `${hh} ${suffix}`
  }
  return withMinutes
    ? `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`
    : `${`${h}`.padStart(2, '0')}:00`
}

export function hourLabel(hour: number, hour12: boolean): string {
  if (!hour12) return `${`${hour}`.padStart(2, '0')}:00`
  const suffix = hour < 12 ? 'AM' : 'PM'
  const hh = hour % 12 === 0 ? 12 : hour % 12
  return `${hh} ${suffix}`
}

export function toDateInput(d: Date): string {
  return dateKey(d)
}

export function toTimeInput(d: Date): string {
  return `${`${d.getHours()}`.padStart(2, '0')}:${`${d.getMinutes()}`.padStart(2, '0')}`
}

export function parseDateInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

export function parseTimeInput(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  if (h > 23 || mm > 59) return null
  return { h, m: mm }
}

export function formatHeader(
  view: ViewMode,
  anchor: Date,
  weekStartsOn: number = 1,
): string {
  if (view === 'day') {
    return `${weekdayLong(anchor)}, ${monthLong(anchor)} ${anchor.getDate()}, ${anchor.getFullYear()}`
  }
  if (view === 'month') {
    return `${monthLong(anchor)} ${anchor.getFullYear()}`
  }
  const start = startOfWeek(anchor, weekStartsOn)
  const end = addDays(start, 6)
  if (isSameMonth(start, end)) {
    return `${monthLong(start)} ${start.getDate()} – ${end.getDate()}, ${end.getFullYear()}`
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
  }
  return `${monthShort(start)} ${start.getDate()}, ${start.getFullYear()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}

export function relativeDayLabel(d: Date, today = new Date()): string {
  if (isSameDay(d, today)) return 'Today'
  if (isSameDay(d, addDays(today, 1))) return 'Tomorrow'
  if (isSameDay(d, addDays(today, -1))) return 'Yesterday'
  return `${weekdayShort(d)}, ${monthShort(d)} ${d.getDate()}`
}
