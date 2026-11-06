import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, Command, Copy, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { COLORS } from '../lib/colors'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'
import { projectsApi } from './api'
import type { ProjectSummary } from './api'
import type { ProjectData } from '../store'
import { StreakChip } from './StreakChip'
import { VideoBoard } from './VideoBoard'
import { PagePeel } from './PagePeel'
import { VideoSoon } from './VideoSoon'
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


export function ProHome(props: Props) {
  const { name, projects, error, onRetry, account, onCreate, onOpen } = props
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  // last edited first: that is "where I left off"
  const list = useMemo(() => [...(projects ?? [])].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)), [projects])

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
  // the page flips over to Video projects and back
  const [side, setSide] = useState<'projects' | 'videos'>(() => (sessionStorage.getItem('desknoty.pro.side') === 'videos' ? 'videos' : 'projects'))
  const turn = (to: 'projects' | 'videos') => {
    setSide(to)
    try {
      sessionStorage.setItem('desknoty.pro.side', to)
    } catch {
      /* storage blocked */
    }
  }
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

  const projectsView = (
      <>
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
            <Plus className="h-[18px] w-[18px]" /> Join now
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
                      onClick={() => onOpen(e.project)}
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
          <ProjectGrid list={list} peeks={peeks} now={now} props={props} />
          <section className="pj-cta">
            <span className="pj-cta-glow" aria-hidden="true" />
            <div>
              <h2>Start something new today.</h2>
              <p>Every project gets its own calendar, notes and plans.</p>
            </div>
            <button type="button" onClick={onCreate}>
              Join now <ArrowRight className="h-4 w-4" />
            </button>
          </section>
        </main>
      )}
      </>
  )

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

      <div className="pp-page">{side === 'videos' ? <VideoBoard /> : projectsView}</div>

      <PagePeel
        key={side}
        label={side === 'videos' ? 'My Projects' : 'Video projects'}
        tone={side === 'videos' ? '#f3efe6' : '#1c1b1f'}
        onDone={() => turn(side === 'videos' ? 'projects' : 'videos')}
      >
        {side === 'videos' ? <div className="pp-under-pro">{projectsView}</div> : <VideoSoon />}
      </PagePeel>

      {palette && <Palette projects={list} onClose={() => setPalette(false)} onPick={(i) => onOpen(list[i])} onOpen={onOpen} onCreate={onCreate} />}
    </div>
  )
}

/* --------------------------------------------------------------- orbit --- */


/**
 * A depth carousel with real physics. Position is continuous (in cards); each
 * card's tilt, depth, scale and light come from its distance to the centre.
 * Dragging moves the position 1:1; letting go projects the landing card from
 * the release velocity and a spring pulls the stack onto it (magnetic snap).
 */
function ProjectGrid({ list, peeks, now, props }: { list: ProjectSummary[]; peeks: Record<string, Peek>; now: Date; props: Props }) {
  const [page, setPage] = useState(0)
  const pages = Math.max(1, Math.ceil(list.length / GRID))
  const pg = Math.min(page, pages - 1)
  return (
    <>
      <div className="or-head">
        <h2 className="dk-label">Projects</h2>
        <span className="dk-count">
          <b>{pad(list.length)}</b> {list.length === 1 ? 'project' : 'projects'}
        </span>
      </div>
      <div className="pg-grid" role="list">
        {list.slice(pg * GRID, pg * GRID + GRID).map((p, i) => (
          <ProjectCard key={p.id} project={p} index={pg * GRID + i} delay={i} peek={peeks[p.id]} now={now} props={props} />
        ))}
      </div>
      {pages > 1 && (
        <div className="vg-pager">
          <button type="button" className="dk-round" aria-label="Previous page" disabled={pg === 0} onClick={() => setPage(pg - 1)}>
            <ArrowLeft className="h-4 w-4" />
          </button>
          {Array.from({ length: pages }, (_, n) => (
            <button key={n} type="button" className={cn('vg-num', n === pg && 'vg-num-on')} aria-label={`Page ${n + 1}`} aria-current={n === pg ? 'page' : undefined} onClick={() => setPage(n)}>
              {n + 1}
            </button>
          ))}
          <button type="button" className="dk-round" aria-label="Next page" disabled={pg === pages - 1} onClick={() => setPage(pg + 1)}>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
const GRID = 8

function ProjectCard({ project, index, delay, peek, now, props }: { project: ProjectSummary; index: number; delay: number; peek?: Peek; now: Date; props: Props }) {
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
    <div role="listitem" className="pg-card" data-project-card={project.id} style={{ '--c': c.dot, '--cbg': c.bg, '--ct': c.text, '--i': delay } as CSSProperties}>
      <button type="button" className="pg-hit" aria-label={`Open ${project.name}`} onClick={() => props.onOpen(project)} />
      <div className="pg-cover">
        <span className="pg-no">{pad(index + 1)}</span>
        <span className="pg-open" aria-hidden="true">
          Open <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="pg-body">
        <div className="flex items-start justify-between gap-2">
          <h3 className="pg-name">{project.name}</h3>
          <div ref={ref} className="relative z-[2]">
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
        </div>
        {project.description && <p className="pg-desc">{project.description}</p>}
        <p className="pg-next">{next ? <>Next · {when(next.start, now)} — {next.title}</> : 'Nothing scheduled'}</p>
        <div className="pg-foot">
          <span>
            {events} {events === 1 ? 'event' : 'events'} · {notes} {notes === 1 ? 'note' : 'notes'}
          </span>
          <span>{edited(project.updatedAt)}</span>
        </div>
      </div>
    </div>
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
