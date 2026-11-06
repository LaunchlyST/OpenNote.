import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'
import { ArrowLeft, ArrowRight, Command, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { COLORS } from '../lib/colors'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'
import { projectsApi } from './api'
import type { ProjectSummary } from './api'
import type { ProjectData } from '../store'
import { StreakChip } from './StreakChip'
import { HeaderLinks } from './MyProjects'

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
        <nav aria-label="Explore Desknoty" className="dk-links hidden md:block">
          <HeaderLinks />
        </nav>
        <div className="flex items-center gap-2 justify-self-end">
          <StreakChip />
          {account}
        </div>
      </header>

      <section className="fx-head">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="fx-title">My Projects</h1>
            <p className="fx-sub">
              Good {h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'}, {first}. {brief}
            </p>
          </div>
          <button type="button" className="fx-search" onClick={() => setPalette(true)}>
          <Search className="h-4 w-4" />
          <span>Search your projects...</span>
          <kbd>
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
        </div>
        <div className="fx-create-row">
          <button type="button" className="fx-create" onClick={onCreate}>
            <Plus className="h-[18px] w-[18px]" /> Create Project
          </button>
        </div>
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
        <main className="or">
          {upcoming.length > 0 && (
          <section className="or-strip" aria-label="Coming up">
            <h2 className="dk-label">Coming up</h2>
            {upcoming.length > 0 && (
              <ol className="or-chips">
                {upcoming.slice(0, 8).map((e) => (
                  <li key={e.project.id + e.id}>
                    <button
                      type="button"
                      onClick={() => setSel(list.findIndex((p) => p.id === e.project.id))}
                      className="or-chip"
                      style={{ '--c': (COLORS[e.project.color] ?? COLORS.lime).dot } as CSSProperties}
                    >
                      <span className="or-chip-when">{when(e.start, now)}</span>
                      <span className="or-chip-title">{e.title}</span>
                      <span className="or-chip-proj">{e.project.name}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
          )}
          <Orbit
            list={list}
            at={at}
            setAt={setSel}
            peeks={peeks}
            now={now}
            onExpand={(i) => onOpen(list[i])}
            props={props}
          />
        </main>
      )}

      {palette && <Palette projects={list} onClose={() => setPalette(false)} onPick={(i) => setSel(i)} onOpen={onOpen} onCreate={onCreate} />}
    </div>
  )
}

/* --------------------------------------------------------------- orbit --- */

const STEP = 300 // px between card centres at the front
const PER = 6 // projects per slide

/**
 * A depth carousel with real physics. Position is continuous (in cards); each
 * card's tilt, depth, scale and light come from its distance to the centre.
 * Dragging moves the position 1:1; letting go projects the landing card from
 * the release velocity and a spring pulls the stack onto it (magnetic snap).
 */
function Orbit({
  list,
  at,
  setAt,
  peeks,
  now,
  onExpand,
  props,
}: {
  list: ProjectSummary[]
  at: number
  setAt: (i: number) => void
  peeks: Record<string, Peek>
  now: Date
  onExpand: (i: number, rect: DOMRect) => void
  props: Props
}) {
  const [pos, setPos] = useState(at)
  const p = useRef({ pos: at, vel: 0, target: at, raf: 0, dragging: false })
  const drag = useRef<{ x: number; from: number; lastX: number; lastT: number; v: number; moved: boolean } | null>(null)
  const wheelIdle = useRef(0)
  const max = list.length - 1
  const still = reduced()
  const slide = Math.floor(at / PER)
  const slides = Math.ceil(list.length / PER)

  const run = useCallback(() => {
    const s = p.current
    cancelAnimationFrame(s.raf)
    const tick = () => {
      if (s.dragging) return
      if (still) {
        s.pos = s.target
        s.vel = 0
      } else {
        // critically-damped-ish spring toward the target card
        s.vel += (s.target - s.pos) * 0.09
        s.vel *= 0.72
        s.pos += s.vel
      }
      setPos(s.pos)
      if (Math.abs(s.target - s.pos) > 0.0008 || Math.abs(s.vel) > 0.0008) s.raf = requestAnimationFrame(tick)
      else {
        s.pos = s.target
        setPos(s.pos)
      }
    }
    s.raf = requestAnimationFrame(tick)
  }, [still])

  const snapTo = useCallback(
    (i: number) => {
      const t = Math.max(0, Math.min(max, Math.round(i)))
      p.current.target = t
      setAt(t)
      run()
    },
    [max, run, setAt],
  )

  // outside changes (index list, coming-up chips, palette) glide the stack there
  useEffect(() => {
    if (p.current.target !== at && !p.current.dragging) snapTo(at)
  }, [at, snapTo])
  useEffect(() => () => cancelAnimationFrame(p.current.raf), [])

  const down = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('[role="menu"], .or-more')) return
    const s = p.current
    cancelAnimationFrame(s.raf)
    s.dragging = true
    drag.current = { x: e.clientX, from: s.pos, lastX: e.clientX, lastT: performance.now(), v: 0, moved: false }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const move = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 5) d.moved = true
    const t = performance.now()
    const dt = Math.max(1, t - d.lastT)
    d.v = 0.8 * d.v + 0.2 * ((e.clientX - d.lastX) / dt) // px/ms, smoothed
    d.lastX = e.clientX
    d.lastT = t
    let next = d.from - dx / STEP
    if (next < 0) next *= 0.35 // rubber band
    if (next > max) next = max + (next - max) * 0.35
    p.current.pos = next
    setPos(next)
  }
  const up = (e: ReactPointerEvent) => {
    const d = drag.current
    drag.current = null
    p.current.dragging = false
    if (!d) return
    if (!d.moved) {
      // a tap: centre card opens, any other card comes to the front
      // pointer capture retargets events to the stage: find the card under the finger
      const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const card = hit?.closest<HTMLElement>('[data-orbit-i]')
      if (card) {
        const i = Number(card.dataset.orbitI)
        if (i === Math.round(p.current.pos)) onExpand(i, card.getBoundingClientRect())
        else snapTo(i)
      } else snapTo(p.current.pos)
      return
    }
    // momentum: project where the flick would coast to, then snap
    snapTo(p.current.pos - (d.v * 260) / STEP)
  }
  const onWheel = (e: React.WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0
    if (!delta) return
    const s = p.current
    cancelAnimationFrame(s.raf)
    s.pos = Math.max(-0.3, Math.min(max + 0.3, s.pos + delta / STEP))
    setPos(s.pos)
    window.clearTimeout(wheelIdle.current)
    wheelIdle.current = window.setTimeout(() => snapTo(s.pos), 110)
  }
  const onKey = (e: ReactKeyboardEvent) => {
    const k = e.key
    if (k === 'ArrowRight') (e.preventDefault(), snapTo(p.current.target + 1))
    else if (k === 'ArrowLeft') (e.preventDefault(), snapTo(p.current.target - 1))
    else if (k === 'Home') (e.preventDefault(), snapTo(0))
    else if (k === 'End') (e.preventDefault(), snapTo(max))
    else if (k === 'Enter' || k === ' ') {
      e.preventDefault()
      const el = document.querySelector<HTMLElement>(`[data-orbit-i="${p.current.target}"]`)
      if (el) onExpand(p.current.target, el.getBoundingClientRect())
    }
  }

  return (
    <section className="or-stage-wrap" aria-label="Projects">
      <div className="or-head">
        <h2 className="dk-label">Projects</h2>
        <span className="dk-count">
          <b>{pad(at + 1)}</b> / {pad(list.length)}
        </span>
      </div>
      <div
        className="or-stage"
        role="listbox"
        tabIndex={0}
        aria-label="Projects. Arrow keys to move, Enter to open"
        aria-activedescendant={`or-${list[at]?.id}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={onWheel}
        onKeyDown={onKey}
      >
        <div className="or-floor" aria-hidden="true" />
        {list.map((proj, i) => {
          // 6 projects per slide: only this slide's cards are on the stage
          if (Math.floor(i / PER) !== slide) return null
          const d = i - pos
          const ad = Math.abs(d)
          if (ad > 3.6) return null
          const side = Math.max(-1, Math.min(1, d))
          const x = d * STEP * (1 - Math.min(ad, 3) * 0.14)
          const style = {
            transform: `translate3d(calc(-50% + ${x}px), -50%, ${-ad * 140}px) rotateY(${-side * Math.min(ad, 1) * 34}deg) scale(${1 - Math.min(ad, 3) * 0.05})`,
            zIndex: 100 - Math.round(ad * 10),
            opacity: ad > 3 ? Math.max(0, 3.6 - ad) / 0.6 : 1 - Math.min(ad, 3) * 0.12,
            filter: still || ad < 0.05 ? undefined : `blur(${Math.min(ad, 3) * 0.9}px) saturate(${1 - Math.min(ad, 2) * 0.15})`,
          } as CSSProperties
          return (
            <OrbitCard
              key={proj.id}
              project={proj}
              index={i}
              total={list.length}
              front={ad < 0.5}
              style={style}
              peek={peeks[proj.id]}
              now={now}
              props={props}
            />
          )
        })}
      </div>

      <div className="or-controls">
        <div className="or-dots" role="tablist" aria-label="All projects">
          {list.map((proj, i) => Math.floor(i / PER) !== slide ? null : (
            <button
              key={proj.id}
              type="button"
              role="tab"
              aria-selected={i === at}
              aria-label={proj.name}
              title={proj.name}
              onClick={() => snapTo(i)}
              style={{ '--c': (COLORS[proj.color] ?? COLORS.lime).dot } as CSSProperties}
            />
          ))}
        </div>
        {slides > 1 && (
          <div className="or-pages">
            <button type="button" className="or-page" disabled={slide === 0} onClick={() => snapTo((slide - 1) * PER)}>
              ← Prev 6
            </button>
            <span>
              Slide <b>{slide + 1}</b> / {slides}
            </span>
            <button type="button" className="or-page" disabled={slide === slides - 1} onClick={() => snapTo((slide + 1) * PER)}>
              Next 6 →
            </button>
          </div>
        )}
        <div className="flex gap-1.5">
          <button type="button" className="dk-round" aria-label="Previous project" disabled={at === 0} onClick={() => snapTo(at - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="or-counter" aria-live="polite">
            <b>{pad(at + 1)}</b> / {pad(list.length)}
          </span>
          <button type="button" className="dk-round" aria-label="Next project" disabled={at === max} onClick={() => snapTo(at + 1)}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      
    </section>
  )
}

function OrbitCard({
  project,
  index,
  total,
  front,
  style,
  peek,
  now,
  props,
}: {
  project: ProjectSummary
  index: number
  total: number
  front: boolean
  style: CSSProperties
  peek?: Peek
  now: Date
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
  const events = peek?.events.length ?? project.eventCount
  const notes = peek?.notes.length ?? project.noteCount
  const next = peek?.events.filter((e) => Date.parse(e.end) > now.getTime()).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0]
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]'

  return (
    <article
      id={`or-${project.id}`}
      role="option"
      aria-selected={front}
      data-orbit-i={index}
      data-project-card={project.id}
      className={cn('or-card', front && 'or-card-front')}
      style={{ ...style, '--c': c.dot, '--cbg': c.bg, '--ct': c.text } as CSSProperties}
    >
      <span className="or-card-ghost" aria-hidden="true">
        {pad(index + 1)}
      </span>
      <div className="or-card-top">
        <span className="or-card-no">
          {pad(index + 1)}
          <i> / {pad(total)}</i>
        </span>
        {front && (
          <div ref={ref} className="relative" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={menu} className="or-more" onClick={() => setMenu((m) => !m)}>
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
      </div>
      <div className="or-card-body">
        <h3 className="or-card-name">{project.name}</h3>
        {project.description && <p className="or-card-desc">{project.description}</p>}
        <div className="or-card-next">
          {next ? (
            <>
              <span>Next · {when(next.start, now)}</span>
              {next.title}
            </>
          ) : (
            <span>Nothing scheduled</span>
          )}
        </div>
        <div className="or-card-foot">
          <span>
            {events} {events === 1 ? 'event' : 'events'} · {notes} {notes === 1 ? 'note' : 'notes'}
          </span>
          <span>{edited(project.updatedAt)}</span>
        </div>
      </div>
    </article>
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
