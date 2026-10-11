import type { Calendar, CalendarEvent, Note, Settings } from './types'
import { addDays, startOfWeek } from './date'
import { uid } from './id'

export const DEFAULT_SETTINGS: Settings = {
  weekStartsOn: 1,
  hour12: false,
  showWeekends: true,
  hourHeight: 56,
}

export function seedCalendars(): Calendar[] {
  return [
    { id: 'cal_work', name: 'Work', color: 'lime', visible: true },
    { id: 'cal_personal', name: 'Personal', color: 'orange', visible: true },
    { id: 'cal_study', name: 'Study', color: 'purple', visible: true },
    { id: 'cal_social', name: 'Social', color: 'pink', visible: true },
  ]
}

function slot(day: Date, hour: number, minute: number, duration: number) {
  const start = new Date(day)
  start.setHours(hour, minute, 0, 0)
  const end = new Date(start.getTime() + duration * 60_000)
  return { start: start.toISOString(), end: end.toISOString() }
}

export function seedEvents(): CalendarEvent[] {
  const ws = startOfWeek(new Date(), 1)
  const d = (i: number) => addDays(ws, i)
  const make = (
    title: string,
    calendarId: string,
    day: Date,
    hour: number,
    minute: number,
    duration: number,
  ): CalendarEvent => ({
    id: uid('evt'),
    title,
    calendarId,
    ...slot(day, hour, minute, duration),
  })

  return [
    make('Team stand-up', 'cal_work', d(0), 9, 0, 30),
    make('Design review', 'cal_work', d(0), 11, 30, 60),
    make('Deep work block', 'cal_study', d(0), 14, 0, 90),
    make('Client call', 'cal_work', d(1), 10, 0, 45),
    make('Workshop', 'cal_study', d(1), 13, 0, 120),
    make('Morning yoga', 'cal_personal', d(2), 8, 30, 60),
    make('1:1 with Alex', 'cal_work', d(2), 15, 0, 45),
    make('Sprint planning', 'cal_work', d(3), 9, 30, 90),
    make('Marketing sync', 'cal_work', d(3), 16, 0, 60),
    make('Product review', 'cal_work', d(4), 10, 0, 120),
    make('Lunch & learn', 'cal_social', d(4), 12, 30, 60),
    make('Dinner with friends', 'cal_social', d(5), 19, 0, 120),
    make('Errands', 'cal_personal', d(5), 11, 0, 60),
    make('Plan the week', 'cal_personal', d(6), 18, 0, 60),
    make('Read a chapter', 'cal_study', d(6), 20, 0, 45),
  ]
}

export function seedNotes(): Note[] {
  const now = Date.now()
  return [
    {
      id: uid('note'),
      title: 'Grocery list',
      body: 'Oat milk\nSpinach\nCoffee beans\nRye bread',
      createdAt: now - 4000,
    },
    {
      id: uid('note'),
      title: 'Ideas',
      body: 'Add a focus timer to the planner.\nTry a soft lime accent for highlights.',
      createdAt: now - 3000,
    },
    {
      id: uid('note'),
      title: 'Call back',
      body: 'Sam — invoice question before Friday.',
      createdAt: now - 2000,
    },
    {
      id: uid('note'),
      title: 'Inspiration',
      body: 'Minimal, airy layout. Thin hairlines. Let the colours do the talking.',
      createdAt: now - 1000,
    },
  ]
}
