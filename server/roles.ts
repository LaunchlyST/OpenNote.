import { db } from './db.ts'
import { env } from './env.ts'

/**
 * Keeps Better Auth's `user.role` column in step with ADMIN_EMAILS.
 *
 * An account is an administrator only when its email is on the list AND the
 * address has been verified, so nobody can claim admin rights by signing up
 * with the owner's email first. Everyone else is a plain `user` — including
 * an account that was removed from the list since the last run.
 */
export function syncRoles(): { admins: string[] } {
  const allow = new Set(env.adminEmails)
  const rows = db.prepare('SELECT id, email, emailVerified, role FROM "user"').all() as Array<{
    id: string
    email: string
    emailVerified: number
    role: string | null
  }>

  const setRole = db.prepare('UPDATE "user" SET role = ? WHERE id = ?')
  const admins: string[] = []
  db.transaction(() => {
    for (const row of rows) {
      const wanted = allow.has(row.email.toLowerCase()) && Boolean(row.emailVerified) ? 'admin' : 'user'
      if (wanted === 'admin') admins.push(row.email)
      if (row.role !== wanted) setRole.run(wanted, row.id)
    }
  })()
  return { admins }
}

/** Marks an address verified and re-runs the role sync. Local CLI use only. */
export function verifyEmail(email: string): boolean {
  const info = db.prepare('UPDATE "user" SET emailVerified = 1 WHERE lower(email) = lower(?)').run(email)
  syncRoles()
  return info.changes > 0
}
