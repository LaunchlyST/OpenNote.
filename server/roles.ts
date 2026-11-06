import { sql } from './db.ts'
import { env } from './env.ts'

/**
 * Keeps Better Auth's `user.role` column in step with ADMIN_EMAILS.
 *
 * An account is an administrator only when its email is on the list AND the
 * address has been verified, so nobody can claim admin rights by signing up
 * with the owner's email first. Everyone else is a plain `user` — including
 * an account that was removed from the list since the last run.
 */
export async function syncRoles(): Promise<{ admins: string[] }> {
  const allow = new Set(env.adminEmails)
  const rows = await sql.all<{ id: string; email: string; emailVerified: number | boolean; role: string | null }>(
    'SELECT id, email, "emailVerified", role FROM "user"',
  )

  // PRO_EMAILS: Pro on the house for these verified accounts. Only ever grants.
  const pro = new Set(env.proEmails)
  const admins: string[] = []
  await sql.tx(async (tx) => {
    for (const row of rows) {
      const wanted = allow.has(row.email.toLowerCase()) && Boolean(row.emailVerified) ? 'admin' : 'user'
      if (wanted === 'admin') admins.push(row.email)
      if (row.role !== wanted) await tx.run('UPDATE "user" SET role = ? WHERE id = ?', wanted, row.id)
      if (pro.has(row.email.toLowerCase()) && row.emailVerified)
        await tx.run(`UPDATE "user" SET plan = 'pro' WHERE id = ? AND (plan IS NULL OR plan != 'pro')`, row.id)
    }
  })
  return { admins }
}

/** Marks an address verified and re-runs the role sync. Local CLI use only. */
export async function verifyEmail(email: string): Promise<boolean> {
  const info = await sql.run('UPDATE "user" SET "emailVerified" = ? WHERE lower(email) = lower(?)', true, email)
  await syncRoles()
  return info.changes > 0
}
