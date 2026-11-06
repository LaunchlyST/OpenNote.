import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Check, Search, CheckSquare, ImagePlus, Link2, Plus, StickyNote, Trash2, X } from 'lucide-react'
import { Dialog, btn } from './Chrome'
import { VideoSoon } from './VideoSoon'
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

export function VideoBoard() {
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

  const [q, setQ] = useState('')
  const shown = videos.filter((v) => v.title.toLowerCase().includes(q.trim().toLowerCase()))
  const [at, setAt] = useState(0)
  // two columns, four rows per page
  const PER = 8
  const pages = Math.max(1, Math.ceil(shown.length / PER))
  const page = Math.min(at, pages - 1)

  return (
    <div className="vb">
      <VideoSoon />
      {/* same layout as My Projects */}
      <section className="fx-head">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="fx-title">Video Projects</h1>
            <p className="fx-sub">Plan every YouTube edit: one card per video, with your to-dos inside.</p>
          </div>
          <label className="fx-search">
            <Search className="h-4 w-4" />
            <input value={q} onChange={(e) => (setQ(e.target.value), setAt(0))} placeholder="Search your videos..." className="vb-search-in" />
          </label>
        </div>
        <div className="fx-create-row">
          <button type="button" className="fx-create" onClick={() => setNaming(true)}>
            <Plus className="h-[18px] w-[18px]" /> Create Project
          </button>
        </div>
      </section>

      <div className="or-head">
        <h2 className="dk-label">Videos</h2>
        {shown.length > 0 && (
          <span className="dk-count">
            <b>{pad(shown.length)}</b> {shown.length === 1 ? 'video' : 'videos'}
          </span>
        )}
      </div>

      {shown.length === 0 ? (
        <button type="button" className="vb-blank" onClick={() => setNaming(true)}>
          <span className="vb-thumb vb-thumb-empty">
            <Plus className="h-6 w-6" />
          </span>
          <b>{videos.length ? 'No videos match your search' : 'Create your first video project'}</b>
          <small>Each one is a card shaped like a thumbnail.</small>
        </button>
      ) : (
        <>
          <div className="vg-grid" role="list" aria-label="Video projects">
            {shown.slice(page * PER, page * PER + PER).map((v, i) => {
              const checks = v.items.filter((x) => x.kind === 'check')
              const done = checks.filter((x) => x.kind === 'check' && x.done).length
              return (
                <button key={v.id} type="button" role="listitem" className="vg-card" style={{ '--i': i } as CSSProperties} onClick={() => setOpen(v.id)}>
                  <span className="vb-thumb vg-thumb" style={v.thumb ? { backgroundImage: `url(${v.thumb})` } : ({ '--h': v.hue } as CSSProperties)}>
                    {!v.thumb && <span className="vb-thumb-title">{v.title}</span>}
                    {checks.length > 0 && (
                      <span className="vb-badge">
                        {done}/{checks.length}
                      </span>
                    )}
                    <span className="vg-open" aria-hidden="true">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </span>
                  <span className="vg-meta">
                    <b>{v.title}</b>
                    <small>
                      {v.items.length} {v.items.length === 1 ? 'item' : 'items'} · {ago(v.updatedAt)}
                    </small>
                    {checks.length > 0 && (
                      <span className="vg-bar">
                        <i style={{ width: `${(done / checks.length) * 100}%` }} />
                      </span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
          {pages > 1 && (
            <div className="vg-pager">
              <button type="button" className="dk-round" aria-label="Previous page" disabled={page === 0} onClick={() => setAt(page - 1)}>
                <ArrowLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pages }, (_, n) => (
                <button key={n} type="button" className={cn('vg-num', n === page && 'vg-num-on')} aria-label={`Page ${n + 1}`} aria-current={n === page ? 'page' : undefined} onClick={() => setAt(n)}>
                  {n + 1}
                </button>
              ))}
              <button type="button" className="dk-round" aria-label="Next page" disabled={page === pages - 1} onClick={() => setAt(page + 1)}>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      {naming && (
        <Dialog title="Create Video Project" onClose={() => (setNaming(false), setTitle(''))}>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              create()
              setAt(0)
            }}
          >
            <label className="block">
              <span className="text-[13px] font-medium text-[#37352f]">Video title</span>
              <input
                autoFocus
                value={title}
                maxLength={80}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. My Morning Routine Vlog"
                className="mt-1.5 w-full rounded-xl border border-[#e3e3e0] bg-white px-3 py-2.5 text-[14px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:border-[#191919]"
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className={btn.secondary} onClick={() => (setNaming(false), setTitle(''))}>
                Cancel
              </button>
              <button type="submit" className={btn.primary} disabled={!title.trim()}>
                Create Project
              </button>
            </div>
          </form>
        </Dialog>
      )}

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

const pad = (n: number) => String(n).padStart(2, '0')

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
