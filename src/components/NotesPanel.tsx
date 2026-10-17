import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CalendarDays,
  CalendarPlus,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react'
import { useApp } from '../store'
import type { Note } from '../lib/types'
import { dateKey, parseDateInput, relativeDayLabel } from '../lib/date'
import { cn, uid } from '../lib/id'

/**
 * The Notes section (System B): longer notes with a title and description,
 * optionally linked to a day. These are documents — they are never events and
 * never time-slot notes, so nothing here can appear inside the calendar grid.
 * A dated note only adds a small "Notes (n)" badge to its day header.
 */

const TILT = ['', '-rotate-[0.35deg]', 'rotate-[0.3deg]']

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  // Never collapse to nothing: a measurement taken while the panel is still
  // zero-width would otherwise lock the field at 0px forever.
  el.style.height = `${Math.max(el.scrollHeight, 24)}px`
}

function longDate(key: string) {
  const d = parseDateInput(key)
  if (!d) return key
  return d.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const card =
  'rounded-2xl border border-[#f2e79c] bg-[#fdf6ab] shadow-[0_1px_3px_rgba(176,146,20,0.12),0_1px_1px_rgba(16,24,40,0.04)]'

/** Collapsed note: title, a line of the description and its date link. */
function NoteSummary({
  note,
  index,
  isDragging,
  isDropTarget,
  onOpen,
  drag,
}: {
  note: Note
  index: number
  isDragging: boolean
  isDropTarget: boolean
  onOpen: () => void
  drag: {
    onDragStart: () => void
    onDragOver: () => void
    onDrop: () => void
    onDragEnd: () => void
  }
}) {
  const hidden = note.date && note.showOnCalendar === false
  return (
    <div
      draggable
      data-note-doc={note.id}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', String(index))
        drag.onDragStart()
      }}
      onDragOver={(e) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        drag.onDragOver()
      }}
      onDrop={(e) => {
        e.preventDefault()
        drag.onDrop()
      }}
      onDragEnd={drag.onDragEnd}
      className={cn(
        'group animate-pop relative transition-all duration-150',
        card,
        TILT[index % TILT.length],
        isDragging && 'opacity-45',
        isDropTarget && 'ring-2 ring-[#a3d922] ring-offset-1',
        !isDragging && 'hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(176,146,20,0.2)]',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open note ${note.title.trim() || 'Untitled note'}`}
        className="block w-full p-3.5 text-left"
      >
        <span className="flex items-start gap-1.5">
          <GripVertical className="mt-[3px] h-3.5 w-3.5 shrink-0 cursor-grab text-[#cdbd50]" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold leading-snug text-[#6b5b12]">
              {note.title.trim() || 'Untitled note'}
            </span>
            {note.body.trim() && (
              <span className="mt-1 line-clamp-2 block text-[12px] leading-[1.5] text-[#7d6c1c]">
                {note.body}
              </span>
            )}
          </span>
        </span>
        <span className="mt-2 flex items-center gap-1.5 pl-5">
          {note.date ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[#f6ea92] px-1.5 py-[3px] text-[10.5px] font-semibold text-[#7a6812]">
              <CalendarDays className="h-3 w-3" />
              {longDate(note.date)}
              {hidden && <EyeOff className="ml-0.5 h-3 w-3" aria-label="Hidden from calendar" />}
            </span>
          ) : (
            <span className="text-[10.5px] font-medium text-[#b5a344]">No date</span>
          )}
        </span>
      </button>
    </div>
  )
}

/** Expanded note: edit everything, then Save & Hide. Changes save as you type. */
function NoteEditor({ note, onDone }: { note: Note; onDone: () => void }) {
  const { updateNote, deleteNote } = useApp()
  const bodyRef = useRef<HTMLTextAreaElement | null>(null)
  const [confirming, setConfirming] = useState(false)

  useLayoutEffect(() => autoGrow(bodyRef.current), [note.body])

  const showOnCalendar = note.showOnCalendar !== false

  return (
    <div data-note-editor={note.id} className={cn('animate-pop p-3.5', card)}>
      <input
        autoFocus
        value={note.title}
        onChange={(e) => updateNote(note.id, { title: e.target.value })}
        placeholder="Title"
        aria-label="Note title"
        className="w-full bg-transparent text-[13.5px] font-semibold leading-snug text-[#6b5b12] placeholder:font-medium placeholder:text-[#cbbb55]"
      />
      <textarea
        ref={bodyRef}
        rows={2}
        value={note.body}
        onChange={(e) => {
          updateNote(note.id, { body: e.target.value })
          autoGrow(e.target)
        }}
        placeholder="Write something…"
        aria-label="Note description"
        className="mt-1.5 w-full resize-none overflow-hidden bg-transparent text-[12px] leading-[1.5] text-[#7d6c1c] placeholder:text-[#cbbb55]"
      />

      <div className="mt-2 space-y-1.5 rounded-xl bg-[#fbf4c6] p-2">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#a39226]" />
          <input
            type="date"
            aria-label="Note date"
            value={note.date ?? ''}
            onChange={(e) => updateNote(note.id, { date: e.target.value || undefined })}
            className="min-w-0 flex-1 rounded-md border border-[#eee0a0] bg-white/70 px-1.5 py-[3px] text-[11px] text-[#6b5b12]"
          />
          {note.date && (
            <button
              type="button"
              onClick={() => updateNote(note.id, { date: undefined })}
              className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-[3px] text-[10.5px] font-semibold text-[#8a7412] transition hover:bg-[#f7ee9c]"
            >
              <X className="h-3 w-3" />
              Remove date
            </button>
          )}
        </div>
        <label
          className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium text-[#7a6812]',
            !note.date && 'opacity-50',
          )}
        >
          <input
            type="checkbox"
            checked={showOnCalendar}
            disabled={!note.date}
            onChange={(e) => updateNote(note.id, { showOnCalendar: e.target.checked })}
            className="h-3.5 w-3.5 accent-[#a3d922]"
          />
          {showOnCalendar ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          Show on calendar
          <span className="font-normal text-[#b5a344]">{note.date ? '' : '(pick a date first)'}</span>
        </label>
      </div>

      {confirming ? (
        <div className="mt-2.5 flex items-center gap-1.5 rounded-xl bg-[#fde8e8] p-2">
          <span className="flex-1 text-[11.5px] font-medium text-[#8a2a2a]">Delete this note?</span>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-[#6b6a66] hover:bg-white/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => deleteNote(note.id)}
            className="rounded-md bg-[#b4453c] px-2 py-1 text-[11px] font-semibold text-white hover:bg-[#9c3a32]"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="mt-2.5 flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Delete note"
            onClick={() => setConfirming(true)}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#c2b148] transition hover:bg-[#f7ee9c] hover:text-[#a3461f]"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDone}
            className="ml-auto h-8 rounded-lg bg-[#191919] px-3 text-[11.5px] font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition hover:bg-[#37352f] active:scale-[0.97]"
          >
            Save &amp; Hide
          </button>
        </div>
      )}
    </div>
  )
}

export function NotesPanel() {
  const { notes, addNote, moveNote, selectedDate, notesFilter, setNotesFilter } = useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)

  // The day a new pinned note goes to: the filtered day, else the selected day.
  const pinKey = notesFilter ?? dateKey(selectedDate)
  const pinnedCount = notes.filter((n) => n.date === pinKey).length
  const visible = notesFilter ? notes.filter((n) => n.date === notesFilter) : notes

  useEffect(() => {
    if (dragIndex === null) setDropIndex(null)
  }, [dragIndex])

  const create = (date?: string) => {
    const id = uid('note')
    addNote({ id, ...(date ? { date } : {}) })
    setEditingId(id)
  }

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
          onClick={() => create(notesFilter ?? undefined)}
          className="flex items-center gap-1 rounded-lg px-2.5 py-[5px] text-[11.5px] font-semibold transition bg-[#191919] text-white shadow-[0_1px_2px_rgba(0,0,0,0.2)] hover:bg-[#37352f] active:scale-[0.97]"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.6} />
          New
        </button>
      </div>

      <div className="space-y-2 border-b border-[#ececea] bg-white px-4 py-2.5">
        {notesFilter && (
          <div
            data-testid="notes-filter"
            className="flex items-center gap-1.5 rounded-lg bg-[#fdf3c4] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#7a6812]"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span className="flex-1 truncate">Notes for {longDate(notesFilter)}</span>
            <button
              type="button"
              onClick={() => setNotesFilter(null)}
              className="rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-[#8a6a00] hover:bg-white/60"
            >
              Show all
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => create(pinKey)}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[#e0dfdb] py-[7px] text-[11.5px] font-medium text-[#6b6a66] transition hover:border-[#c3e56a] hover:bg-[#f8fce9] hover:text-[#4b6410]"
        >
          <CalendarPlus className="h-3.5 w-3.5" />
          Pin note to {notesFilter ? longDate(notesFilter) : relativeDayLabel(selectedDate)}
          {pinnedCount > 0 && (
            <span className="text-[#a3a29e]">· {pinnedCount}</span>
          )}
        </button>
      </div>

      <div className="scroll-area flex-1 space-y-3 overflow-y-auto p-4">
        {visible.map((note) => {
          const i = notes.indexOf(note)
          return note.id === editingId ? (
            <NoteEditor key={note.id} note={note} onDone={() => setEditingId(null)} />
          ) : (
            <NoteSummary
              key={note.id}
              note={note}
              index={i}
              isDragging={dragIndex === i}
              isDropTarget={dropIndex === i && dragIndex !== null && dragIndex !== i}
              onOpen={() => setEditingId(note.id)}
              drag={{
                onDragStart: () => setDragIndex(i),
                onDragOver: () => setDropIndex(i),
                onDrop: () => {
                  if (dragIndex !== null) moveNote(dragIndex, i)
                  setDragIndex(null)
                  setDropIndex(null)
                },
                onDragEnd: () => {
                  setDragIndex(null)
                  setDropIndex(null)
                },
              }}
            />
          )
        })}

        {visible.length === 0 && (
          <div className="rounded-xl border border-dashed border-[#e0dfdb] p-4 text-center">
            <StickyNote className="mx-auto mb-2 h-5 w-5 text-[#d8b31a]" />
            <p className="text-[11.5px] leading-snug text-[#a3a29e]">
              {notesFilter
                ? 'No notes linked to this day yet.'
                : 'No notes yet. Add one to keep track of the little things.'}
            </p>
          </div>
        )}
      </div>
    </aside>
  )
}
