import type { EventColorId } from '../lib/colors'

/**
 * Demo data for the public product preview.
 *
 * This module is intentionally standalone: it imports nothing from the app
 * store, writes nothing to storage, and has no side effects. The preview in
 * the landing page is read-only and never reaches real user data.
 */

export interface DemoEvent {
  title: string
  /** 0 = Monday … 6 = Sunday, matching a Monday-first week. */
  day: number
  /** Start time in minutes from midnight. */
  start: number
  /** Duration in minutes. */
  duration: number
  color: EventColorId
}

export const DEMO_WEEK_TITLE = 'October 5 – 11'

export const DEMO_EVENTS: DemoEvent[] = [
  { title: 'Morning planning', day: 0, start: 9 * 60, duration: 30, color: 'lime' },
  { title: 'Design review', day: 0, start: 11 * 60 + 30, duration: 60, color: 'lime' },
  { title: 'Deep work block', day: 0, start: 14 * 60, duration: 90, color: 'purple' },
  { title: 'Team meeting', day: 1, start: 10 * 60, duration: 45, color: 'lime' },
  { title: 'Workshop', day: 1, start: 13 * 60, duration: 120, color: 'purple' },
  { title: 'Morning yoga', day: 2, start: 9 * 60, duration: 60, color: 'orange' },
  { title: '1:1 with Alex', day: 2, start: 15 * 60, duration: 45, color: 'lime' },
  { title: 'Study session', day: 3, start: 9 * 60 + 30, duration: 90, color: 'purple' },
  { title: 'Marketing sync', day: 3, start: 16 * 60, duration: 60, color: 'lime' },
  { title: 'Product review', day: 4, start: 10 * 60, duration: 120, color: 'lime' },
  { title: 'Lunch & learn', day: 4, start: 12 * 60 + 30, duration: 60, color: 'pink' },
  { title: 'Personal appointment', day: 5, start: 11 * 60, duration: 60, color: 'orange' },
  { title: 'Dinner with friends', day: 5, start: 19 * 60, duration: 120, color: 'pink' },
  { title: 'Weekly review', day: 6, start: 16 * 60, duration: 60, color: 'orange' },
  { title: 'Read a chapter', day: 6, start: 20 * 60 + 15, duration: 45, color: 'purple' },
]

export interface DemoNote {
  title: string
  body: string[]
  /** Label shown on the "Pin to day" control, when pinned. */
  pinned?: string
  /** Slight rotation, matching the sticky-note tilt used in the app. */
  tilt?: string
}

export const DEMO_NOTES: DemoNote[] = [
  {
    title: 'Grocery list',
    body: ['Oat milk', 'Spinach', 'Coffee beans', 'Rye bread'],
    tilt: '',
  },
  {
    title: 'Ideas',
    body: ['Add a focus timer to the planner.', 'Try a soft lime accent for highlights.'],
    tilt: '-rotate-[0.35deg]',
  },
  {
    title: 'Call back',
    body: ['Sam — invoice question before Friday.'],
    tilt: 'rotate-[0.3deg]',
  },
]

/** Monday-first day headers, matching `DEFAULT_SETTINGS.weekStartsOn`. */
export const DEMO_WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Day numbers used by the mini month calendar in the previews. */
export const DEMO_DAY_NUMBERS = [5, 6, 7, 8, 9, 10, 11]

export const DEMO_CALENDARS: Array<{
  name: string
  color: EventColorId
}> = [
  { name: 'Work', color: 'lime' },
  { name: 'Personal', color: 'orange' },
  { name: 'Study', color: 'purple' },
  { name: 'Social', color: 'pink' },
]

/** Format minutes-from-midnight as a short clock string. */
export function demoClock(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${`${h}`.padStart(2, '0')}:${`${m}`.padStart(2, '0')}`
}