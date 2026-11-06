import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { sql } from './db.ts'
import { planOf } from './plans.ts'
import { validateWorkspace } from './workspace.ts'

/**
 * Projects: each user owns any number of independent calendars, filed under a
 * workspace ("free" or "pro"). Every query is scoped by the signed-in user's
 * id, so there is no way to address another account's project. The Pro
 * workspace is checked against the plan stored on the user row — never
 * against anything the browser sends.
 */
export type WorkspaceId = 'free' | 'pro'

const COLORS = new Set(['orange', 'lime', 'pink', 'purple', 'yellow', 'blue'])

export async function ensureProjectTables() {
  await sql.exec(`
    CREATE TABLE IF NOT EXISTS project (
      id TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
      workspace TEXT NOT NULL CHECK (workspace IN ('free', 'pro')),
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL,
      "createdAt" TEXT NOT NULL,
      "updatedAt" TEXT NOT NULL,
      "openedAt" TEXT
    );
    CREATE INDEX IF NOT EXISTS project_owner ON project ("userId", workspace);

    -- Users whose old single-calendar workspace has been copied into a project.
    CREATE TABLE IF NOT EXISTS project_import (
      "userId" TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      "importedAt" TEXT NOT NULL
    );
  `)
}

/** A brand-new project: one empty calendar, no events, no notes. */
export function emptyProjectData(color: string) {
  return {
    events: [],
    calendars: [{ id: 'cal_main', name: 'My calendar', color, visible: true }],
    notes: [],
    settings: {},
  }
}

/** The exact demo notes earlier versions wrote into every new account. */
const DEMO_NOTES = new Set([
  'Grocery list\u0000Oat milk\nSpinach\nCoffee beans\nRye bread',
  'Ideas\u0000Add a focus timer to the planner.\nTry a soft lime accent for highlights.',
  'Call back\u0000Sam — invoice question before Friday.',
  'Inspiration\u0000Minimal, airy layout. Thin hairlines. Let the colours do the talking.',
])

/**
 * Strips the auto-generated demo content from an old workspace while keeping
 * everything the user made: events flagged `seeded` (the user never edited
 * them) and notes identical to the built-in samples are dropped.
 */
export function stripDemoContent(data: Record<string, unknown>) {
  const events = Array.isArray(data.events) ? data.events : []
  const notes = Array.isArray(data.notes) ? data.notes : []
  return {
    ...data,
    events: events.filter((e) => !(e as { seeded?: boolean }).seeded),
    notes: notes.filter((n) => {
      const { title, body } = n as { title?: string; body?: string }
      return !DEMO_NOTES.has(`${title}\u0000${body}`)
    }),
  }
}

interface ProjectRow {
  id: string
  userId: string
  workspace: WorkspaceId
  name: string
  color: string
  description: string
  data: string
  createdAt: string
  updatedAt: string
  openedAt: string | null
}

const summary = (r: ProjectRow) => {
  const data = JSON.parse(r.data) as { events?: unknown[]; notes?: unknown[] }
  return {
    id: r.id,
    workspace: r.workspace,
    name: r.name,
    color: r.color,
    description: r.description,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    openedAt: r.openedAt,
    eventCount: data.events?.length ?? 0,
    noteCount: data.notes?.length ?? 0,
  }
}

/** Copies a pre-projects workspace into a "My Calendar" project, once per user. */
async function importLegacy(userId: string) {
  const done = await sql.get('SELECT 1 AS one FROM project_import WHERE "userId" = ?', userId)
  if (done) return
  await sql.tx(async (tx) => {
    const legacy = await tx.get<{ data: string }>('SELECT data FROM workspace WHERE "userId" = ?', userId)
    if (legacy) {
      const cleaned = stripDemoContent(JSON.parse(legacy.data) as Record<string, unknown>)
      const hasContent =
        (cleaned.events as unknown[]).length > 0 ||
        (cleaned.notes as unknown[]).length > 0
      if (hasContent) {
        const now = new Date().toISOString()
        await tx.run(
          `INSERT INTO project (id, "userId", workspace, name, color, description, data, "createdAt", "updatedAt")
           VALUES (?, ?, 'free', 'My Calendar', 'lime', 'Imported from your earlier calendar.', ?, ?, ?)`,
          `prj_${randomUUID()}`,
          userId,
          JSON.stringify(cleaned),
          now,
          now,
        )
      }
    }
    await tx.run('INSERT INTO project_import ("userId", "importedAt") VALUES (?, ?) ON CONFLICT ("userId") DO NOTHING', userId, new Date().toISOString())
  })
}

interface Authed extends Request {
  userId?: string
  plan?: 'free' | 'pro'
}

async function requireUser(req: Authed, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) {
      res.status(401).json({ error: 'Not signed in.' })
      return
    }
    req.userId = session.user.id
    req.plan = planOf(session.user as { plan?: string })
    next()
  } catch (err) {
    next(err)
  }
}

function workspaceAllowed(req: Authed, res: Response, workspace: unknown): workspace is WorkspaceId {
  if (workspace !== 'free' && workspace !== 'pro') {
    res.status(400).json({ error: 'Unknown workspace.' })
    return false
  }
  if (workspace === 'pro' && req.plan !== 'pro') {
    res.status(403).json({ error: 'The Pro workspace needs an active OpenNote Pro subscription.' })
    return false
  }
  return true
}

function cleanName(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const name = v.trim().replace(/\s+/g, ' ')
  return name.length >= 1 && name.length <= 80 ? name : null
}
const cleanColor = (v: unknown) => (typeof v === 'string' && COLORS.has(v) ? v : null)
const cleanDescription = (v: unknown) =>
  v === undefined || v === null ? '' : typeof v === 'string' && v.length <= 500 ? v.trim() : null

function insertProject(r: ProjectRow) {
  return sql.run(
    `INSERT INTO project (id, "userId", workspace, name, color, description, data, "createdAt", "updatedAt", "openedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    r.id, r.userId, r.workspace, r.name, r.color, r.description, r.data, r.createdAt, r.updatedAt, r.openedAt,
  )
}

export function projectsRouter() {
  const r = Router()
  r.use(requireUser)
  r.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  /** Loads a project the caller owns, and whose workspace their plan allows. */
  async function load(req: Authed, res: Response): Promise<ProjectRow | null> {
    const row = await sql.get<ProjectRow>('SELECT * FROM project WHERE id = ? AND "userId" = ?', String(req.params.id), req.userId!)
    if (!row) {
      res.status(404).json({ error: 'Project not found.' })
      return null
    }
    if (!workspaceAllowed(req, res, row.workspace)) return null
    return row
  }

  r.get('/', async (req: Authed, res) => {
    const workspace = req.query.workspace
    if (!workspaceAllowed(req, res, workspace)) return
    if (workspace === 'free') await importLegacy(req.userId!)
    const rows = await sql.all<ProjectRow>('SELECT * FROM project WHERE "userId" = ? AND workspace = ? ORDER BY "updatedAt" DESC', req.userId!, workspace)
    res.json({ projects: rows.map(summary) })
  })

  r.post('/', async (req: Authed, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    if (!workspaceAllowed(req, res, body.workspace)) return
    const name = cleanName(body.name)
    const color = cleanColor(body.color ?? 'lime')
    const description = cleanDescription(body.description)
    if (!name) return void res.status(400).json({ error: 'Give the project a name (up to 80 characters).' })
    if (!color) return void res.status(400).json({ error: 'Unknown colour.' })
    if (description === null) return void res.status(400).json({ error: 'Description is too long.' })
    const count = (await sql.get<{ n: number }>('SELECT CAST(COUNT(*) AS INTEGER) AS n FROM project WHERE "userId" = ?', req.userId!))?.n ?? 0
    if (count >= 500) return void res.status(400).json({ error: 'You have reached the project limit.' })
    const now = new Date().toISOString()
    const row: ProjectRow = {
      id: `prj_${randomUUID()}`,
      userId: req.userId!,
      workspace: body.workspace as WorkspaceId,
      name,
      color,
      description,
      data: JSON.stringify(emptyProjectData(color)),
      createdAt: now,
      updatedAt: now,
      openedAt: now,
    }
    await insertProject(row)
    res.status(201).json({ project: summary(row) })
  })

  r.get('/:id', async (req: Authed, res) => {
    const row = await load(req, res)
    if (!row) return
    // ?peek=1 reads without marking the project opened (dashboard previews)
    if (req.query.peek === '1') return void res.json({ project: summary(row), data: JSON.parse(row.data) })
    const openedAt = new Date().toISOString()
    await sql.run('UPDATE project SET "openedAt" = ? WHERE id = ?', openedAt, row.id)
    res.json({ project: summary({ ...row, openedAt }), data: JSON.parse(row.data) })
  })

  r.patch('/:id', async (req: Authed, res) => {
    const row = await load(req, res)
    if (!row) return
    const body = (req.body ?? {}) as Record<string, unknown>
    const next = { ...row }
    if (body.name !== undefined) {
      const name = cleanName(body.name)
      if (!name) return void res.status(400).json({ error: 'Give the project a name (up to 80 characters).' })
      next.name = name
    }
    if (body.color !== undefined) {
      const color = cleanColor(body.color)
      if (!color) return void res.status(400).json({ error: 'Unknown colour.' })
      next.color = color
    }
    if (body.description !== undefined) {
      const description = cleanDescription(body.description)
      if (description === null) return void res.status(400).json({ error: 'Description is too long.' })
      next.description = description
    }
    next.updatedAt = new Date().toISOString()
    await sql.run('UPDATE project SET name = ?, color = ?, description = ?, "updatedAt" = ? WHERE id = ?', next.name, next.color, next.description, next.updatedAt, row.id)
    res.json({ project: summary(next) })
  })

  r.put('/:id/data', async (req: Authed, res) => {
    const row = await load(req, res)
    if (!row) return
    const data = (req.body as { data?: unknown } | undefined)?.data
    const problem = validateWorkspace(data)
    if (problem) return void res.status(400).json({ error: `Invalid project data: ${problem}.` })
    const updatedAt = new Date().toISOString()
    await sql.run('UPDATE project SET data = ?, "updatedAt" = ? WHERE id = ?', JSON.stringify(data), updatedAt, row.id)
    res.json({ ok: true, updatedAt })
  })

  r.post('/:id/duplicate', async (req: Authed, res) => {
    const row = await load(req, res)
    if (!row) return
    const now = new Date().toISOString()
    const copy: ProjectRow = {
      ...row,
      id: `prj_${randomUUID()}`,
      name: `${row.name} (copy)`.slice(0, 80),
      createdAt: now,
      updatedAt: now,
      openedAt: null,
    }
    await insertProject(copy)
    res.status(201).json({ project: summary(copy) })
  })

  r.delete('/:id', async (req: Authed, res) => {
    const row = await load(req, res)
    if (!row) return
    await sql.run('DELETE FROM project WHERE id = ? AND "userId" = ?', row.id, req.userId!)
    res.json({ ok: true })
  })

  return r
}
