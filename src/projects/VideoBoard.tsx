import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Check, CheckSquare, ImagePlus, Link2, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { cn } from '../lib/id'

/**
 * Video projects: one thumbnail-shaped card per YouTube edit, each holding a
 * note card of to-dos — notes, checklist items and links. Saved in this
 * browser, like the rest of the Pro extras.
 */

type Item =
  | { id: string; kind: 'note'; text: string }
  | { id: string; kind: 'check'; text: string; done: boolean }
  | { id: string; kind: 'link'; text: string; url: string }

interface Video {
  id: string
  title: string
  thumb: string | null
  hue: number
  items: Item[]
  updatedAt: number
}

const KEY = 'desknoty.video.projects.v1'
const load = (): Video[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const store = (v: Video[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(v))
  } catch {
    /* storage full (big thumbnails) or blocked */
  }
}
const uid = () => crypto.randomUUID()

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60000)
  if (m < 1) return 'Edited just now'
  if (m < 60) return `Edited ${m} min ago`
  const h = Math.round(m / 60)
  return h < 24 ? `Edited ${h} h ago` : `Edited ${Math.round(h / 24)} d ago`
}

function readImage(file: File, cb: (url: string) => void) {
  if (!file.type.startsWith('image/') || file.size > 3 * 1024 * 1024) return
  const r = new FileReader()
  r.onload = () => typeof r.result === 'string' && cb(r.result)
  r.readAsDataURL(file)
}

export function VideoBoard({ onBack }: { onBack: () => void }) {
  const [videos, setVideos] = useState<Video[]>(load)
  const [open, setOpen] = useState<string | null>(null)
  const [naming, setNaming] = useState(false)
  const [title, setTitle] = useState('')
  useEffect(() => store(videos), [videos])

  const create = () => {
    const t = title.trim()
    if (!t) return
    const v: Video = { id: uid(), title: t, thumb: null, hue: Math.floor(Math.random() * 360), items: [], updatedAt: Date.now() }
    setVideos((list) => [v, ...list])
    setTitle('')
    setNaming(false)
    setOpen(v.id)
  }
  const current = videos.find((v) => v.id === open)

  return (
    <div className="vb">
      <header className="vb-head">
        <div>
          <h1>Video projects</h1>
          <p>Plan every YouTube edit: one card per video, with your to-dos inside.</p>
        </div>
        {naming ? (
          <form
            className="vb-new"
            onSubmit={(e) => {
              e.preventDefault()
              create()
            }}
          >
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" maxLength={80} />
            <button type="submit" disabled={!title.trim()}>
              Create
            </button>
            <button type="button" aria-label="Cancel" onClick={() => setNaming(false)}>
              <X className="h-4 w-4" />
            </button>
          </form>
        ) : (
          <button type="button" className="fx-create" onClick={() => setNaming(true)}>
            <Plus className="h-[18px] w-[18px]" /> New video project
          </button>
        )}
      </header>

      {videos.length === 0 ? (
        <button type="button" className="vb-blank" onClick={() => setNaming(true)}>
          <span className="vb-thumb vb-thumb-empty">
            <Plus className="h-6 w-6" />
          </span>
          <b>Create your first video project</b>
          <small>Each one is a card shaped like a thumbnail.</small>
        </button>
      ) : (
        <div className="vb-grid">
          {videos.map((v) => {
            const checks = v.items.filter((i) => i.kind === 'check')
            const done = checks.filter((i) => i.kind === 'check' && i.done).length
            return (
              <button key={v.id} type="button" className="vb-card" onClick={() => setOpen(v.id)}>
                <span
                  className="vb-thumb"
                  style={
                    v.thumb
                      ? { backgroundImage: `url(${v.thumb})` }
                      : ({ '--h': v.hue } as CSSProperties)
                  }
                >
                  {!v.thumb && <span className="vb-thumb-title">{v.title}</span>}
                  {checks.length > 0 && (
                    <span className="vb-badge">
                      {done}/{checks.length}
                    </span>
                  )}
                </span>
                <span className="vb-meta">
                  <b>{v.title}</b>
                  <small>
                    {v.items.length} {v.items.length === 1 ? 'item' : 'items'} · {ago(v.updatedAt)}
                  </small>
                </span>
              </button>
            )
          })}
        </div>
      )}

      <button type="button" className="vb-flip" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </button>

      {current && (
        <NoteCard
          key={current.id}
          video={current}
          onClose={() => setOpen(null)}
          onSave={(v) => {
            setVideos((list) => list.map((x) => (x.id === v.id ? { ...v, updatedAt: Date.now() } : x)))
            setOpen(null)
          }}
          onDelete={() => {
            setVideos((list) => list.filter((x) => x.id !== current.id))
            setOpen(null)
          }}
        />
      )}
    </div>
  )
}

function NoteCard({ video, onClose, onSave, onDelete }: { video: Video; onClose: () => void; onSave: (v: Video) => void; onDelete: () => void }) {
  const [draft, setDraft] = useState<Video>(video)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  const set = (id: string, p: Partial<Item>) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? ({ ...i, ...p } as Item) : i)) }))
  const add = (kind: Item['kind']) =>
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        kind === 'note' ? { id: uid(), kind, text: '' } : kind === 'check' ? { id: uid(), kind, text: '', done: false } : { id: uid(), kind, text: '', url: '' },
      ],
    }))
  const remove = (id: string) => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }))
  const dirty = JSON.stringify(draft) !== JSON.stringify(video)

  return (
    <div className="vb-veil" onMouseDown={onClose}>
      <div className="vb-note" role="dialog" aria-modal="true" aria-label={draft.title} onMouseDown={(e) => e.stopPropagation()}>
        <div className="vb-note-top">
          <span className="vb-thumb vb-thumb-sm" style={draft.thumb ? { backgroundImage: `url(${draft.thumb})` } : ({ '--h': draft.hue } as CSSProperties)} />
          <input className="vb-note-title" value={draft.title} maxLength={80} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} aria-label="Video title" />
          <button type="button" className="vb-icon" aria-label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="vb-thumb-pick">
          <ImagePlus className="h-3.5 w-3.5" /> {draft.thumb ? 'Change thumbnail' : 'Add thumbnail'}
          <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && readImage(e.target.files[0], (thumb) => setDraft((d) => ({ ...d, thumb })))} />
        </label>

        <ul className="vb-items">
          {draft.items.length === 0 && <li className="vb-empty">Nothing here yet. Add a note, a checklist item or a link.</li>}
          {draft.items.map((i) => (
            <li key={i.id} className={cn('vb-item', i.kind === 'check' && i.done && 'vb-item-done')}>
              {i.kind === 'check' ? (
                <button type="button" className="vb-tick" aria-pressed={i.done} aria-label={i.done ? 'Mark not done' : 'Mark done'} onClick={() => set(i.id, { done: !i.done })}>
                  {i.done && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
              ) : i.kind === 'link' ? (
                <Link2 className="vb-kind h-4 w-4" />
              ) : (
                <StickyNote className="vb-kind h-4 w-4" />
              )}
              <div className="vb-fields">
                {i.kind === 'note' ? (
                  <textarea rows={2} value={i.text} onChange={(e) => set(i.id, { text: e.target.value })} placeholder="Write a note…" />
                ) : (
                  <input value={i.text} onChange={(e) => set(i.id, { text: e.target.value })} placeholder={i.kind === 'link' ? 'Link name (e.g. music, b-roll)' : 'To do…'} />
                )}
                {i.kind === 'link' && <input value={i.url} onChange={(e) => set(i.id, { url: e.target.value })} placeholder="https://" />}
              </div>
              <button type="button" className="vb-icon" aria-label="Delete" onClick={() => remove(i.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="vb-add">
          <button type="button" onClick={() => add('note')}>
            <StickyNote className="h-3.5 w-3.5" /> Note
          </button>
          <button type="button" onClick={() => add('check')}>
            <CheckSquare className="h-3.5 w-3.5" /> Checklist
          </button>
          <button type="button" onClick={() => add('link')}>
            <Link2 className="h-3.5 w-3.5" /> Link
          </button>
        </div>

        <div className="vb-foot">
          <button type="button" className="vb-del" onClick={onDelete}>
            Delete project
          </button>
          <button type="button" className="vb-save" disabled={!draft.title.trim() || !dirty} onClick={() => onSave(draft)}>
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
