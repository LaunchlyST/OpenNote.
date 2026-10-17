import { Router } from 'express'
import type { NextFunction, Request, Response } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from './auth.ts'
import { db } from './db.ts'

/**
 * Account-wide preferences (General, Appearance, Notifications). One JSON row
 * per user; only known keys with valid values are stored, so the browser can
 * never write arbitrary data here. Calendar preferences stay per project.
 */
export interface Preferences {
  dateFormat: 'DMY' | 'MDY' | 'YMD'
  openTo: 'calendar' | 'today' | 'notes'
  rememberView: boolean
  accent: 'lime' | 'blue' | 'violet' | 'rose' | 'amber' | 'slate'
  animations: boolean
  remindersEnabled: boolean
  reminderLead: 5 | 10 | 15 | 30 | 60
  quietHours: boolean
  quietStart: string
  quietEnd: string
}

export const DEFAULT_PREFERENCES: Preferences = {
  dateFormat: 'DMY',
  openTo: 'calendar',
  rememberView: false,
  accent: 'lime',
  animations: true,
  remindersEnabled: false,
  reminderLead: 10,
  quietHours: false,
  quietStart: '22:00',
  quietEnd: '07:00',
}

const oneOf = <T,>(list: readonly T[]) => (v: unknown): v is T => list.includes(v as T)
const bool = (v: unknown): v is boolean => typeof v === 'boolean'
const hhmm = (v: unknown): v is string => typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)

const RULES: { [K in keyof Preferences]: (v: unknown) => boolean } = {
  dateFormat: oneOf(['DMY', 'MDY', 'YMD'] as const),
  openTo: oneOf(['calendar', 'today', 'notes'] as const),
  rememberView: bool,
  accent: oneOf(['lime', 'blue', 'violet', 'rose', 'amber', 'slate'] as const),
  animations: bool,
  remindersEnabled: bool,
  reminderLead: oneOf([5, 10, 15, 30, 60] as const),
  quietHours: bool,
  quietStart: hhmm,
  quietEnd: hhmm,
}

/** Validates a partial update. Returns the clean patch, or an error message. */
export function cleanPreferences(input: unknown): Partial<Preferences> | string {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return 'Preferences must be an object.'
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(input)) {
    const rule = RULES[k as keyof Preferences]
    if (!rule) return `Unknown preference "${k}".`
    if (!rule(v)) return `Invalid value for "${k}".`
    out[k] = v
  }
  return out as Partial<Preferences>
}

export function ensurePreferenceTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      userId TEXT PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
      data TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `)
}

function read(userId: string): Preferences {
  const row = db.prepare<[string], { data: string }>('SELECT data FROM user_preferences WHERE userId = ?').get(userId)
  if (!row) return { ...DEFAULT_PREFERENCES }
  const saved = cleanPreferences(JSON.parse(row.data))
  return { ...DEFAULT_PREFERENCES, ...(typeof saved === 'string' ? {} : saved) }
}

interface Authed extends Request {
  userId?: string
}

async function requireUser(req: Authed, res: Response, next: NextFunction) {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
    if (!session) {
      res.status(401).json({ error: 'Not signed in.' })
      return
    }
    req.userId = session.user.id
    next()
  } catch (err) {
    next(err)
  }
}

export function preferencesRouter() {
  const r = Router()
  r.use(requireUser)
  r.get('/', (req: Authed, res) => {
    res.set('Cache-Control', 'no-store').json({ preferences: read(req.userId!) })
  })
  r.patch('/', (req: Authed, res) => {
    const patch = cleanPreferences((req.body as { preferences?: unknown } | undefined)?.preferences)
    if (typeof patch === 'string') return void res.status(400).json({ error: patch })
    const next = { ...read(req.userId!), ...patch }
    db.prepare(
      `INSERT INTO user_preferences (userId, data, updatedAt) VALUES (?, ?, ?)
       ON CONFLICT(userId) DO UPDATE SET data = excluded.data, updatedAt = excluded.updatedAt`,
    ).run(req.userId!, JSON.stringify(next), new Date().toISOString())
    res.set('Cache-Control', 'no-store').json({ preferences: next })
  })
  return r
}
