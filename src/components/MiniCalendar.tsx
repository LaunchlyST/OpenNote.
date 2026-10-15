import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useApp } from '../store'
import {
  dateKey,
  isSameDay,
  isSameMonth,
  monthLong,
  monthMatrix,
  weekdayShort,
} from '../lib/date'
import { cn } from '../lib/id'

const ARROW =
  'grid h-7 w-7 place-items-center rounded-lg text-[#8f8e8a] transition hover:bg-[#eef0f4] hover:text-[#191919] active:scale-95'

export function MiniCalendar() {
  const { selectedDate, selectDate, events, calendars, settings } = useApp()
  const [cursor, setCursor] = useState(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
  )

  // Follow the main calendar when the selected month changes.
  useEffect(() => {
    setCursor((prev) =>
      prev.getFullYear() === selectedDate.getFullYear() &&
      prev.getMonth() === selectedDate.getMonth()
        ? prev
        : new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
    )
  }, [selectedDate])

  const visible = useMemo(
    () => new Set(calendars.filter((c) => c.visible).map((c) => c.id)),
    [calendars],
  )

  const eventDays = useMemo(() => {
    const set = new Set<string>()
    for (const ev of events) {
      if (!visible.has(ev.calendarId)) continue
      set.add(dateKey(new Date(ev.start)))
    }
    return set
  }, [events, visible])

  const cells = useMemo(
    () =>
      monthMatrix(
        cursor.getFullYear(),
        cursor.getMonth(),
        settings.weekStartsOn,
      ),
    [cursor, settings.weekStartsOn],
  )

  const today = new Date()

  return (
    <div className="border-b border-[#ececea] px-3 pb-4 pt-4">
      <div className="mb-3 flex items-center justify-between px-0.5">
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#191919]">
          {monthLong(cursor)}{' '}
          <span className="font-normal text-[#8f8e8a]">{cursor.getFullYear()}</span>
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() - 1, 1),
              )
            }
            className={ARROW}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() =>
              setCursor(
                (c) => new Date(c.getFullYear(), c.getMonth() + 1, 1),
              )
            }
            className={ARROW}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mb-1 grid grid-cols-7">
        {cells.slice(0, 7).map((d, i) => (
          <span
            key={i}
            className="grid h-6 place-items-center text-[10px] font-semibold uppercase tracking-[0.04em] text-[#a3a29e]"
          >
            {weekdayShort(d).charAt(0)}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((d) => {
          const selected = isSameDay(d, selectedDate)
          const isToday = isSameDay(d, today)
          const inMonth = isSameMonth(d, cursor)
          const hasEvents = eventDays.has(dateKey(d))
          return (
            <button
              key={d.toISOString()}
              type="button"
              aria-label={d.toDateString()}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => selectDate(d)}
              className="group grid h-8 place-items-center"
            >
              <span
                className={cn(
                  'relative grid h-7 w-7 place-items-center rounded-full text-[12px] tabular-nums transition-all duration-150',
                  selected
                    ? 'bg-[#191919] font-semibold text-white shadow-[0_2px_6px_-1px_rgba(0,0,0,0.35)]'
                    : isToday
                      ? 'font-semibold text-[#5d7a0f] ring-1 ring-[#cbe98a] hover:bg-[#f2f8e0]'
                      : inMonth
                        ? 'font-medium text-[#37352f] group-hover:bg-[#eef0f4] group-hover:text-[#191919]'
                        : 'font-medium text-[#ccd0d9] group-hover:bg-[#f5f6f8]',
                )}
              >
                {d.getDate()}
                {hasEvents && !selected && (
                  <span
                    className={cn(
                      'absolute bottom-[3px] h-[3px] w-[3px] rounded-full',
                      inMonth ? 'bg-[#a3d922]' : 'bg-[#dcdbd7]',
                    )}
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}