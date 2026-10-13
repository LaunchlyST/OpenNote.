import type { EventColorId } from './colors'

export type ViewMode = 'day' | 'week' | 'month'

export interface Calendar {
  id: string
  name: string
  color: EventColorId
  visible: boolean
}

export interface CalendarEvent {
  id: string
  title: string
  /** ISO timestamp */
  start: string
  /** ISO timestamp */
  end: string
  calendarId: string
  notes?: string
  /** Demo data. Refreshed each week; events the user creates or edits are not. */
  seeded?: boolean
}

export interface Note {
  id: string
  title: string
  body: string
  /** yyyy-mm-dd */
  date?: string
  /** HH:mm */
  time?: string
  createdAt: number
}

export interface Settings {
  /** 0 = Sunday, 1 = Monday */
  weekStartsOn: 0 | 1
  hour12: boolean
  showWeekends: boolean
  /** pixel height of one hour row */
  hourHeight: number
}
