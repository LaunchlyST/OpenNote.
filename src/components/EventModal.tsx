import { useState } from 'react'
import type { ReactNode } from 'react'
import { Clock, Trash2, X } from 'lucide-react'
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

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8b90a0]">
        {label}
      </span>
      <span className="block">{children}</span>
    </label>
  )
}

const inputClass =
  'w-full rounded-lg border border-[#e8eaef] px-2.5 py-2 text-[12.5px] text-[#1f2330] transition focus:border-[#c3e56a] focus:ring-2 focus:ring-[#eaf9bf]'

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
      className="animate-fade fixed inset-0 z-[60] flex items-center justify-center bg-[#0b0f19]/25 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal()
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="animate-pop w-full max-w-[460px] rounded-2xl border border-[#eceef2] bg-white shadow-[0_24px_60px_rgba(16,24,40,0.25)]"
      >
        <div className="flex items-center justify-between border-b border-[#f0f1f4] px-5 py-3">
          <h2 className="text-[13.5px] font-semibold">
            {mode === 'create' ? 'New event' : 'Edit event'}
          </h2>
          <div className="flex items-center gap-1">
            {mode === 'edit' && (
              <button
                type="button"
                onClick={() => deleteEvent(event.id)}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-[#c0392b] transition hover:bg-[#fdf1f1]"
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

        <div className="space-y-3.5 px-5 py-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a title"
            className="w-full rounded-xl border border-[#e8eaef] px-3 py-2.5 text-[14px] font-medium placeholder:text-[#b6bbc7] transition focus:border-[#c3e56a] focus:ring-2 focus:ring-[#eaf9bf]"
          />

          <div>
            <span className="mb-1.5 block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8b90a0]">
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
                      'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition',
                      active
                        ? 'border-transparent shadow-[0_1px_2px_rgba(16,24,40,0.08)] ring-1 ring-inset'
                        : 'border-[#e8eaef] text-[#5b6172] hover:bg-[#fafbfc]',
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

          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Start">
              <input
                type="time"
                step={900}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="End">
              <input
                type="time"
                step={900}
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-[#fafbfc] px-3 py-2 text-[11.5px] text-[#6b7183]">
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#8b90a0]" />
              {relativeDayLabel(parsedDate)}
            </span>
            <span className="font-medium text-[#4b6410]">{durationLabel}</span>
          </div>

          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            className={cn(inputClass, 'resize-none')}
          />

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-lg px-3 py-2 text-[12.5px] font-medium text-[#5b6172] transition hover:bg-[#f4f5f8]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#bef264] px-4 py-2 text-[12.5px] font-semibold text-[#3f4a14] shadow-[0_1px_2px_rgba(16,24,40,0.1)] transition hover:bg-[#b1ee4d] active:scale-[0.98]"
            >
              {mode === 'create' ? 'Add event' : 'Save changes'}
            </button>
          </div>
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
