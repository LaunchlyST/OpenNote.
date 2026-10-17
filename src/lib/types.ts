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

/**
 * A Notes-section document: title + description, optionally linked to a day.
 * It never has a time and never renders inside the calendar grid; a dated
 * note only shows as a small "Notes (n)" badge on its day header.
 */
export interface Note {
  id: string
  title: string
  body: string
  /** yyyy-mm-dd — optional link to a day. */
  date?: string
  /** Whether a dated note shows its badge on the calendar (default true). */
  showOnCalendar?: boolean
  /** Legacy: older notes carried a time. Migrated away on load; never set now. */
  time?: string
  createdAt: number
}

/** A calendar time-slot note: lives in one 5-minute slot of one day (max 3 per slot). */
export interface SlotNote {
  id: string
  /** yyyy-mm-dd */
  date: string
  /** HH:mm, start of its 5-minute slot */
  time: string
  title: string
  /** Optional short description. */
  body?: string
  /** Ticked off on its card. */
  done?: boolean
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
  /** Default zoom level (index into ZOOM_LEVELS) a project opens at. */
  defaultZoom?: number
  /** Re-open at the last zoom used instead of the default. */
  rememberZoom?: boolean
  /** Hour the calendar scrolls to on open (0–23). */
  dayStartHour?: number
  /** Hour after which the grid is shaded as outside your day (1–24). */
  dayEndHour?: number
  /** Mark today's column and header. */
  highlightToday?: boolean
  /** Show the red current-time line. */
  showNowLine?: boolean
  /** Show sub-hour lines and alternating slot shading. */
  showGridLines?: boolean
  /** Whether the left sidebar starts collapsed. */
  sidebarCollapsed: boolean
  /**
   * Two-step sign-in preference. Remembered per browser; sign-in runs locally
   * so there is no second factor to verify against yet.
   */
  twoFactor: boolean
}
