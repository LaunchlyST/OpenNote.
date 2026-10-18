import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Copy,
  FolderOpen,
  Lock,
  LogOut,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useAuth } from '../auth'
import { useRouter } from '../router'
import { COLORS, COLOR_IDS } from '../lib/colors'
import type { EventColorId } from '../lib/colors'
import { cn } from '../lib/id'
import { Avatar } from '../components/Avatar'
import { Logo } from '../landing/components/primitives'
import { Dialog, Spinner, btn } from './Chrome'
import { paths, projectsApi } from './api'
import type { ProjectSummary, WorkspaceId } from './api'

/**
 * My Projects: one grid of square project cards with search, sorting and
 * pagination (12 per page). Search and sort apply to every project before
 * paging. The page, search and sort are remembered for this browser tab, so
 * coming back from a project restores where you were.
 */

const PAGE_SIZE = 12
type Sort = 'recent' | 'oldest' | 'az' | 'za'
const SORTS: Array<{ value: Sort; label: string }> = [
  { value: 'recent', label: 'Recently Created' },
  { value: 'oldest', label: 'Oldest Created' },
  { value: 'az', label: 'Name A–Z' },
  { value: 'za', label: 'Name Z–A' },
]

interface ViewState {
  q: string
  page: number
  sort: Sort
}

const stateKey = (ws: WorkspaceId) => `opennote.dashboard.${ws}`

function readState(ws: WorkspaceId): ViewState {
  const fallback: ViewState = { q: '', page: 1, sort: 'recent' }
  try {
    const url = new URLSearchParams(window.location.search)
    const saved = JSON.parse(window.sessionStorage.getItem(stateKey(ws)) ?? 'null') as Partial<ViewState> | null
    const sort = (url.get('sort') ?? saved?.sort ?? 'recent') as Sort
    return {
      q: url.get('q') ?? saved?.q ?? '',
      page: Math.max(1, Number(url.get('page') ?? saved?.page ?? 1) || 1),
      sort: SORTS.some((s) => s.value === sort) ? sort : 'recent',
    }
  } catch {
    return fallback
  }
}

/** "17 October 2026", or an honest fallback when the stored date is unusable. */
export function createdLabel(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : null
  if (!d || Number.isNaN(d.getTime())) return 'Creation date unavailable'
  return `Created: ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

/** How many numbered buttons the pager shows at once. */
const MAX_PAGE_BUTTONS = 4

/**
 * Page buttons with ellipses, never more than `MAX_PAGE_BUTTONS` numbers wide:
 * `1 2 3 … 20` near the start, `1 … 9 10 … 20` in the middle, `1 … 18 19 20`
 * at the end. The first and last pages are always reachable; the remaining
 * slots go to whichever pages sit closest to the current one.
 */
function pageList(current: number, total: number): Array<number | '…'> {
  if (total <= MAX_PAGE_BUTTONS) return Array.from({ length: total }, (_, i) => i + 1)

  const chosen = new Set<number>([1, total])
  // Nearest neighbours of `current` first, so the active page is always listed.
  for (let d = 0; chosen.size < MAX_PAGE_BUTTONS && d < total; d++) {
    for (const p of [current - d, current + d]) {
      if (chosen.size >= MAX_PAGE_BUTTONS) break
      if (p > 1 && p < total) chosen.add(p)
    }
  }

  const sorted = [...chosen].sort((a, b) => a - b)
  const out: Array<number | '…'> = []
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('…')
    out.push(p)
  })
  return out
}

/* ------------------------------------------------------------------ */
/* Top navigation                                                       */
/* ------------------------------------------------------------------ */

function ComingSoonLink({ label, name }: { label: string; name?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-[30px] items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition',
          open ? 'bg-[#f1f1ef] text-[#191919]' : 'text-[#5f5e5b] hover:bg-[#f3f3f1] hover:text-[#191919]',
        )}
      >
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#d6d5cf]" />
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={`${name ?? label} — Coming Soon`}
          className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-xl border border-[#ececea] bg-white p-3 text-left shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)]"
        >
          <p className="text-[13px] font-semibold text-[#191919]">Coming Soon</p>
          <p className="mt-0.5 text-[12px] leading-snug text-[#6b6a66]">This feature is being developed.</p>
        </div>
      )}
    </div>
  )
}

/**
 * The three centre links, bare on the page — no pill behind them. Each one
 * still picks up a soft background on hover and while its popover is open.
 * The labels are placeholders; swap them in `HeaderLinks` once the sections exist.
 */
function HeaderLinks() {
  return (
    <div className="inline-flex items-center gap-0.5">
      <ComingSoonLink label="Coming Soon" name="Features" />
      <ComingSoonLink label="Coming Soon" name="Explore" />
      <ComingSoonLink label="Coming Soon" name="Community" />
    </div>
  )
}

export function AccountMenu() {
  const { user, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!user) return null
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 items-center gap-2 rounded-full border border-[#ebebe9] bg-white pl-1 pr-3.5 transition hover:bg-[#f7f7f5]"
      >
        <Avatar size={30} name={user.fullName} src={user.avatar} />
        <span className="hidden max-w-[140px] truncate text-[13px] font-medium text-[#37352f] md:block">{user.fullName || user.email}</span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-[#8f8e8a] md:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-1.5 w-56 rounded-xl border border-[#ececea] bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-semibold text-[#191919]">{user.fullName}</p>
            <p className="truncate text-[11.5px] text-[#8f8e8a]">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-[#f1f1ef]" />
          <button
            type="button"
            role="menuitem"
            onClick={() => void signOut()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Cards and dialogs                                                    */
/* ------------------------------------------------------------------ */

function ProjectCard({
  project,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary
  onOpen: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const color = COLORS[project.color] ?? COLORS.lime
  const [menu, setMenu] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]'

  return (
    <article
      data-project-card={project.id}
      className="group relative flex aspect-square flex-col rounded-[14px] border border-[#e9e9e7] bg-white p-4 transition hover:border-[#d6d5d1] hover:shadow-[0_8px_24px_-14px_rgba(0,0,0,0.25)] sm:p-5"
    >
      <div className="flex items-start justify-between">
        <span className="grid h-9 w-9 place-items-center rounded-[10px]" style={{ background: color.bg, color: color.text }}>
          <CalendarDays className="h-[18px] w-[18px]" />
        </span>
        <div ref={ref} className="relative">
          <button
            type="button"
            aria-label={`Actions for ${project.name}`}
            aria-haspopup="menu"
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
            className="grid h-8 w-8 place-items-center rounded-lg text-[#8f8e8a] transition hover:bg-[#f3f3f1] hover:text-[#191919]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 z-30 mt-1 w-40 rounded-xl border border-[#ececea] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onRename() }}>
                <Pencil className="h-4 w-4" /> Rename
              </button>
              <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onDuplicate() }}>
                <Copy className="h-4 w-4" /> Duplicate
              </button>
              <button type="button" role="menuitem" className={cn(item, 'text-[#b4453c] hover:bg-[#fdf3f2]')} onClick={() => { setMenu(false); onDelete() }}>
                <Trash2 className="h-4 w-4" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="mt-auto min-w-0 text-left" aria-label={`Open ${project.name}`}>
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-[#191919]">{project.name}</h3>
        {project.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-[#8f8e8a]">{project.description}</p>}
      </button>

      <div className="mt-auto pt-3">
        <p className="truncate text-[11.5px] text-[#a3a29e]" data-testid="created">
          {createdLabel(project.createdAt)}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#191919] transition-[gap] group-hover:gap-1.5"
        >
          Open Project <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  )
}

function CreateDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (input: { name: string; color: EventColorId; description: string }) => Promise<void> }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<EventColorId>('lime')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) return setError('Give your project a name.')
    setBusy(true)
    setError(null)
    try {
      await onCreate({ name: name.trim(), color, description: description.trim() })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const field =
    'mt-1.5 w-full rounded-xl border border-[#e3e3e0] bg-white px-3 py-2.5 text-[14px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:border-[#191919]'
  return (
    <Dialog title="Create Project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-[#37352f]">Project name</span>
          <input autoFocus value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. My Business Calendar" className={field} />
        </label>
        <label className="block">
          <span className="text-[13px] font-medium text-[#37352f]">
            Description <span className="font-normal text-[#a3a29e]">(optional)</span>
          </span>
          <textarea value={description} maxLength={500} rows={2} onChange={(e) => setDescription(e.target.value)} placeholder="What is this project for?" className={cn(field, 'resize-none')} />
        </label>
        <fieldset>
          <legend className="text-[13px] font-medium text-[#37352f]">
            Colour <span className="font-normal text-[#a3a29e]">(optional)</span>
          </legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={COLORS[id].name}
                aria-pressed={color === id}
                onClick={() => setColor(id)}
                className={cn('h-7 w-7 rounded-full ring-offset-2 transition', color === id ? 'ring-2 ring-[#191919]' : 'hover:ring-2 hover:ring-[#dcdbd7]')}
                style={{ background: COLORS[id].dot }}
              />
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-[13px] text-[#dc2626]">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? 'Creating…' : 'Create Project'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function RenameDialog({ project, onClose, onSave }: { project: ProjectSummary; onClose: () => void; onSave: (name: string) => Promise<void> }) {
  const [name, setName] = useState(project.name)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (busy) return
    if (!name.trim()) return setError('The name cannot be empty.')
    setBusy(true)
    try {
      await onSave(name.trim())
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  return (
    <Dialog title="Rename project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-[#37352f]">Project name</span>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setName(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#e3e3e0] px-3 py-2.5 text-[14px] text-[#191919] outline-none focus:border-[#191919]"
          />
        </label>
        {error && <p role="alert" className="text-[13px] text-[#dc2626]">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy || name.trim() === project.name}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteDialog({ project, onClose, onDeleted }: { project: ProjectSummary; onClose: () => void; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog title="Delete project?" onClose={onClose}>
      <p className="text-[14px] leading-relaxed text-[#6b6a66]">
        “<strong className="text-[#191919]">{project.name}</strong>” will be permanently deleted, including its calendar events, notes and settings. This
        can’t be undone.
      </p>
      {error && <p role="alert" className="mt-3 text-[13px] text-[#dc2626]">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" className={btn.secondary} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={btn.danger}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await projectsApi.remove(project.id)
              onDeleted()
            } catch (e) {
              setError((e as Error).message)
              setBusy(false)
            }
          }}
        >
          {busy ? 'Deleting…' : 'Delete project'}
        </button>
      </div>
    </Dialog>
  )
}

function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  const base = 'inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-lg px-2 text-[12.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-35'
  const plain = 'text-[#5f5e5b] hover:bg-[#f1f1ef] hover:text-[#191919] disabled:hover:bg-transparent'
  return (
    <nav aria-label="Project pages" className="flex flex-wrap items-center justify-center gap-1">
      <button type="button" className={cn(base, plain)} disabled={page === 1} onClick={() => onPage(1)} aria-label="First page">
        <ChevronsLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">First</span>
      </button>
      <button type="button" className={cn(base, plain)} disabled={page === 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
        <ChevronLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Previous</span>
      </button>
      {pageList(page, pages).map((p, i) =>
        p === '…' ? (
          <span key={`e${i}`} className="px-1 text-[12.5px] text-[#a3a29e]">
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            aria-label={`Page ${p}`}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onPage(p)}
            className={cn(base, p === page ? 'bg-[#191919] text-white' : plain)}
          >
            {p}
          </button>
        ),
      )}
      <button type="button" className={cn(base, plain)} disabled={page === pages} onClick={() => onPage(page + 1)} aria-label="Next page">
        <span className="hidden sm:inline">Next</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button type="button" className={cn(base, plain)} disabled={page === pages} onClick={() => onPage(pages)} aria-label="Last page">
        <span className="hidden sm:inline">Last</span>
        <ChevronsRight className="h-3.5 w-3.5" />
      </button>
    </nav>
  )
}

function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f1f1ef] text-[#6b6a66]">
        <FolderOpen className="h-5 w-5" />
      </span>
      <h2 className="mt-4 text-[16px] font-semibold text-[#191919]">{title}</h2>
      {body && <p className="mt-1 text-[13.5px] text-[#6b6a66]">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Page                                                                 */
/* ------------------------------------------------------------------ */

type DialogState = { kind: 'create' } | { kind: 'rename'; project: ProjectSummary } | { kind: 'delete'; project: ProjectSummary } | null

export function MyProjects({ workspace }: { workspace: WorkspaceId }) {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const hasPro = user?.plan === 'pro'
  const locked = workspace === 'pro' && !hasPro
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<ViewState>(() => readState(workspace))
  const [dialog, setDialog] = useState<DialogState>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    projectsApi
      .list(workspace)
      .then(setProjects)
      .catch((e: Error) => setError(e.message))
  }, [workspace])

  useEffect(() => {
    if (!locked) load()
  }, [load, locked])

  // Remember page / search / sort (tab session + shareable URL).
  useEffect(() => {
    try {
      window.sessionStorage.setItem(stateKey(workspace), JSON.stringify(view))
      const qs = new URLSearchParams()
      if (view.q) qs.set('q', view.q)
      if (view.page > 1) qs.set('page', String(view.page))
      if (view.sort !== 'recent') qs.set('sort', view.sort)
      const search = qs.toString()
      window.history.replaceState(window.history.state, '', `${window.location.pathname}${search ? `?${search}` : ''}`)
    } catch {
      /* storage blocked */
    }
  }, [view, workspace])

  const filtered = useMemo(() => {
    const q = view.q.trim().toLowerCase()
    const list = (projects ?? []).filter((p) => !q || p.name.toLowerCase().includes(q))
    const t = (p: ProjectSummary) => Date.parse(p.createdAt) || 0
    const cmp: Record<Sort, (a: ProjectSummary, b: ProjectSummary) => number> = {
      recent: (a, b) => t(b) - t(a),
      oldest: (a, b) => t(a) - t(b),
      az: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      za: (a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }),
    }
    return [...list].sort(cmp[view.sort])
  }, [projects, view.q, view.sort])

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const page = Math.min(view.page, pages)
  // A deletion that empties the last page moves to the nearest valid page.
  useEffect(() => {
    if (projects && view.page !== page) setView((v) => ({ ...v, page }))
  }, [projects, page, view.page])
  const start = (page - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3000)
  }

  const createButton = (
    <button
      type="button"
      onClick={() => setDialog({ kind: 'create' })}
      className="inline-flex h-12 items-center gap-2 rounded-lg bg-gradient-to-b from-[#2c2c68] to-[#171740] px-5 text-[14px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_2px_6px_rgba(27,27,70,0.22),0_12px_26px_-12px_rgba(27,27,70,0.85)] transition hover:from-[#35357e] hover:to-[#1e1e52] active:translate-y-px"
    >
      <Plus className="h-[18px] w-[18px]" />
      Create Project
    </button>
  )

  /**
   * One row, no absolute positioning: brand left / links centred / account
   * right. The `1fr auto 1fr` track is what keeps the links dead centre of the
   * window no matter how wide the brand or the account chip grows.
   */
  const top = (
    <header className="sticky top-0 z-30">
      <div className="mx-auto w-full px-4 sm:px-6">
        <div className="grid h-16 grid-cols-[1fr_auto_1fr] items-center gap-3">
          <a href="/" aria-label="Desknoty home" className="justify-self-start">
            <Logo size="sm" />
          </a>
          <nav aria-label="Explore Desknoty" className="hidden justify-self-center md:block">
            <HeaderLinks />
          </nav>
          <div className="justify-self-end">
            <AccountMenu />
          </div>
        </div>
      </div>
      <div className="flex justify-center pb-3 md:hidden">
        <HeaderLinks />
      </div>
    </header>
  )

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-y-auto overflow-x-hidden bg-[#fafaf9]">
      {top}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-7 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-[#191919]">My Projects</h1>
            <p className="mt-1 text-[13.5px] text-[#8f8e8a]">Organise your projects, calendars and notes in one place.</p>
          </div>
          {!locked && createButton}
        </div>

        {locked ? (
          <Empty
            title="The Pro workspace is locked"
            body="It opens with an active Desknoty Pro subscription. Your Free projects are unaffected."
            action={
              <button type="button" className={btn.primary} onClick={() => navigate(paths.dashboard('free'))}>
                <Lock className="h-4 w-4" /> Go to Free workspace
              </button>
            }
          />
        ) : (
          <>
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative block w-full sm:max-w-sm">
                <span className="sr-only">Search projects</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a29e]" />
                <input
                  type="search"
                  value={view.q}
                  onChange={(e) => setView((v) => ({ ...v, q: e.target.value, page: 1 }))}
                  placeholder="Search your projects..."
                  className="h-10 w-full rounded-xl border border-[#e3e3e0] bg-white pl-9 pr-3 text-[13.5px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:border-[#191919] focus:shadow-[0_0_0_3px_rgba(25,25,25,0.06)]"
                />
              </label>
              <label className="relative inline-block">
                <span className="sr-only">Sort projects</span>
                <select
                  aria-label="Sort projects"
                  value={view.sort}
                  onChange={(e) => setView((v) => ({ ...v, sort: e.target.value as Sort, page: 1 }))}
                  className="h-10 appearance-none rounded-xl border border-[#e3e3e0] bg-white pl-3 pr-9 text-[13px] font-medium text-[#37352f] outline-none transition hover:border-[#cfcfcb] focus:border-[#191919]"
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8f8e8a]" />
              </label>
            </div>

            {notice && (
              <p role="alert" className="mt-4 text-[13px] text-[#b4453c]">
                {notice}
              </p>
            )}

            {error ? (
              <Empty
                title="Couldn’t load your projects"
                body={error}
                action={
                  <button type="button" className={btn.secondary} onClick={load}>
                    Try again
                  </button>
                }
              />
            ) : !projects ? (
              <Spinner label="Loading your projects…" />
            ) : projects.length === 0 ? (
              <Empty
                title="Your workspace starts here"
                body="Create your first project to organise your calendar and notes."
              />
            ) : filtered.length === 0 ? (
              <Empty title="No matching projects found." body="Try a different name." />
            ) : (
              <>
                <p className="mt-5 text-[12.5px] text-[#8f8e8a]" data-testid="project-count">
                  Showing {start + 1}–{start + visible.length} of {filtered.length} project{filtered.length === 1 ? '' : 's'}
                </p>
                <div className="mt-3 grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="project-grid">
                  {visible.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onOpen={() => navigate(paths.project(p.id))}
                      onRename={() => setDialog({ kind: 'rename', project: p })}
                      onDuplicate={async () => {
                        try {
                          const copy = await projectsApi.duplicate(p.id)
                          setProjects((list) => [copy, ...(list ?? [])])
                        } catch (e) {
                          flash((e as Error).message)
                        }
                      }}
                      onDelete={() => setDialog({ kind: 'delete', project: p })}
                    />
                  ))}
                </div>
                {/* Bottom centre. Shown whenever there is something to page through, so the
                    control is discoverable; on a single page every button is disabled. */}
                <div className="mt-8 flex justify-center sm:mt-auto sm:pt-10">
                  <Pager page={page} pages={pages} onPage={(n) => setView((v) => ({ ...v, page: n }))} />
                </div>
              </>
            )}
          </>
        )}
      </main>

      {dialog?.kind === 'create' && (
        <CreateDialog
          onClose={() => setDialog(null)}
          onCreate={async (input) => {
            const project = await projectsApi.create(workspace, input)
            setProjects((list) => [project, ...(list ?? [])])
            setView((v) => ({ ...v, q: '', sort: 'recent', page: 1 }))
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <RenameDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onSave={async (name) => {
            const updated = await projectsApi.update(dialog.project.id, { name })
            setProjects((list) => (list ?? []).map((p) => (p.id === updated.id ? { ...p, name: updated.name } : p)))
            setDialog(null)
          }}
        />
      )}
      {dialog?.kind === 'delete' && (
        <DeleteDialog
          project={dialog.project}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            setProjects((list) => (list ?? []).filter((p) => p.id !== dialog.project.id))
            setDialog(null)
          }}
        />
      )}
    </div>
  )
}
