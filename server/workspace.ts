/**
 * Validates a workspace before it is saved. The server is the last line of
 * defence: whatever the browser sends, only well-formed calendar data of a
 * sane size reaches the database. Unknown extra fields are allowed (the app
 * adds some over time); wrong types and absurd sizes are not.
 */

const MAX_ITEMS = 20_000
const MAX_TEXT = 20_000
const MAX_SHORT = 500

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, max = MAX_SHORT) => typeof v === 'string' && v.length <= max
const optStr = (v: unknown, max = MAX_SHORT) => v === undefined || str(v, max)
const isoDate = (v: unknown) => str(v, 40) && !Number.isNaN(Date.parse(v as string))

function event(e: unknown): string | null {
  if (!isObj(e)) return 'event is not an object'
  if (!str(e.id, 100) || !str(e.calendarId, 100)) return 'event id/calendarId'
  if (!str(e.title)) return 'event title'
  if (!isoDate(e.start) || !isoDate(e.end)) return 'event start/end must be dates'
  if (Date.parse(e.end as string) < Date.parse(e.start as string)) return 'event ends before it starts'
  if (!optStr(e.notes, MAX_TEXT)) return 'event notes'
  return null
}

function calendar(c: unknown): string | null {
  if (!isObj(c)) return 'calendar is not an object'
  if (!str(c.id, 100) || !str(c.name, 200) || !str(c.color, 40)) return 'calendar id/name/color'
  if (typeof c.visible !== 'boolean') return 'calendar visible'
  return null
}

function note(n: unknown): string | null {
  if (!isObj(n)) return 'note is not an object'
  if (!str(n.id, 100) || !str(n.title) || !str(n.body, MAX_TEXT)) return 'note id/title/body'
  // A note belongs to exactly one day, written as yyyy-mm-dd.
  if (n.date !== undefined && !(typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date))) return 'note date'
  if (n.time !== undefined && !(typeof n.time === 'string' && /^\d{2}:\d{2}$/.test(n.time))) return 'note time'
  if (typeof n.createdAt !== 'number') return 'note createdAt'
  return null
}

function slotNote(n: unknown): string | null {
  if (!isObj(n)) return 'slot note is not an object'
  if (!str(n.id, 100) || !str(n.title)) return 'slot note id/title'
  if (!(typeof n.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(n.date))) return 'slot note date'
  if (!(typeof n.time === 'string' && /^\d{2}:\d{2}$/.test(n.time))) return 'slot note time'
  if (typeof n.createdAt !== 'number') return 'slot note createdAt'
  return null
}

export function validateWorkspace(data: unknown): string | null {
  if (!isObj(data)) return 'workspace is not an object'
  const { events, calendars, notes, settings } = data
  if (!Array.isArray(events) || !Array.isArray(calendars) || !Array.isArray(notes)) return 'missing lists'
  if (!isObj(settings)) return 'settings'
  if (events.length > MAX_ITEMS || notes.length > MAX_ITEMS || calendars.length > 200) return 'too many items'
  for (const e of events) {
    const err = event(e)
    if (err) return err
  }
  for (const c of calendars) {
    const err = calendar(c)
    if (err) return err
  }
  for (const n of notes) {
    const err = note(n)
    if (err) return err
  }
  // Calendar time-slot notes: optional (older saves have none), kept apart from notes.
  const { slotNotes } = data
  if (slotNotes !== undefined) {
    if (!Array.isArray(slotNotes) || slotNotes.length > MAX_ITEMS) return 'slot notes'
    for (const n of slotNotes) {
      const err = slotNote(n)
      if (err) return err
    }
  }
  if (Array.isArray(notes) && notes.some((n) => isObj(n) && n.showOnCalendar !== undefined && typeof n.showOnCalendar !== 'boolean')) return 'note showOnCalendar'
  return null
}
