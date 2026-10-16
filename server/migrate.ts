import { getMigrations } from 'better-auth/db/migration'
import { auth } from './auth.ts'
import { ensureAppTables } from './db.ts'

/**
 * Creates or updates Better Auth's tables (user, session, account,
 * verification) and OpenNote's workspace table. Only adds what is missing —
 * existing rows are never dropped or rewritten.
 */
const { toBeCreated, toBeAdded, runMigrations } = await getMigrations(auth.options)
if (toBeCreated.length || toBeAdded.length) {
  console.log(
    'Applying auth migrations:',
    [...toBeCreated.map((t) => `create ${t.table}`), ...toBeAdded.map((t) => `alter ${t.table}`)].join(', '),
  )
  await runMigrations()
} else {
  console.log('Auth tables are up to date.')
}
ensureAppTables()
console.log('Workspace table is ready.')
