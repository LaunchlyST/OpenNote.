/**
 * Confirms an administrator's email from the server's own terminal, for local
 * setups without SMTP where the verification email cannot be delivered.
 * Whoever can run this already controls the server and its database.
 *
 *   npm run admin:verify -- you@example.com
 */
import { env } from '../server/env.ts'
import { verifyEmail } from '../server/roles.ts'
import { applyMigrations } from '../server/schema.ts'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: npm run admin:verify -- you@example.com')
  process.exit(1)
}
if (!env.adminEmails.includes(email)) {
  console.error(`${email} is not in ADMIN_EMAILS. Add it to .env first.`)
  process.exit(1)
}
await applyMigrations({ quiet: true })
if (!verifyEmail(email)) {
  console.error(`No OpenNote account uses ${email} yet. Sign up first, then run this again.`)
  process.exit(1)
}
console.log(`${email} is verified and is now an administrator.`)
