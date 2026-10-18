import type { ProjectData } from '../store'
import type { EventColorId } from '../lib/colors'
import { apiUrl } from '../lib/api-base'

/** A workspace groups projects by plan. Pro needs an active Pro subscription. */
export type WorkspaceId = 'free' | 'pro'

export interface ProjectSummary {
  id: string
  workspace: WorkspaceId
  name: string
  color: EventColorId
  description: string
  createdAt: string
  updatedAt: string
  openedAt: string | null
  eventCount: number
  noteCount: number
}

export interface ProjectInput {
  name: string
  color: EventColorId
  description?: string
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(`/api/projects${path}`), {
    credentials: 'include',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) {
    throw new ApiError(body.error ?? 'Something went wrong. Please try again.', res.status)
  }
  return body
}

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export const projectsApi = {
  list: (workspace: WorkspaceId) =>
    call<{ projects: ProjectSummary[] }>(`?workspace=${workspace}`).then((r) => r.projects),
  create: (workspace: WorkspaceId, input: ProjectInput) =>
    call<{ project: ProjectSummary }>('', {
      method: 'POST',
      body: JSON.stringify({ workspace, ...input }),
    }).then((r) => r.project),
  open: (id: string) =>
    call<{ project: ProjectSummary; data: ProjectData }>(`/${encodeURIComponent(id)}`),
  update: (id: string, patch: Partial<ProjectInput>) =>
    call<{ project: ProjectSummary }>(`/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }).then((r) => r.project),
  duplicate: (id: string) =>
    call<{ project: ProjectSummary }>(`/${encodeURIComponent(id)}/duplicate`, {
      method: 'POST',
    }).then((r) => r.project),
  remove: (id: string) =>
    call<{ ok: true }>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
}

/** App paths for the project flow. */
export const paths = {
  picker: '/app',
  dashboard: (ws: WorkspaceId) => `/app/${ws}`,
  project: (id: string) => `/app/project/${encodeURIComponent(id)}`,
}

export type WorkspaceRoute =
  | { kind: 'picker' }
  | { kind: 'dashboard'; workspace: WorkspaceId }
  | { kind: 'project'; id: string }

export function parseWorkspaceRoute(path: string): WorkspaceRoute | null {
  if (path === '/app' || path === '/dashboard') return { kind: 'picker' }
  if (path === '/app/free' || path === '/app/pro')
    return { kind: 'dashboard', workspace: path.slice(5) as WorkspaceId }
  const m = path.match(/^\/app\/project\/([^/]+)$/)
  if (m) return { kind: 'project', id: decodeURIComponent(m[1]) }
  return null
}

export function relativeTime(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = Date.now() - Date.parse(iso)
  const min = Math.round(diff / 60_000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const days = Math.round(hr / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}
