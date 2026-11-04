import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Command, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { COLORS } from '../lib/colors'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'
import { projectsApi } from './api'
import type { ProjectSummary } from './api'
import type { ProjectData } from '../store'

/**
 * The Pro home — "the desk".
 *
 * Projects lie in a stack on the left. The top card is the selected project;
 * flick it away (drag, swipe, trackpad, ← →) and the next one lands with a
 * spring. Every project is also listed on a numbered index under the stack,
 * so any number of projects stays one click away. The right page reads the
 * selected project: what's next in it, its latest notes, and a line to add a
 * note without opening it. Across the top, a one-sentence brief of today
 * built only from real events.
 */

interface Props {
  name: string
  projects: ProjectSummary[] | null
  error: string | null
  onRetry: () => void
  account: React.ReactNode
  onCreate: () => void
  onOpen: (p: ProjectSummary) => void
  onRename: (p: ProjectSummary) => void
  onDuplicate: (p: ProjectSummary) => void
  onDelete: (p: ProjectSummary) => void
}

type Ev = { id: string; title: string; start: string; end: string; calendarId: string }
type Nt = { id: string; title: string; body: string; createdAt: number; date?: string }
type Peek = { events: Ev[]; notes: Nt[]; calendars: Array<{ id: string; color: string }>; raw: ProjectData }

const DAY = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()

function when(iso: string, now: Date) {
  const d = new Date(iso)
  const t = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
  if (sameDay(d, now)) return `Today ${t}`
  if (sameDay(d, new Date(now.getTime() + DAY))) return `Tomorrow ${t}`
  return `${d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })} ${t}`
}

function edited(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'Edited just now'
  if (m < 60) return `Edited ${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `Edited ${h} h ago`
  return `Edited ${Math.round(h / 24)} d ago`
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function ProHome(props: Props) {
  const { name, projects, error, onRetry, account, onCreate, onOpen } = props
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // last edited first: that is "where I left off"
  const list = useMemo(() => [...(projects ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [projects])
  const [sel, setSel] = useState(0)
  const at = Math.min(sel, Math.max(0, list.length - 1))
  const current = list[at]

  // real data for every project, read without marking them opened
  const [peeks, setPeeks] = useState<Record<string, Peek>>({})
  useEffect(() => {
    let alive = true
    for (const p of list.slice(0, 60)) {
      projectsApi
        .peek(p.id)
        .then(({ data }) => {
          if (!alive) return
          const d = data as unknown as { events?: Ev[]; notes?: Nt[]; calendars?: Peek['calendars'] }
          setPeeks((m) => ({ ...m, [p.id]: { events: d.events ?? [], notes: d.notes ?? [], calendars: d.calendars ?? [], raw: data } }))
        })
        .catch(() => {})
    }
    return () => {
      alive = false
    }
  }, [list])

  const upcoming = useMemo(() => {
    const out: Array<Ev & { project: ProjectSummary }> = []
    for (const p of list) for (const e of peeks[p.id]?.events ?? []) if (Date.parse(e.end) > now.getTime()) out.push({ ...e, project: p })
    return out.sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  }, [list, peeks, now])
  const today = upcoming.filter((e) => sameDay(new Date(e.start), now))
  const todayProjects = new Set(today.map((e) => e.project.id)).size

  const [palette, setPalette] = useState(false)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const h = now.getHours()
  const part = h < 5 ? 'Late night' : h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
  const first = name.trim().split(/\s+/)[0] || 'there'
  const brief = !projects
    ? 'Getting your desk ready.'
    : list.length === 0
      ? 'Your desk is clear. Start your first project.'
      : today.length
        ? `${today.length} ${today.length === 1 ? 'event' : 'events'} today across ${todayProjects} ${todayProjects === 1 ? 'project' : 'projects'}. First up: ${today[0].title}, ${when(today[0].start, now).replace('Today ', '')}.`
        : upcoming.length
          ? `Nothing booked today. Next: ${upcoming[0].title}, ${when(upcoming[0].start, now)}.`
          : 'Nothing scheduled yet. A clear day to get ahead.'

  return (
    <div className="dk relative z-10 flex min-h-full flex-col">
      <header className="dk-top">
        <a href="/" aria-label="Desknoty home" className="inline-flex items-center gap-2">
          <AppIcon className="h-7 w-7 text-[28px]" />
          <span className="dk-brand">Desknoty</span>
          <span className="dk-pro">Pro</span>
        </a>
        <button type="button" className="dk-search" onClick={() => setPalette(true)}>
          <Search className="h-4 w-4" />
          <span>Find a project</span>
          <kbd>
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
        <div className="justify-self-end">{account}</div>
      </header>

      <section className="dk-brief">
        <p className="dk-date">
          {now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
          {pad(now.getHours())}:{pad(now.getMinutes())}
        </p>
        <h1 className="dk-line">
          <span className="dk-hi">
            {part}, {first}.
          </span>{' '}
          {brief}
        </h1>
      </section>

      {error ? (
        <div className="dk-msg">
          Couldn’t load your projects. {error}{' '}
          <button type="button" onClick={onRetry} className="dk-link">
            Try again
          </button>
        </div>
      ) : !projects ? (
        <div className="dk-msg">Loading your desk…</div>
      ) : list.length === 0 ? (
        <div className="dk-empty">
          <button type="button" className="dk-blank" onClick={onCreate}>
            <Plus className="h-6 w-6" />
            <span>Start your first project</span>
            <small>Each project gets its own calendar, notes and plans.</small>
          </button>
        </div>
      ) : (
        <main className="dk-desk">
          <Deck list={list} at={at} setAt={setSel} onOpen={onOpen} onCreate={onCreate} props={props} peeks={peeks} now={now} />
          {current && <Page project={current} peek={peeks[current.id]} now={now} onOpen={onOpen} onSaved={(id, p) => setPeeks((m) => ({ ...m, [id]: p }))} />}
          <aside className="dk-next" aria-label="Coming up">
            <h2 className="dk-label">Coming up</h2>
            {upcoming.length === 0 ? (
              <p className="dk-quiet">No upcoming events in any project.</p>
            ) : (
              <ol>
                {upcoming.slice(0, 6).map((e) => (
                  <li key={e.project.id + e.id}>
                    <button
                      type="button"
                      onClick={() => setSel(list.findIndex((p) => p.id === e.project.id))}
                      className="dk-next-row"
                      style={{ '--c': (COLORS[e.project.color] ?? COLORS.lime).dot } as CSSProperties}
                    >
                      <span className="dk-next-when">{when(e.start, now)}</span>
                      <span className="dk-next-title">{e.title}</span>
                      <span className="dk-next-proj">{e.project.name}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </aside>
        </main>
      )}

      {palette && <Palette projects={list} onClose={() => setPalette(false)} onPick={(i) => setSel(i)} onOpen={onOpen} onCreate={onCreate} />}
    </div>
  )
}

/* ---------------------------------------------------------------- deck --- */

function Deck({
  list,
  at,
  setAt,
  onOpen,
  onCreate,
  props,
  peeks,
  now,
}: {
  peeks: Record<string, Peek>
  now: Date
  list: ProjectSummary[]
  at: number
  setAt: (i: number) => void
  onOpen: (p: ProjectSummary) => void
  onCreate: () => void
  props: Props
}) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const start = useRef<{ x: number; t: number; moved: boolean } | null>(null)
  const wheel = useRef({ acc: 0, last: 0 })
  const go = useCallback((i: number) => setAt(Math.max(0, Math.min(list.length - 1, i))), [list.length, setAt])

  const down = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button:not(.dk-card-face), [role="menu"]')) return
    start.current = { x: e.clientX, t: performance.now(), moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: ReactPointerEvent) => {
    const s = start.current
    if (!s) return
    const d = e.clientX - s.x
    if (Math.abs(d) > 4) {
      s.moved = true
      setDragging(true)
    }
    // rubber band at the ends
    const edge = (d > 0 && at === 0) || (d < 0 && at === list.length - 1)
    setDx(edge ? d * 0.25 : d)
  }
  const up = () => {
    const s = start.current
    start.current = null
    setDragging(false)
    if (!s) return
    const v = dx / Math.max(1, performance.now() - s.t) // px per ms: a flick counts
    if (dx < -90 || v < -0.6) go(at + 1)
    else if (dx > 90 || v > 0.6) go(at - 1)
    setDx(0)
  }
  const onWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return
    const w = wheel.current
    const t = performance.now()
    if (t - w.last > 260) w.acc = 0
    w.last = t
    w.acc += e.deltaX
    if (Math.abs(w.acc) > 60) {
      go(at + Math.sign(w.acc))
      w.acc = 0
      w.last = t + 200 // settle before the next step
    }
  }
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') (e.preventDefault(), go(at + 1))
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') (e.preventDefault(), go(at - 1))
    if (e.key === 'Home') (e.preventDefault(), go(0))
    if (e.key === 'End') (e.preventDefault(), go(list.length - 1))
    if (e.key === 'Enter') onOpen(list[at])
  }

  const still = reduced()
  return (
    <section className="dk-deckwrap" aria-label="Projects">
      <div
        className={cn('dk-deck', dragging && 'dk-dragging')}
        role="listbox"
        aria-label="Projects, use the arrow keys to flip"
        aria-activedescendant={`dk-card-${list[at]?.id}`}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={onWheel}
      >
        {list.map((p, i) => {
          const d = i - at
          if (d < -1 || d > 4) return null
          return (
            <Card
              key={p.id}
              project={p}
              index={i}
              total={list.length}
              depth={d}
              dx={d === 0 ? dx : 0}
              still={still}
              onPick={() => (d === 0 ? !start.current?.moved && onOpen(p) : go(i))}
              props={props}
              peek={peeks[p.id]}
              now={now}
            />
          )
        })}
      </div>

      <div className="dk-deck-bar">
        <span className="dk-count">
          <b>{pad(at + 1)}</b> / {pad(list.length)}
        </span>
        <div className="flex gap-1.5">
          <button type="button" className="dk-round" aria-label="Previous project" disabled={at === 0} onClick={() => go(at - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" className="dk-round" aria-label="Next project" disabled={at === list.length - 1} onClick={() => go(at + 1)}>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button type="button" className="dk-round dk-round-add" aria-label="New project" onClick={onCreate}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* the index: every project, numbered, one click away */}
      <ol className="dk-index" aria-label="All projects">
        {list.map((p, i) => (
          <li key={p.id}>
            <button
              type="button"
              aria-current={i === at ? 'true' : undefined}
              onClick={() => go(i)}
              style={{ '--c': (COLORS[p.color] ?? COLORS.lime).dot } as CSSProperties}
            >
              <span>{pad(i + 1)}</span>
              {p.name}
            </button>
          </li>
        ))}
      </ol>
    </section>
  )
}

function Card({
  project,
  index,
  total,
  depth,
  dx,
  still,
  onPick,
  props,
  peek,
  now,
}: {
  peek?: Peek
  now: Date
  project: ProjectSummary
  index: number
  total: number
  depth: number
  dx: number
  still: boolean
  onPick: () => void
  props: Props
}) {
  const c = COLORS[project.color] ?? COLORS.lime
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])

  // depth 0 is on top; behind cards fan back and right; -1 has been flicked away
  const t =
    depth < 0
      ? 'translate3d(-70%, 30px, 0) rotate(-14deg)'
      : depth === 0
        ? `translate3d(${dx}px, ${Math.abs(dx) * 0.06}px, 0) rotate(${dx * 0.03}deg)`
        : `translate3d(${depth * 22}px, ${depth * -16}px, 0) rotate(${depth * 2.4}deg) scale(${1 - depth * 0.045})`
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]'
  // live counts once the project has been read; the summary until then
  const events = peek?.events.length ?? project.eventCount
  const notes = peek?.notes.length ?? project.noteCount
  const next = peek?.events
    .filter((e) => Date.parse(e.end) > now.getTime())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]

  return (
    <article
      id={`dk-card-${project.id}`}
      data-project-card={project.id}
      role="option"
      aria-selected={depth === 0}
      className={cn('dk-card', depth === 0 && 'dk-card-top')}
      style={
        {
          '--c': c.dot,
          '--cbg': c.bg,
          '--ctext': c.text,
          transform: t,
          zIndex: 50 - Math.max(depth, -1) * 2 - (depth < 0 ? 60 : 0),
          opacity: depth < 0 ? 0 : depth > 3 ? 0 : 1 - depth * 0.08,
          transition: still ? 'none' : undefined,
        } as CSSProperties
      }
    >
      <button type="button" className="dk-card-face" tabIndex={-1} onClick={onPick} aria-label={depth === 0 ? `Open ${project.name}` : `Show ${project.name}`}>
        <span className="dk-card-band" aria-hidden="true" />
        <span className="dk-card-no">
          {pad(index + 1)}
          <i>/{pad(total)}</i>
        </span>
        {next && (
          <span className="dk-card-next">
            <span>Next</span>
            {next.title}
            <em>{when(next.start, now)}</em>
          </span>
        )}
        <span className="dk-card-name">{project.name}</span>
        {project.description && <span className="dk-card-desc">{project.description}</span>}
        <span className="dk-card-foot">
          <span>
            {events} {events === 1 ? 'event' : 'events'} · {notes} {notes === 1 ? 'note' : 'notes'}
          </span>
          <span>{edited(project.updatedAt)}</span>
        </span>
      </button>
      {depth === 0 && (
        <div ref={ref} className="absolute right-4 top-4 z-10">
          <button type="button" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={menu} className="dk-more" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-[#ececea] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onRename(project) }}>
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); props.onDuplicate(project) }}>
                <Copy className="h-4 w-4" /> Duplicate
              </button>
              <button type="button" role="menuitem" className={cn(item, 'text-[#b4453c] hover:bg-[#fdf3f2]')} onClick={() => { setMenu(false); props.onDelete(project) }}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/* ---------------------------------------------------------------- page --- */

function Page({
  project,
  peek,
  now,
  onOpen,
  onSaved,
}: {
  project: ProjectSummary
  peek: Peek | undefined
  now: Date
  onOpen: (p: ProjectSummary) => void
  onSaved: (id: string, p: Peek) => void
}) {
  const c = COLORS[project.color] ?? COLORS.lime
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  useEffect(() => {
    setNote('')
    setState('idle')
  }, [project.id])

  const next = (peek?.events ?? [])
    .filter((e) => Date.parse(e.end) > now.getTime())
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
    .slice(0, 3)
  const notes = [...(peek?.notes ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 3)

  const add = async () => {
    const text = note.trim()
    if (!text || !peek) return
    setState('saving')
    const [title, ...rest] = text.split('\n')
    const fresh: Nt = { id: `note_${crypto.randomUUID()}`, title: title.slice(0, 120), body: rest.join('\n'), createdAt: Date.now() }
    const raw = { ...(peek.raw as unknown as Record<string, unknown>), notes: [fresh, ...peek.notes] } as unknown as ProjectData
    try {
      await projectsApi.save(project.id, raw)
      onSaved(project.id, { ...peek, notes: [fresh, ...peek.notes], raw })
      setNote('')
      setState('saved')
      window.setTimeout(() => setState((s) => (s === 'saved' ? 'idle' : s)), 2200)
    } catch {
      setState('error')
    }
  }

  return (
    <section key={project.id} className="dk-page" aria-label={`${project.name} details`} style={{ '--c': c.dot } as CSSProperties}>
      <p className="dk-label">
        <span className="dk-dot" /> Selected project
      </p>
      <h2 className="dk-page-title">{project.name}</h2>
      {project.description && <p className="dk-page-desc">{project.description}</p>}

      <div className="dk-cols">
        <div>
          <h3 className="dk-label">Next in this project</h3>
          {!peek ? (
            <p className="dk-quiet">Reading…</p>
          ) : next.length === 0 ? (
            <p className="dk-quiet">Nothing scheduled.</p>
          ) : (
            <ul className="dk-items">
              {next.map((e) => (
                <li key={e.id}>
                  <span className="dk-item-when">{when(e.start, now)}</span>
                  {e.title}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="dk-label">Latest notes</h3>
          {!peek ? (
            <p className="dk-quiet">Reading…</p>
          ) : notes.length === 0 ? (
            <p className="dk-quiet">No notes yet.</p>
          ) : (
            <ul className="dk-items">
              {notes.map((n) => (
                <li key={n.id}>{n.title || 'Untitled note'}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <form
        className="dk-capture"
        onSubmit={(e) => {
          e.preventDefault()
          void add()
        }}
      >
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            if (state !== 'saving') setState('idle')
          }}
          placeholder={`Jot a note into ${project.name}…`}
          aria-label={`New note for ${project.name}`}
          disabled={!peek || state === 'saving'}
        />
        <button type="submit" disabled={!note.trim() || state === 'saving'}>
          {state === 'saving' ? 'Saving…' : 'Add note'}
        </button>
      </form>
      <p className="dk-capture-msg" role="status">
        {state === 'saved' ? `Saved to ${project.name}.` : state === 'error' ? 'Couldn’t save that note. Try again.' : ''}
      </p>

      <button type="button" className="dk-open" onClick={() => onOpen(project)}>
        Open {project.name} <ArrowUpRight className="h-4 w-4" />
      </button>
    </section>
  )
}

/* ------------------------------------------------------------- palette --- */

function Palette({
  projects,
  onClose,
  onPick,
  onOpen,
  onCreate,
}: {
  projects: ProjectSummary[]
  onClose: () => void
  onPick: (i: number) => void
  onOpen: (p: ProjectSummary) => void
  onCreate: () => void
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const hits = projects.map((p, i) => ({ p, i })).filter(({ p }) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  const rows: Array<{ label: string; sub?: string; run: () => void; alt?: () => void }> = [
    ...hits.map(({ p, i }) => ({ label: p.name, sub: 'Enter to open · Shift+Enter to show', run: () => onOpen(p), alt: () => onPick(i) })),
    { label: q ? `New project “${q}”` : 'New project', run: onCreate },
  ]
  const go = (i: number, alt = false) => {
    onClose()
    const r = rows[i]
    if (!r) return
    if (alt && r.alt) r.alt()
    else r.run()
  }
  return (
    <div className="dk-veil" role="dialog" aria-modal="true" aria-label="Find a project" onMouseDown={onClose}>
      <div className="dk-palette" onMouseDown={(e) => e.stopPropagation()}>
        <label className="dk-palette-in">
          <Search className="h-4 w-4" />
          <input
            autoFocus
            value={q}
            placeholder="Find a project…"
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(rows.length - 1, s + 1)))
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(0, s - 1)))
              if (e.key === 'Enter') go(sel, e.shiftKey)
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul>
          {rows.map((r, i) => (
            <li key={r.label + i}>
              <button type="button" className={cn('dk-row', i === sel && 'dk-row-on')} onMouseEnter={() => setSel(i)} onClick={() => go(i)}>
                <span>{r.label}</span>
                {r.sub && i === sel && <small>{r.sub}</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
