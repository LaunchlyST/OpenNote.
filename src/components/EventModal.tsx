import { useState } from 'react'
import { CalendarDays, Clock, Trash2, X } from 'lucide-react'
import { useApp } from '../store'
import type { CalendarEvent } from '../lib/types'
import { colorOf } from '../lib/colors'
import {
  parseDateInput,
  parseTimeInput,
  relativeDayLabel,
  toDateInput,
  toTimeInput,
} from '../lib/date'
import { cn } from '../lib/id'
import { useEscape } from '../hooks'
import { IconButton } from './ui'

function EventModalBody({
  event,
  mode,
}: {
  event: CalendarEvent
  mode: 'create' | 'edit'
}) {
  const { calendars, closeModal, saveEvent, deleteEvent } = useApp()
  const start = new Date(event.start)
  const end = new Date(event.end)

  const [title, setTitle] = useState(event.title)
  const [calendarId, setCalendarId] = useState(event.calendarId)
  const [date, setDate] = useState(toDateInput(start))
  const [startTime, setStartTime] = useState(toTimeInput(start))
  const [endTime, setEndTime] = useState(toTimeInput(end))
  const [notes, setNotes] = useState(event.notes ?? '')

  useEscape(true, closeModal)

  const st = parseTimeInput(startTime)
  const et = parseTimeInput(endTime)
  let duration = 60
  if (st && et) {
    duration = et.h * 60 + et.m - (st.h * 60 + st.m)
    if (duration <= 0) duration += 24 * 60
  }
  const hours = Math.floor(duration / 60)
  const mins = duration % 60
  const durationLabel = `${hours > 0 ? `${hours} h ` : ''}${mins > 0 ? `${mins} min` : hours > 0 ? '' : '0 min'}`

  const parsedDate = parseDateInput(date) ?? start

  const handleSubmit = () => {
    const baseDay = parseDateInput(date) ?? start
    const newStart = new Date(baseDay)
    if (st) newStart.setHours(st.h, st.m, 0, 0)
    const newEnd = new Date(baseDay)
    if (et) newEnd.setHours(et.h, et.m, 0, 0)
    if (newEnd.getTime() <= newStart.getTime()) {
      newEnd.setTime(newStart.getTime() + 30 * 60_000)
    }
    saveEvent({
      ...event,
      title: title.trim() || 'Untitled',
      calendarId,
      start: newStart.toISOString(),
      end: newEnd.toISOString(),
      notes: notes.trim() ? notes : undefined,
    })
  }

  return (
    <div
      className="animate-scrim fixed inset-0 z-[60] flex items-start justify-end bg-black/10 p-4 backdrop-blur-[2px] sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="animate-sheet flex max-h-[92vh] w-full max-w-[400px] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_32px_64px_-16px_rgba(16,24,40,0.32)] sm:mt-2"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.08em] text-muted">
            {mode === 'create' ? 'New Event' : 'Edit Event'}
          </h2>
          <div className="flex items-center gap-1">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => deleteEvent(event.id)}
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium text-red-500 transition hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <IconButton label="Close" onClick={closeModal}>
              <X className="h-4 w-4" />
            </IconButton>
          </div>
        </div>

        {/* Body */}
        <div className="scroll-area flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Title */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title"
            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2.5 text-[19px] font-bold tracking-[-0.02em] text-ink transition placeholder:font-medium placeholder:text-ghost hover:bg-surface focus:border-line focus:bg-white focus:shadow-[0_0_0_3px_rgba(190,242,100,0.3)]"
          />

          {/* Calendar selection */}
          <div>
            <span className="mb-2 block px-1 text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
              Calendar
            </span>
            <div className="flex flex-wrap gap-1.5">
              {calendars.map((c) => {
                const color = colorOf(c.color)
                const active = calendarId === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCalendarId(c.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                      active
                        ? 'border-transparent font-semibold shadow-sm'
                        : 'border-line text-ink-soft hover:border-border-strong hover:bg-surface',
                    )}
                    style={
                      active
                        ? {
                            background: color.bg,
                            color: color.text,
                            boxShadow: `inset 0 0 0 1px ${color.border}`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: color.dot }}
                    />
                    {c.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date & Time */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-line px-3.5 py-2.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.3)]">
              <CalendarDays className="h-4 w-4 shrink-0 text-faint" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent py-0.5 text-[13px] font-medium text-ink"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.3)]">
                <Clock className="h-4 w-4 shrink-0 text-faint" />
                <input
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-transparent py-0.5 text-[13px] font-medium text-ink"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-line px-3.5 py-2.5 transition focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.3)]">
                <Clock className="h-4 w-4 shrink-0 text-faint" />
                <input
                  type="time"
                  step={900}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-transparent py-0.5 text-[13px] font-medium text-ink"
                />
              </div>
            </div>
          </div>

          {/* Duration indicator */}
          <div className="flex items-center justify-between rounded-xl bg-surface px-4 py-3 text-[12px] text-ink-soft">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-faint" />
              {relativeDayLabel(parsedDate)}
            </span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold text-accent-text">
              {durationLabel}
            </span>
          </div>

          {/* Notes */}
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes (optional)"
            className="w-full resize-none rounded-xl border border-line px-3.5 py-2.5 text-[12.5px] text-ink transition placeholder:text-ghost focus:border-accent focus:shadow-[0_0_0_3px_rgba(190,242,100,0.3)]"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 border-t border-line px-5 py-3.5">
          <button
            type="submit"
            className="flex-1 rounded-xl bg-charcoal px-5 py-2.5 text-[12.5px] font-semibold text-white shadow-[0_8px_20px_-8px_rgba(45,49,66,0.7)] transition hover:bg-charcoal-light active:scale-[0.98]"
          >
            {mode === 'create' ? 'Add Event' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={closeModal}
            className="rounded-xl border border-line px-4 py-2.5 text-[12.5px] font-medium text-ink-soft transition hover:bg-surface active:scale-[0.98]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export function EventModal() {
  const { modal } = useApp()
  if (!modal) return null
  return (
    <EventModalBody
      key={modal.event.id}
      event={modal.event}
      mode={modal.mode}
    />
  )
}