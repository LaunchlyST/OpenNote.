import { betterAuth } from 'better-auth'
import { admin } from 'better-auth/plugins'
import { db } from './db.ts'
import { env, requireEmailVerification } from './env.ts'
import { enqueueEmail } from './mail/index.ts'
import { syncRoles } from './roles.ts'

export const auth = betterAuth({
  appName: 'OpenNote',
  baseURL: env.baseURL,
  secret: env.secret,
  database: db,
  trustedOrigins: [env.baseURL, ...env.trustedOrigins],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A password reset signs every other device out.
    revokeSessionsOnPasswordReset: true,
    // Queued, not sent inline: the response time is the same whether or not
    // the account exists, and a slow mail server never blocks the request.
    sendResetPassword: async ({ user, url }) => {
      enqueueEmail('reset-password', user.email, { url, name: user.name })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link (the UI tells the user so).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      enqueueEmail('verify-email', user.email, { url, name: user.name })
    },
  },

  user: {
    additionalFields: {
      // Subscription plan. input: false — a sign-up or profile update can
      // never set it; only the server can.
      plan: { type: 'string', required: false, defaultValue: 'free', input: false },
    },
  },

  plugins: [
    // Adds user.role (and ban fields). Roles are assigned by syncRoles() from
    // ADMIN_EMAILS — never by the sign-up request itself.
    admin({ defaultRole: 'user', adminRoles: ['admin'] }),
  ],

  databaseHooks: {
    user: {
      // Re-evaluate roles when an account is created or its email is verified.
      create: { after: async () => { syncRoles() } },
      update: { after: async () => { syncRoles() } },
    },
  },

  session: {
    // "Remember me" sessions last 30 days and slide forward once a day of use.
    // Without it, Better Auth issues a browser-session cookie that ends when
    // the browser closes.
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
  },

  advanced: {
    // httpOnly + SameSite=Lax cookies are Better Auth's defaults; force the
    // Secure flag whenever the site is served over HTTPS.
    useSecureCookies: env.baseURL.startsWith('https://'),
    ipAddress: {
      ipAddressHeaders: env.ipAddressHeaders,
      ...(env.trustedProxies.length ? { trustedProxies: env.trustedProxies } : {}),
    },
  },
})
