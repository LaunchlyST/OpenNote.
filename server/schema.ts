import { getMigrations } from 'better-auth/db/migration'
import { auth } from './auth.ts'
import { ensureAppTables } from './db.ts'

/**
 * Creates or updates Better Auth's tables and OpenNote's own tables. Only adds
 * what is missing — existing rows and columns are never dropped or rewritten.
 */
export async function applyMigrations({ quiet = false } = {}) {
  const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
  if (toBeCreated.length || toBeAdded.length) {
    console.log(
      'Applying auth migrations:',
      [...toBeCreated.map((t) => `create ${t.table}`), ...toBeAdded.map((t) => `alter ${t.table}`)].join(', '),
    )
    await runMigrations()
  } else if (!quiet) {
    console.log('Auth tables are up to date.')
  }
  ensureAppTables()
  const { backfillPlans } = await import('./plans.ts')
  backfillPlans()
}
