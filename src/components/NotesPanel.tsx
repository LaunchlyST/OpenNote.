import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CalendarPlus, Clock, GripVertical, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { useApp } from '../store'
import type { Note } from '../lib/types'
import {
  dateKey,
  monthShort,
  parseDateInput,
  relativeDayLabel,
} from '../lib/date'
import { cn } from '../lib/id'

const TILT = ['', '-rotate-[0.35deg]', 'rotate-[0.3deg]']

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  // Never collapse to nothing: a measurement taken while the panel is still
  // zero-width would otherwise lock the field at 0px forever.
  el.style.height = `${Math.max(el.scrollHeight, 24)}px`
}

function NoteCard({
  note,
  index,
  isDragging,
  isDropTarget,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  note: Note
  index: number
  isDragging: boolean
  isDropTarget: boolean
  onDragStart: (index: number) => void
  onDragOver: (index: number) => void
  onDrop: (index: number) => void
  onDragEnd: () => void
}) {
  const { updateNote, deleteNote, selectedDate } = useApp()
  const [showMeta, setShowMeta] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = bodyRef.current
    const card = cardRef.current
    if (!el) return
    autoGrow(el)
    if (!card) return
    // Re-grow whenever the card is resized. The body text can already be set
    // while the panel is unmounted or zero-width, and without this the height
    // measured at that point would stick even after the panel becomes visible.
    const ro = new ResizeObserver(() => autoGrow(el))
    ro.observe(card)
    return () => ro.disconnect()
  }, [note.body])

  const pinned = note.date ? parseDateInput(note.date) : null

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
        onDragStart(index)
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(index)
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDrop(index)
      }}
      onDragEnd={onDragEnd}
      ref={cardRef}
      className={cn(
        'group animate-pop relative rounded-2xl border border-[#f2e79c] bg-[#fdf6ab] p-3.5 shadow-[0_1px_3px_rgba(176,146,20,0.12),0_1px_1px_rgba(16,24,40,0.04)] transition-all duration-150',
        TILT[index % TILT.length],
        isDragging && 'opacity-45',
        isDropTarget && 'ring-2 ring-[#a3d922] ring-offset-1',
        !isDragging && 'hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(176,146,20,0.2)]',
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-grab text-[#cdbd50] active:cursor-grabbing" />
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          placeholder="Title"
          className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold leading-snug text-[#6b5b12] placeholder:font-medium placeholder:text-[#cbbb55]"
        />
        <button
          type="button"
          aria-label="Delete note"
          onClick={() => deleteNote(note.id)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#c2b148] opacity-0 transition hover:bg-[#f7ee9c] hover:text-[#a3461f] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        ref={bodyRef}
        rows={1}
        value={note.body}
        onChange={(e) => {
          updateNote(note.id, { body: e.target.value })
          autoGrow(e.target)
        }}
        placeholder="Write something…"
        className="mt-1.5 w-full resize-none overflow-hidden bg-transparent text-[12px] leading-[1.5] text-[#7d6c1c] placeholder:text-[#cbbb55]"
      />

      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded-md px-1.5 py-[3px] text-[10.5px] font-semibold transition',
            pinned
              ? 'bg-[#f6ea92] text-[#7a6812] hover:bg-[#f2e37f]'
              : 'text-[#b5a344] hover:bg-[#f7ee9c] hover:text-[#7a6812]',
          )}
        >
          <Clock className="h-3 w-3" />
          {pinned
            ? `${monthShort(pinned)} ${pinned.getDate()}${note.time ? ` · ${note.time}` : ''}`
            : 'Pin to day'}
        </button>
        {pinned && (
          <button
            type="button"
            aria-label="Clear pinned day"
            onClick={() => updateNote(note.id, { date: undefined, time: undefined })}
            className="grid h-5 w-5 place-items-center rounded-md text-[#c2b148] transition hover:bg-[#f7ee9c] hover:text-[#7a6812]"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <span className="ml-auto text-[10px] text-[#cbbb55]">
          drag to reorder
        </span>
      </div>

      {showMeta && (
        <div className="animate-fade mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-[#fbf4c6] p-1.5">
          <input
            type="date"
            value={note.date ?? ''}
            onChange={(e) =>
              updateNote(note.id, { date: e.target.value || undefined })
            }
            className="rounded-md border border-[#eee0a0] bg-white/70 px-1.5 py-[3px] text-[11px] text-[#6b5b12]"
          />
          <input
            type="time"
            value={note.time ?? ''}
            onChange={(e) =>
              updateNote(note.id, {
                date: note.date ?? dateKey(selectedDate),
                time: e.target.value || undefined,
              })
            }
            className="rounded-md border border-[#eee0a0] bg-white/70 px-1.5 py-[3px] text-[11px] text-[#6b5b12]"
          />
        </div>
      )}
    </div>
  )
}

export function NotesPanel() {
  const { notes, addNote, moveNote, selectedDate, events } = useApp()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  const pinnedForSelected = events.filter(
    (e) => dateKey(new Date(e.start)) === dateKey(selectedDate),
  ).length

  useEffect(() => {
    if (dragIndex === null) setDropIndex(null)
  }, [dragIndex])

  return (
    <aside className="flex h-full w-[288px] shrink-0 flex-col border-l border-[#ececea] bg-[#fdfefb]">
      <div className="flex items-center justify-between border-b border-[#ececea] bg-white px-4 py-[11px]">
        <div className="flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-[#d8b31a]" strokeWidth={2.2} />
          <h2 className="text-[13.5px] font-semibold tracking-[-0.01em]">
            Notes
          </h2>
          <span className="rounded-full bg-[#f3f3f1] px-1.5 py-[1px] text-[10.5px] font-semibold text-[#6b6a66]">
            {notes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => addNote()}
          className="flex items-center gap-1 rounded-lg px-2.5 py-[5px] text-[11.5px] font-semibold transition bg-[#191919] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#37352f] active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
          New
        </button>
      </div>

      <div className="border-b border-[#ececea] bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={() => addNote({ date: dateKey(selectedDate) })}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e0dfdb] py-[7px] text-[11.5px] font-medium text-[#6b6a66] transition hover:border-[#c3e56a] hover:bg-[#f8fce9] hover:text-[#4b6410]"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Pin note to {relativeDayLabel(selectedDate)}
          {pinnedForSelected > 0 && (
            <span className="text-[#a3a29e]">· {pinnedForSelected}</span>
          )}
        </button>
      </div>

      <div className="scroll-area flex-1 space-y-3 overflow-y-auto p-4">
        {notes.map((note, i) => (
          <NoteCard
            key={note.id}
            note={note}
            index={i}
            isDragging={dragIndex === i}
            isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
            onDragStart={setDragIndex}
            onDragOver={setDropIndex}
            onDrop={(target) => {
              if (dragIndex !== null) moveNote(dragIndex, target)
              setDragIndex(null)
              setDropIndex(null)
            }}
            onDragEnd={() => {
              setDragIndex(null)
              setDropIndex(null)
            }}
          />
        ))}

        {notes.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#e0dfdb] p-4 text-center">
            <StickyNote className="mx-auto mb-2 h-5 w-5 text-[#d8b31a]" />
            <p className="text-[11.5px] leading-snug text-[#a3a29e]">
              No notes yet. Add one to keep track of the little things.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
