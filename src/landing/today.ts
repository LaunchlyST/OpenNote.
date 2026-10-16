/**
 * "Today" for the landing-page previews, in the visitor's own time zone, so
 * the sample calendar always opens on the current week — like the app icon.
 * The sample events keep their weekday and time; only the dates move.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export interface PreviewCell {
  n: number
  inMonth: boolean
  /** Stable key for the date, `y-m-d`. */
  key: string
}

const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function previewToday(now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayIndex = (today.getDay() + 6) % 7 // Monday-first
  const monday = addDays(today, -todayIndex)
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const sunday = week[6]

  const month = today.getMonth()
  const year = today.getFullYear()
  const first = new Date(year, month, 1)
  const gridStart = addDays(first, -((first.getDay() + 6) % 7))
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const rows = Math.ceil((((first.getDay() + 6) % 7) + daysInMonth) / 7)
  const cells = (count: number): PreviewCell[] =>
    Array.from({ length: count }, (_, i) => {
      const d = addDays(gridStart, i)
      return { n: d.getDate(), inMonth: d.getMonth() === month, key: keyOf(d) }
    })

  const weekTitle =
    monday.getMonth() === sunday.getMonth()
      ? `${MONTHS[monday.getMonth()]} ${monday.getDate()} – ${sunday.getDate()}`
      : `${MONTHS[monday.getMonth()].slice(0, 3)} ${monday.getDate()} – ${MONTHS[sunday.getMonth()].slice(0, 3)} ${sunday.getDate()}`

  return {
    todayIndex,
    todayKey: keyOf(today),
    dayNumber: today.getDate(),
    weekNumbers: week.map((d) => d.getDate()),
    weekKeys: week.map(keyOf),
    keyAfterMonday: (n: number) => keyOf(addDays(monday, n)),
    year: String(year),
    monthName: MONTHS[month],
    weekTitle,
    dayTitle: `${WEEKDAYS_LONG[todayIndex]}, ${MONTHS[month]} ${today.getDate()}`,
    miniCells: cells(42),
    monthCells: cells(rows * 7),
    monthRows: rows,
  }
}

export const PREVIEW_TODAY = previewToday()
