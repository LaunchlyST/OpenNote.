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
  /** The view the calendar opens on. */
  defaultView: ViewMode
  /** Suppresses the interface's entry animations for the whole app. */
  reduceMotion: boolean
  /** Calendar vertical zoom: index into ZOOM_LEVELS (0 = 1-hour rows). */
  zoomLevel?: number
  /** Whether the left sidebar starts collapsed. */
  sidebarCollapsed: boolean
  /**
   * Two-step sign-in preference. Remembered per browser; sign-in runs locally
   * so there is no second factor to verify against yet.
   */
  twoFactor: boolean
}
