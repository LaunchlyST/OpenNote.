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
      className="animate-scrim fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0f19]/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="animate-sheet flex max-h-[92vh] w-full max-w-[400px] flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_80px_-20px_rgba(16,24,40,0.35),0_0_0_1px_rgba(16,24,40,0.05)]"
      >
        <div className="flex items-start gap-2 px-5 pt-5">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title"
            style={{ outline: 'none' }}
            className="min-w-0 flex-1 bg-transparent text-[20px] font-semibold tracking-[-0.02em] text-[#191919] outline-none placeholder:text-[#c4c3be]"
          />
          <IconButton label="Close" onClick={closeModal}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="scroll-area flex-1 space-y-3 overflow-y-auto px-5 pb-2 pt-4">
          <div className="flex items-center gap-3">
            <CalendarDays className="h-[18px] w-[18px] shrink-0 text-[#6b6a66]" />
            <div className="flex items-center gap-2.5 rounded-xl bg-[#f5f5f3] px-3 py-2 transition focus-within:bg-white focus-within:shadow-[0_0_0_1.5px_#191919] flex-1">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent text-[13px] font-medium text-[#191919] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Clock className="h-[18px] w-[18px] shrink-0 text-[#6b6a66]" />
            <div className="grid flex-1 grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 rounded-xl bg-[#f5f5f3] px-3 py-2 transition focus-within:bg-white focus-within:shadow-[0_0_0_1.5px_#191919]">
                <input
                  type="time"
                  step={900}
                  aria-label="Start time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-transparent text-[13px] font-medium text-[#191919] outline-none"
                />
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#f5f5f3] px-3 py-2 transition focus-within:bg-white focus-within:shadow-[0_0_0_1.5px_#191919]">
                <input
                  type="time"
                  step={900}
                  aria-label="End time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-transparent text-[13px] font-medium text-[#191919] outline-none"
                />
              </div>
            </div>
          </div>

          <p className="pl-[30px] text-[11.5px] text-[#8f8e8a]">
            {relativeDayLabel(parsedDate)} · {durationLabel}
          </p>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {calendars.map((c) => {
              const color = colorOf(c.color)
              const active = calendarId === c.id
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCalendarId(c.id)}
                  className={cn(
                    'rounded-[10px] px-3 py-1.5 text-[12px] font-medium transition-all duration-150',
                    active ? 'shadow-[0_0_0_1.5px_currentColor]' : 'opacity-70 hover:opacity-100',
                  )}
                  style={{ background: color.bg, color: color.text }}
                >
                  {c.name}
                </button>
              )
            })}
          </div>

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full resize-none rounded-xl bg-[#f5f5f3] px-3 py-2.5 text-[12.5px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:bg-white focus:shadow-[0_0_0_1.5px_#191919]"
          />
        </div>

        <div className="flex items-center gap-2 px-5 pb-5 pt-3">
          <button
            type="submit"
            className="h-11 flex-1 rounded-[12px] bg-[#191919] text-[13.5px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)] transition hover:bg-[#37352f] active:scale-[0.99]"
          >
            {mode === 'create' ? 'Add event' : 'Save changes'}
          </button>
          {mode === 'edit' ? (
            <button
              type="button"
              aria-label="Delete event"
              title="Delete event"
              onClick={() => deleteEvent(event.id)}
              className="grid h-11 w-11 place-items-center rounded-[12px] bg-[#191919] text-white transition hover:bg-[#b4453c]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={closeModal}
              className="h-11 rounded-[12px] px-3.5 text-[13px] font-medium text-[#5f5e5b] transition hover:bg-[#f5f5f3]"
            >
              Cancel
            </button>
          )}
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
