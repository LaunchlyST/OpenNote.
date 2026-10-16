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
        'group animate-pop relative rounded-2xl border border-note-border bg-note-bg p-4 transition-all duration-150',
        TILT[index % TILT.length],
        isDragging && 'opacity-45',
        isDropTarget && 'ring-2 ring-accent ring-offset-2',
        !isDragging &&
          'shadow-[0_1px_2px_rgba(120,100,20,0.08)] hover:-translate-y-0.5 hover:shadow-[0_10px_22px_-10px_rgba(120,100,20,0.4)]',
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-grab text-note-muted/60 transition group-hover:text-note-muted active:cursor-grabbing" />
        <input
          value={note.title}
          onChange={(e) => updateNote(note.id, { title: e.target.value })}
          placeholder="Title"
          className="min-w-0 flex-1 bg-transparent text-[13.5px] font-semibold leading-snug text-note-title placeholder:font-medium placeholder:text-note-muted/70"
        />
        <button
          type="button"
          aria-label="Delete note"
          onClick={() => deleteNote(note.id)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-note-muted opacity-0 transition hover:bg-note-well hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
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
        className="mt-1.5 w-full resize-none overflow-hidden bg-transparent text-[12px] leading-[1.55] text-note-body placeholder:text-note-muted/70"
      />

      <div className="mt-2.5 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowMeta((v) => !v)}
          className={cn(
            'flex items-center gap-1 rounded-lg px-2 py-[4px] text-[10.5px] font-semibold transition',
            pinned
              ? 'bg-note-well text-note-title hover:bg-[#f2e37f]'
              : 'text-note-muted hover:bg-note-well hover:text-note-title',
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
            className="grid h-5 w-5 place-items-center rounded-lg text-note-muted transition hover:bg-note-well hover:text-note-title"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <span className="ml-auto text-[10px] text-note-muted/70">
          drag to reorder
        </span>
      </div>

      {showMeta && (
        <div className="animate-fade mt-2 flex flex-wrap items-center gap-1.5 rounded-lg bg-note-well p-1.5">
          <input
            type="date"
            value={note.date ?? ''}
            onChange={(e) =>
              updateNote(note.id, { date: e.target.value || undefined })
            }
            className="rounded-lg border border-note-border bg-white/70 px-1.5 py-[3px] text-[11px] text-note-title"
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
            className="rounded-lg border border-note-border bg-white/70 px-1.5 py-[3px] text-[11px] text-note-title"
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
    <aside className="flex h-full w-[300px] shrink-0 flex-col border-l border-line bg-canvas-warm">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-white px-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent-soft">
            <StickyNote className="h-4 w-4 text-accent-text" strokeWidth={2.2} />
          </div>
          <h2 className="text-[14px] font-bold tracking-[-0.01em] text-ink">
            Notes
          </h2>
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-ink-soft">
            {notes.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => addNote()}
          className="flex items-center gap-1 rounded-xl bg-accent px-3 py-1.5 text-[11.5px] font-bold text-[#1f2937] shadow-[0_4px_12px_-4px_rgba(163,217,34,0.6)] transition hover:bg-accent-hover active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.8} />
          New
        </button>
      </div>

      {/* Pin to today */}
      <div className="border-b border-line bg-white px-4 py-2.5">
        <button
          type="button"
          onClick={() => addNote({ date: dateKey(selectedDate) })}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong py-2 text-[11.5px] font-medium text-ink-soft transition hover:border-accent hover:bg-accent-soft hover:text-accent-text"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Pin note to {relativeDayLabel(selectedDate)}
          {pinnedForSelected > 0 && (
            <span className="text-faint">· {pinnedForSelected}</span>
          )}
        </button>
      </div>

      {/* Notes list */}
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
          <div className="rounded-2xl border border-dashed border-border-strong bg-white p-6 text-center">
            <StickyNote className="mx-auto mb-2 h-6 w-6 text-accent-deep" />
            <p className="text-[12px] leading-snug text-muted">
              No notes yet. Add one to keep track of the little things.
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}