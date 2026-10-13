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
        className="animate-sheet flex max-h-[92vh] w-full max-w-[440px] flex-col overflow-hidden rounded-2xl border border-[#eceef2] bg-white shadow-[0_28px_70px_rgba(16,24,40,0.24),0_8px_20px_rgba(16,24,40,0.08)]"
      >
        <div className="flex items-center justify-between border-b border-[#f0f1f4] px-5 py-3.5">
          <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-[#1f2330]">
            {mode === 'create' ? 'New event' : 'Edit event'}
          </h2>
          <div className="flex items-center gap-1">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => deleteEvent(event.id)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-medium text-[#b4453c] transition hover:bg-[#fdf1f1]"
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

        <div className="scroll-area flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title"
            className="w-full rounded-xl border border-transparent bg-transparent px-3 py-2 text-[17px] font-semibold tracking-[-0.01em] text-[#1f2330] transition placeholder:font-medium placeholder:text-[#b6bbc7] hover:bg-[#fafbfc] focus:border-[#e8eaef] focus:bg-white focus:shadow-[0_0_0_3px_rgba(190,242,100,0.35)]"
          />

          <div>
            <span className="mb-1.5 block px-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#a5aab8]">
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
                        ? 'border-transparent shadow-[0_1px_2px_rgba(16,24,40,0.1)]'
                        : 'border-[#e8eaef] text-[#5b6172] hover:border-[#d4d8e0] hover:bg-[#fafbfc]',
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

          <div className="space-y-2">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#e8eaef] px-3 py-1.5 transition focus-within:border-[#c3e56a] focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.35)]">
              <CalendarDays className="h-4 w-4 shrink-0 text-[#a5aab8]" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent py-1 text-[13px] font-medium text-[#1f2330]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-[#e8eaef] px-3 py-1.5 transition focus-within:border-[#c3e56a] focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.35)]">
                <Clock className="h-4 w-4 shrink-0 text-[#a5aab8]" />
                <input
                  type="time"
                  step={900}
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full bg-transparent py-1 text-[13px] font-medium text-[#1f2330]"
                />
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-[#e8eaef] px-3 py-1.5 transition focus-within:border-[#c3e56a] focus-within:shadow-[0_0_0_3px_rgba(190,242,100,0.35)]">
                <Clock className="h-4 w-4 shrink-0 text-[#a5aab8]" />
                <input
                  type="time"
                  step={900}
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full bg-transparent py-1 text-[13px] font-medium text-[#1f2330]"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#f7f8fa] px-3.5 py-2.5 text-[11.5px] text-[#6b7183]">
            <span className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-[#a5aab8]" />
              {relativeDayLabel(parsedDate)}
            </span>
            <span className="rounded-full bg-[#eaf9bf] px-2 py-0.5 font-semibold text-[#4b6410]">
              {durationLabel}
            </span>
          </div>

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className="w-full resize-none rounded-xl border border-[#e8eaef] px-3 py-2 text-[12.5px] text-[#1f2330] transition placeholder:text-[#b6bbc7] focus:border-[#c3e56a] focus:shadow-[0_0_0_3px_rgba(190,242,100,0.35)]"
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#f0f1f4] px-5 py-3.5">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-[#5b6172] transition hover:bg-[#f4f5f8]"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-lg bg-[#bef264] px-4 py-2 text-[12.5px] font-semibold text-[#33400f] shadow-[0_1px_2px_rgba(16,24,40,0.14)] transition hover:bg-[#b1ee4d] active:scale-[0.98]"
          >
            {mode === 'create' ? 'Add event' : 'Save changes'}
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
