import { applyMigrations } from './schema.ts'
import { syncRoles } from './roles.ts'

await applyMigrations()
console.log('Workspace table is ready.')
const { admins } = syncRoles()
console.log(`Administrators: ${admins.length ? admins.join(', ') : 'none (set ADMIN_EMAILS and verify the address)'}`)
