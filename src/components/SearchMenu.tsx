import { useMemo, useState } from 'react'
import { Search, StickyNote } from 'lucide-react'
import { useApp } from '../store'
import { colorOf } from '../lib/colors'
import { formatClock, monthShort, weekdayShort } from '../lib/date'
import { useClickOutside } from '../hooks'
import { IconButton } from './ui'

export function SearchMenu() {
  const { events, calendars, settings, openEdit, selectDate } = useApp()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useClickOutside<HTMLDivElement>(open, () => {
    setOpen(false)
    setQuery('')
  })

  const calMap = useMemo(
    () => new Map(calendars.map((c) => [c.id, c])),
    [calendars],
  )

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return events
      .filter((e) => e.title.toLowerCase().includes(q))
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 8)
  }, [events, query])

  return (
    <div className="relative" ref={ref}>
      <IconButton
        label="Search"
        active={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Search className="h-[17px] w-[17px]" />
      </IconButton>

      {open && (
        <div className="animate-pop absolute right-0 z-50 mt-2 w-[320px] rounded-xl border border-[#e9e9e7] bg-white p-2 shadow-[0_12px_32px_rgba(16,24,40,0.14)]">
          <div className="flex items-center gap-2 rounded-lg bg-[#f5f5f3] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-[#8f8e8a]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events…"
              className="w-full bg-transparent text-[12.5px] placeholder:text-[#a3a29e]"
            />
          </div>

          <div className="mt-1.5 max-h-[280px] overflow-y-auto scroll-area">
            {query.trim() === '' && (
              <p className="px-2 py-3 text-[11.5px] text-[#a3a29e]">
                Type to find an event by name.
              </p>
            )}
            {query.trim() !== '' && results.length === 0 && (
              <p className="px-2 py-3 text-[11.5px] text-[#a3a29e]">
                No events match “{query}”.
              </p>
            )}
            {results.map((ev) => {
              const color = colorOf(calMap.get(ev.calendarId)?.color)
              const start = new Date(ev.start)
              return (
                <button
                  key={ev.id}
                  type="button"
                  onClick={() => {
                    selectDate(start)
                    openEdit(ev)
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#f7f7f5]"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: color.dot }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">
                    {ev.title || 'Untitled'}
                  </span>
                  <span className="shrink-0 text-[10.5px] text-[#8f8e8a]">
                    {weekdayShort(start)} {monthShort(start)} {start.getDate()},{' '}
                    {formatClock(start, settings.hour12)}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="mt-1 flex items-center gap-1.5 border-t border-[#f1f1ef] px-2 pt-2 text-[10.5px] text-[#a3a29e]">
            <StickyNote className="h-3 w-3" />
            Notes live in the right-hand panel.
          </div>
        </div>
      )}
    </div>
  )
}
