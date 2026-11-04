import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowUpRight, CalendarDays, Command, Copy, FileText, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { COLORS } from '../lib/colors'
import { cn } from '../lib/id'
import { AppIcon } from '../landing/components/primitives'
import type { ProjectSummary } from './api'

/**
 * The Pro home: a command centre rather than a file list. A greeting and a
 * live "today" dial up top, projects as a scrolling row of tall cards, and a
 * Ctrl/⌘ K palette in place of the search bar and pager.
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

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), ms)
    return () => window.clearInterval(id)
  }, [ms])
  return now
}

function ago(iso: string | null) {
  if (!iso) return 'Not opened yet'
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000)
  if (m < 1) return 'Opened just now'
  if (m < 60) return `Opened ${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `Opened ${h} h ago`
  return `Opened ${Math.round(h / 24)} d ago`
}

export function ProHome(props: Props) {
  const { name, projects, error, onRetry, account, onCreate, onOpen } = props
  const now = useNow()
  const [palette, setPalette] = useState(false)
  const rail = useRef<HTMLDivElement | null>(null)

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
  const part = h < 5 ? 'Still up' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
  const first = name.trim().split(/\s+/)[0] || 'there'
  const dayDone = (h * 60 + now.getMinutes()) / 1440
  const sorted = useMemo(
    () => [...(projects ?? [])].sort((a, b) => Date.parse(b.openedAt ?? b.updatedAt) - Date.parse(a.openedAt ?? a.updatedAt)),
    [projects],
  )
  const events = sorted.reduce((n, p) => n + p.eventCount, 0)
  const notes = sorted.reduce((n, p) => n + p.noteCount, 0)
  const last = sorted[0]

  return (
    <div className="ph relative z-10 flex min-h-full flex-col">
      {/* ---- top bar ---- */}
      <header className="ph-top">
        <a href="/" aria-label="Desknoty home" className="inline-flex items-center gap-2">
          <AppIcon className="h-7 w-7 text-[28px]" />
          <span className="ph-brand">Desknoty</span>
          <span className="pro-badge">PRO</span>
        </a>
        <button type="button" className="ph-search" onClick={() => setPalette(true)}>
          <Search className="h-4 w-4" />
          <span>Jump to a project…</span>
          <kbd>
            <Command className="h-3 w-3" />K
          </kbd>
        </button>
        <div className="justify-self-end">{account}</div>
      </header>

      {/* ---- hero: greeting + today dial ---- */}
      <section className="ph-hero">
        <div className="min-w-0">
          <p className="ph-kicker">{now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1 className="ph-hello">
            {part},
            <br />
            <span className="pro-name">{first}.</span>
          </h1>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button type="button" onClick={onCreate} className="ph-cta">
              <Plus className="h-4 w-4" /> New project
            </button>
            {last && (
              <button type="button" onClick={() => onOpen(last)} className="ph-ghost">
                Continue <b>{last.name}</b> <ArrowUpRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="ph-today" style={{ '--done': dayDone } as CSSProperties}>
          <svg viewBox="0 0 120 120" className="ph-dial" aria-hidden="true">
            <circle cx="60" cy="60" r="52" className="ph-dial-track" />
            <circle cx="60" cy="60" r="52" className="ph-dial-fill" pathLength={1} />
          </svg>
          <div className="ph-dial-in">
            <span className="ph-clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
            <span className="ph-dial-label">{Math.round(dayDone * 100)}% of today gone</span>
          </div>
          <dl className="ph-totals">
            <div>
              <dt>Projects</dt>
              <dd>{sorted.length}</dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{events}</dd>
            </div>
            <div>
              <dt>Notes</dt>
              <dd>{notes}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ---- projects rail ---- */}
      <section className="ph-shelf">
        <div className="ph-shelf-head">
          <h2>Your projects</h2>
          <div className="flex gap-2">
            {(['left', 'right'] as const).map((d) => (
              <button
                key={d}
                type="button"
                aria-label={d === 'left' ? 'Scroll left' : 'Scroll right'}
                className="ph-arrow"
                onClick={() => rail.current?.scrollBy({ left: d === 'left' ? -360 : 360, behavior: 'smooth' })}
              >
                {d === 'left' ? '←' : '→'}
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <div className="ph-empty">
            <p>Couldn’t load your projects. {error}</p>
            <button type="button" className="ph-ghost" onClick={onRetry}>
              Try again
            </button>
          </div>
        ) : !projects ? (
          <div className="ph-empty">
            <p>Loading your projects…</p>
          </div>
        ) : (
          <div ref={rail} className="ph-rail" data-testid="project-grid">
            <button type="button" className="ph-new" onClick={onCreate}>
              <span className="ph-new-plus">
                <Plus className="h-6 w-6" />
              </span>
              <span className="ph-new-title">New project</span>
              <span className="ph-new-sub">Start a calendar, notes and plans for a client or idea.</span>
            </button>
            {sorted.map((p, i) => (
              <Tile key={p.id} project={p} index={i} {...props} />
            ))}
          </div>
        )}
      </section>

      {palette && <Palette projects={sorted} onClose={() => setPalette(false)} onOpen={onOpen} onCreate={onCreate} />}
    </div>
  )
}

function Tile({ project, index, onOpen, onRename, onDuplicate, onDelete }: Props & { project: ProjectSummary; index: number }) {
  const c = COLORS[project.color] ?? COLORS.lime
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!menu) return
    const off = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    document.addEventListener('mousedown', off)
    return () => document.removeEventListener('mousedown', off)
  }, [menu])
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]'

  return (
    <article
      data-project-card={project.id}
      className="ph-tile"
      style={{ '--tile': c.dot, '--i': index } as CSSProperties}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        e.currentTarget.style.setProperty('--rx', `${-y * 8}deg`)
        e.currentTarget.style.setProperty('--ry', `${x * 10}deg`)
        e.currentTarget.style.setProperty('--sx', `${(x + 0.5) * 100}%`)
        e.currentTarget.style.setProperty('--sy', `${(y + 0.5) * 100}%`)
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.setProperty('--rx', '0deg')
        e.currentTarget.style.setProperty('--ry', '0deg')
      }}
    >
      <div className="ph-tile-top">
        <span className="ph-tile-mono" aria-hidden="true">
          {project.name.trim().charAt(0).toUpperCase() || '•'}
        </span>
        <div ref={ref} className="relative">
          <button type="button" aria-label={`Actions for ${project.name}`} aria-haspopup="menu" aria-expanded={menu} className="ph-tile-more" onClick={() => setMenu((m) => !m)}>
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-[#ececea] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onRename(project) }}>
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onDuplicate(project) }}>
                <Copy className="h-4 w-4" /> Duplicate
              </button>
              <button type="button" role="menuitem" className={cn(item, 'text-[#b4453c] hover:bg-[#fdf3f2]')} onClick={() => { setMenu(false); onDelete(project) }}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <button type="button" className="ph-tile-body" onClick={() => onOpen(project)} aria-label={`Open ${project.name}`}>
        <h3>{project.name}</h3>
        {project.description && <p className="ph-tile-desc">{project.description}</p>}
        <div className="ph-tile-meta">
          <span>
            <CalendarDays className="h-3.5 w-3.5" /> {project.eventCount}
          </span>
          <span>
            <FileText className="h-3.5 w-3.5" /> {project.noteCount}
          </span>
        </div>
        <span className="ph-tile-foot">
          {ago(project.openedAt)}
          <ArrowUpRight className="ph-tile-go h-4 w-4" />
        </span>
      </button>
    </article>
  )
}

function Palette({
  projects,
  onClose,
  onOpen,
  onCreate,
}: {
  projects: ProjectSummary[]
  onClose: () => void
  onOpen: (p: ProjectSummary) => void
  onCreate: () => void
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = projects.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
  const rows: Array<{ label: string; run: () => void; sub?: string }> = [
    ...list.map((p) => ({ label: p.name, sub: `${p.eventCount} events · ${p.noteCount} notes`, run: () => onOpen(p) })),
    { label: q ? `Create “${q}”` : 'New project', run: onCreate },
  ]
  const go = (i: number) => {
    onClose()
    rows[i]?.run()
  }
  return (
    <div className="ph-veil" role="dialog" aria-modal="true" aria-label="Jump to a project" onMouseDown={onClose}>
      <div className="ph-palette" onMouseDown={(e) => e.stopPropagation()}>
        <label className="ph-palette-in">
          <Search className="h-4 w-4" />
          <input
            autoFocus
            value={q}
            placeholder="Search projects…"
            onChange={(e) => {
              setQ(e.target.value)
              setSel(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              if (e.key === 'ArrowDown') setSel((s) => Math.min(rows.length - 1, s + 1))
              if (e.key === 'ArrowUp') setSel((s) => Math.max(0, s - 1))
              if (e.key === 'Enter') go(sel)
            }}
          />
          <kbd>Esc</kbd>
        </label>
        <ul>
          {rows.map((r, i) => (
            <li key={r.label + i}>
              <button type="button" className={cn('ph-row', i === sel && 'ph-row-on')} onMouseEnter={() => setSel(i)} onClick={() => go(i)}>
                <span>{r.label}</span>
                {r.sub && <small>{r.sub}</small>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
