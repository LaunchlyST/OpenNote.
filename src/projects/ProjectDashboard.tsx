import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import {
  CalendarDays,
  Copy,
  FolderOpen,
  Lock,
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
import { Dialog, PageChrome, Spinner, btn } from './Chrome'
import { paths, projectsApi, relativeTime } from './api'
import type { ProjectInput, ProjectSummary, WorkspaceId } from './api'

type DialogState =
  | { kind: 'create' }
  | { kind: 'rename'; project: ProjectSummary }
  | { kind: 'delete'; project: ProjectSummary }
  | null

/** The project library for one workspace: create, search, open and manage projects. */
export function ProjectDashboard({ workspace }: { workspace: WorkspaceId }) {
  const { user } = useAuth()
  const { navigate } = useRouter()
  const hasPro = user?.plan === 'pro'
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
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
    // A Pro workspace without Pro is never requested; the server would refuse it anyway.
    if (workspace === 'pro' && !hasPro) return
    load()
  }, [load, workspace, hasPro])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!projects) return []
    return q
      ? projects.filter(
          (p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
        )
      : projects
  }, [projects, query])

  const recent = useMemo(
    () =>
      (projects ?? [])
        .filter((p) => p.openedAt)
        .sort((a, b) => Date.parse(b.openedAt!) - Date.parse(a.openedAt!))
        .slice(0, 4),
    [projects],
  )

  const flash = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3000)
  }

  const duplicate = async (p: ProjectSummary) => {
    try {
      const copy = await projectsApi.duplicate(p.id)
      setProjects((list) => [copy, ...(list ?? [])])
      flash(`Duplicated “${p.name}”.`)
    } catch (e) {
      flash((e as Error).message)
    }
  }

  const switcher = (
    <nav aria-label="Workspaces" className="flex items-center gap-1 rounded-xl bg-[#f1f1ef] p-1 sm:w-fit">
      {(['free', 'pro'] as const).map((ws) => {
        const locked = ws === 'pro' && !hasPro
        return (
          <button
            key={ws}
            type="button"
            disabled={locked}
            aria-current={ws === workspace ? 'page' : undefined}
            onClick={() => navigate(paths.dashboard(ws))}
            title={locked ? 'Needs an active OpenNote Pro subscription' : undefined}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition',
              ws === workspace
                ? 'bg-white text-[#191919] shadow-[0_1px_3px_rgba(0,0,0,0.12)]'
                : 'text-[#6b6a66] hover:text-[#191919]',
              locked && 'cursor-not-allowed opacity-60 hover:text-[#6b6a66]',
            )}
          >
            {locked && <Lock className="h-3 w-3" />}
            {ws === 'free' ? 'Free' : 'Pro'}
          </button>
        )
      })}
    </nav>
  )

  if (workspace === 'pro' && !hasPro) {
    return (
      <PageChrome nav={switcher}>
        <EmptyState
          icon={<Lock className="h-6 w-6" />}
          title="The Pro workspace is locked"
          body="It opens with an active OpenNote Pro subscription. Your Free projects are unaffected."
          action={
            <button type="button" className={btn.primary} onClick={() => navigate(paths.dashboard('free'))}>
              Go to Free workspace
            </button>
          }
        />
      </PageChrome>
    )
  }

  return (
    <PageChrome nav={switcher}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[12px] font-semibold uppercase tracking-[0.09em] text-[#a3a29e]">
            {workspace === 'pro' ? 'OpenNote Pro' : 'OpenNote Free'} workspace
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-[-0.03em] text-[#191919]">My Projects</h1>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative block">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a3a29e]" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects"
              className="h-10 w-full rounded-xl border border-[#e3e3e0] bg-white pl-9 pr-3 text-[13.5px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:border-[#191919] sm:w-64"
            />
          </label>
          <button type="button" className={btn.primary} onClick={() => setDialog({ kind: 'create' })}>
            <Plus className="h-4 w-4" />
            Create New Project
          </button>
        </div>
      </div>

      {notice && (
        <p role="status" className="mt-4 rounded-xl bg-[#191919] px-4 py-2.5 text-[13px] text-white">
          {notice}
        </p>
      )}

      {error ? (
        <EmptyState
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
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="No projects yet"
          body="Create a project for each part of your life — business, personal, content. Every project gets its own empty calendar, notes and settings."
          action={
            <button type="button" className={btn.primary} onClick={() => setDialog({ kind: 'create' })}>
              <Plus className="h-4 w-4" />
              Create your first project
            </button>
          }
        />
      ) : (
        <>
          {!query && recent.length > 0 && (
            <section className="mt-10" aria-labelledby="recent-heading">
              <h2 id="recent-heading" className="text-[14px] font-semibold text-[#37352f]">
                Recently opened
              </h2>
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {recent.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    compact
                    onOpen={() => navigate(paths.project(p.id))}
                    onRename={() => setDialog({ kind: 'rename', project: p })}
                    onDuplicate={() => void duplicate(p)}
                    onDelete={() => setDialog({ kind: 'delete', project: p })}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="mt-10" aria-labelledby="all-heading">
            <h2 id="all-heading" className="text-[14px] font-semibold text-[#37352f]">
              {query ? `Results for “${query.trim()}”` : 'All projects'}
              <span className="ml-2 font-normal text-[#a3a29e]">{filtered.length}</span>
            </h2>
            {filtered.length === 0 ? (
              <p className="mt-6 text-[14px] text-[#8f8e8a]">No projects match your search.</p>
            ) : (
              <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {!query && (
                  <button
                    type="button"
                    onClick={() => setDialog({ kind: 'create' })}
                    className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-[#dcdbd7] bg-white/50 text-[#6b6a66] transition hover:border-[#191919] hover:text-[#191919]"
                  >
                    <Plus className="h-6 w-6" />
                    <span className="text-[13.5px] font-semibold">Create New Project</span>
                  </button>
                )}
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    onOpen={() => navigate(paths.project(p.id))}
                    onRename={() => setDialog({ kind: 'rename', project: p })}
                    onDuplicate={() => void duplicate(p)}
                    onDelete={() => setDialog({ kind: 'delete', project: p })}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {dialog?.kind === 'create' && (
        <ProjectFormDialog
          title="Create New Project"
          submitLabel="Create project"
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const project = await projectsApi.create(workspace, input)
            navigate(paths.project(project.id))
          }}
        />
      )}
      {dialog?.kind === 'rename' && (
        <ProjectFormDialog
          title="Edit project"
          submitLabel="Save changes"
          initial={dialog.project}
          onClose={() => setDialog(null)}
          onSubmit={async (input) => {
            const updated = await projectsApi.update(dialog.project.id, input)
            setProjects((list) => (list ?? []).map((p) => (p.id === updated.id ? updated : p)))
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
            flash(`Deleted “${dialog.project.name}”.`)
            setDialog(null)
          }}
        />
      )}
    </PageChrome>
  )
}

function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode
  title: string
  body: string
  action?: ReactNode
}) {
  return (
    <div className="mx-auto mt-16 flex max-w-md flex-col items-center text-center">
      {icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#e8f7b5] text-[#4b6410]">{icon}</span>
      )}
      <h2 className="mt-4 text-[18px] font-semibold tracking-[-0.02em] text-[#191919]">{title}</h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-[#6b6a66]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function ProjectCard({
  project,
  compact = false,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary
  compact?: boolean
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
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setMenu(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-[#37352f] transition hover:bg-[#f3f3f1]'

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-[#e3e3e0] bg-white transition hover:-translate-y-0.5 hover:border-[#cfcfcb] hover:shadow-[0_12px_32px_-16px_rgba(0,0,0,0.25)]">
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col text-left" aria-label={`Open ${project.name}`}>
        <div
          className={cn('relative w-full', compact ? 'h-16' : 'h-24')}
          style={{ background: `linear-gradient(135deg, ${color.bg}, ${color.border})` }}
        >
          {!compact && (
            <div className="absolute inset-x-4 bottom-3 grid grid-cols-7 gap-1 opacity-60" aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} className="h-2 rounded-sm bg-white/70" />
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-1 flex-col p-4">
          <span className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color.dot }} />
            <span className="truncate text-[14.5px] font-semibold text-[#191919]">{project.name}</span>
          </span>
          {!compact && project.description && (
            <span className="mt-1 line-clamp-2 text-[12.5px] text-[#6b6a66]">{project.description}</span>
          )}
          <span className="mt-auto pt-3 text-[12px] text-[#8f8e8a]">
            Edited {relativeTime(project.updatedAt)}
            {!compact && ` · ${project.eventCount} event${project.eventCount === 1 ? '' : 's'}, ${project.noteCount} note${project.noteCount === 1 ? '' : 's'}`}
          </span>
        </div>
      </button>

      <div ref={ref} className="absolute right-2 top-2">
        <button
          type="button"
          aria-label={`Actions for ${project.name}`}
          aria-haspopup="menu"
          aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}
          className="grid h-8 w-8 place-items-center rounded-lg bg-white/80 text-[#37352f] opacity-100 shadow-sm backdrop-blur transition hover:bg-white sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 aria-expanded:opacity-100"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menu && (
          <div role="menu" className="absolute right-0 z-30 mt-1 w-44 rounded-xl border border-[#ececea] bg-white p-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.3)]">
            <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onOpen() }}>
              <FolderOpen className="h-4 w-4" /> Open
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onRename() }}>
              <Pencil className="h-4 w-4" /> Rename / edit
            </button>
            <button type="button" role="menuitem" className={item} onClick={() => { setMenu(false); onDuplicate() }}>
              <Copy className="h-4 w-4" /> Duplicate
            </button>
            <button type="button" role="menuitem" className={cn(item, 'text-[#dc2626] hover:bg-[#fef2f2]')} onClick={() => { setMenu(false); onDelete() }}>
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ProjectFormDialog({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: {
  title: string
  submitLabel: string
  initial?: ProjectSummary
  onClose: () => void
  onSubmit: (input: ProjectInput) => Promise<void>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [color, setColor] = useState<EventColorId>(initial?.color ?? 'lime')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Give your project a name.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), color, description: description.trim() })
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  const field =
    'mt-1.5 w-full rounded-xl border border-[#e3e3e0] bg-white px-3 py-2.5 text-[14px] text-[#191919] outline-none transition placeholder:text-[#a3a29e] focus:border-[#191919]'

  return (
    <Dialog title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="text-[13px] font-medium text-[#37352f]">Project name</span>
          <input
            autoFocus
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Business"
            className={field}
          />
        </label>
        <fieldset>
          <legend className="text-[13px] font-medium text-[#37352f]">Colour</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {COLOR_IDS.map((id) => (
              <button
                key={id}
                type="button"
                aria-label={COLORS[id].name}
                aria-pressed={color === id}
                onClick={() => setColor(id)}
                className={cn(
                  'h-8 w-8 rounded-full ring-offset-2 transition',
                  color === id ? 'ring-2 ring-[#191919]' : 'hover:ring-2 hover:ring-[#dcdbd7]',
                )}
                style={{ background: COLORS[id].dot }}
              />
            ))}
          </div>
        </fieldset>
        <label className="block">
          <span className="text-[13px] font-medium text-[#37352f]">
            Description <span className="font-normal text-[#a3a29e]">(optional)</span>
          </span>
          <textarea
            value={description}
            maxLength={500}
            rows={3}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this project for?"
            className={cn(field, 'resize-none')}
          />
        </label>
        {error && (
          <p role="alert" className="text-[13px] text-[#dc2626]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={btn.secondary} onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className={btn.primary} disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function DeleteDialog({
  project,
  onClose,
  onDeleted,
}: {
  project: ProjectSummary
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Dialog title="Delete project?" onClose={onClose}>
      <p className="text-[14px] leading-relaxed text-[#6b6a66]">
        “<strong className="text-[#191919]">{project.name}</strong>” and all of its events, notes and settings will be
        permanently deleted. This can’t be undone.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-[13px] text-[#dc2626]">
          {error}
        </p>
      )}
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
