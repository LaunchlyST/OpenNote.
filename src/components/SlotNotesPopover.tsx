import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarPlus, Check, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useApp } from '../store'
import type { SlotNote } from '../lib/types'
import { dateKey, formatClock, fromMinutes, monthShort, weekdayShort } from '../lib/date'
import { uid } from '../lib/id'
import { cn } from '../lib/id'
import {
  MAX_SLOT_NOTES,
  SLOT_MINUTES,
  groupSlotNotes,
  minutesToTime,
} from '../lib/slots'

export interface SlotTarget {
  day: Date
  /** Visible row the click landed in, in minutes of the day: [rangeStart, rangeEnd). */
  rangeStart: number
  rangeEnd: number
  /** The 5-minute slot being edited. */
  slot: number
  /** Viewport point to anchor the popover at. */
  x: number
  y: number
  /** A note to focus on open (e.g. one just created by double-click). */
  focusId?: string
}

/**
 * Small popover for one 5-minute slot: lists its notes (up to three), lets you
 * add, edit and delete them, and still offers "New event" so clicking the
 * grid keeps creating events as before.
 */
export function SlotNotesPopover({
  target,
  onClose: close,
}: {
  target: SlotTarget
  onClose: () => void
}) {
  const { slotNotes: notes, addSlotNote, updateSlotNote, deleteSlotNote, openCreate, settings } = useApp()
  const [slot, setSlot] = useState(target.slot)
  // A note made by double-click and closed without any text is discarded,
  // so stray double-clicks never leave empty notes behind.
  const notesRef = useRef(notes)
  notesRef.current = notes
  const onClose = useCallback(() => {
    const id = target.focusId
    const created = id ? notesRef.current.find((n) => n.id === id) : undefined
    if (created && !created.title.trim()) deleteSlotNote(created.id)
    close()
  }, [target.focusId, deleteSlotNote, close])
  const [focusId, setFocusId] = useState<string | null>(target.focusId ?? null)
  const ref = useRef<HTMLDivElement | null>(null)
  const [pos, setPos] = useState({ left: target.x, top: target.y })

  const key = dateKey(target.day)
  const dayNotes = useMemo(() => groupSlotNotes(notes).get(key) ?? new Map<number, SlotNote[]>(), [notes, key])
  const list = dayNotes.get(slot) ?? []
  const full = list.length >= MAX_SLOT_NOTES

  const slots = useMemo(() => {
    const out: number[] = []
    for (let m = target.rangeStart; m < target.rangeEnd; m += SLOT_MINUTES) out.push(m)
    return out
  }, [target.rangeStart, target.rangeEnd])

  const clock = (min: number) => formatClock(fromMinutes(target.day, min), settings.hour12)
  const slotLabel = (min: number) => `${clock(min)}–${clock(min + SLOT_MINUTES)}`

  // Keep the popover on screen.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const left = Math.max(8, Math.min(target.x, window.innerWidth - r.width - 8))
    const top = Math.max(8, Math.min(target.y, window.innerHeight - r.height - 8))
    setPos({ left, top })
  }, [target.x, target.y, list.length, slot])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    // Defer so the click that opened the popover does not close it.
    const t = window.setTimeout(() => document.addEventListener('pointerdown', onDown), 0)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  const add = () => {
    if (full) return
    const id = uid('note')
    addSlotNote({ id, date: key, time: minutesToTime(slot), title: '' })
    setFocusId(id)
  }

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Notes for ${slotLabel(slot)}`}
      className="animate-rise fixed z-[70] w-[300px] rounded-2xl border border-[#ececea] bg-white p-3 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.3)]"
      style={pos}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#a3a29e]">
            {weekdayShort(target.day)} {target.day.getDate()} {monthShort(target.day)}
          </p>
          {slots.length > 1 ? (
            <select
              aria-label="Time slot"
              value={slot}
              onChange={(e) => setSlot(Number(e.target.value))}
              className="mt-0.5 max-w-full rounded-md bg-transparent text-[14px] font-semibold text-[#191919] outline-none hover:bg-[#f3f3f1]"
            >
              {slots.map((m) => {
                const n = dayNotes.get(m)?.length ?? 0
                return (
                  <option key={m} value={m}>
                    {slotLabel(m)}
                    {n ? ` · ${n} note${n === 1 ? '' : 's'}` : ''}
                  </option>
                )
              })}
            </select>
          ) : (
            <p className="mt-0.5 text-[14px] font-semibold text-[#191919]">{slotLabel(slot)}</p>
          )}
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#8f8e8a] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-[11.5px] text-[#8f8e8a]" data-testid="slot-count">
        {list.length} of {MAX_SLOT_NOTES} notes saved
      </p>

      <ul className="mt-2 space-y-1.5">
        {list.map((n, i) => (
          <li key={n.id} className="rounded-xl border border-[#cdeadb] bg-[#e9f7ef] px-2 py-1.5">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                role="checkbox"
                aria-checked={!!n.done}
                aria-label={`Note ${i + 1} done`}
                onClick={() => updateSlotNote(n.id, { done: !n.done })}
                className={cn(
                  'grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border transition',
                  n.done ? 'border-[#2f8f5f] bg-[#2f8f5f] text-white' : 'border-[#8cc2a5] bg-white hover:border-[#2f8f5f]',
                )}
              >
                {n.done && <Check className="h-2.5 w-2.5" strokeWidth={3.5} />}
              </button>
              <input
                aria-label={`Note ${i + 1}`}
                autoFocus={n.id === focusId}
                value={n.title}
                placeholder="Write a note…"
                maxLength={200}
                onChange={(e) => updateSlotNote(n.id, { title: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                }}
                className={cn(
                  'min-w-0 flex-1 bg-transparent text-[12.5px] font-medium text-[#17352a] outline-none placeholder:text-[#8fb5a0]',
                  n.done && 'text-[#6f8f7d] line-through',
                )}
              />
              <button
                type="button"
                aria-label={`Delete note ${i + 1}`}
                onClick={() => deleteSlotNote(n.id)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#6f9c84] transition hover:bg-white hover:text-[#dc2626]"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <input
              aria-label={`Note ${i + 1} description`}
              value={n.body ?? ''}
              placeholder="Add a description (optional)"
              maxLength={300}
              onChange={(e) => updateSlotNote(n.id, { body: e.target.value || undefined })}
              className="mt-0.5 w-full bg-transparent pl-5 text-[11.5px] text-[#4c7a63] outline-none placeholder:text-[#9cc0ab]"
            />
          </li>
        ))}
        {list.length === 0 && (
          <li className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-[12px] text-[#a3a29e]">
            <StickyNote className="h-3.5 w-3.5" /> No notes in this slot yet.
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={full}
          title={full ? `A slot holds up to ${MAX_SLOT_NOTES} notes` : undefined}
          className={cn(
            'inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-[12.5px] font-semibold transition',
            full
              ? 'cursor-not-allowed bg-[#f3f3f1] text-[#a3a29e]'
              : 'bg-[#191919] text-white hover:bg-[#37352f]',
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          {full ? 'Slot full (3/3)' : list.length ? 'Add another note' : 'Add note'}
        </button>
        <button
          type="button"
          onClick={() => {
            onClose()
            openCreate(fromMinutes(target.day, slot), 60)
          }}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e3e3e0] px-2.5 text-[12.5px] font-medium text-[#37352f] transition hover:bg-[#f7f7f5]"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Event
        </button>
      </div>
    </div>,
    document.body,
  )
}
