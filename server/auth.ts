import { betterAuth } from 'better-auth'
import { admin, bearer } from 'better-auth/plugins'
import { authDatabase } from './db.ts'
import { env, googleConfigured, requireEmailVerification } from './env.ts'
import { passwordProblem } from './password-policy.ts'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { enqueueEmail } from './mail/index.ts'
import { syncRoles } from './roles.ts'
import { sql } from './db.ts'

export const auth = betterAuth({
  appName: 'Desknoty',
  // Better Auth treats a base URL that has a path as the full auth URL, so
  // append /api/auth when the API is served under one (Supabase: /functions/v1).
  baseURL: new URL(env.baseURL).pathname.replace(/\/+$/, '') ? `${env.baseURL.replace(/\/+$/, '')}/api/auth` : env.baseURL,
  secret: env.secret,
  database: authDatabase,
  trustedOrigins: [new URL(env.baseURL).origin, ...env.trustedOrigins],

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification,
    autoSignIn: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A password reset signs every other device out.
    revokeSessionsOnPasswordReset: true,
    // Queued, not sent inline: the response time is the same whether or not
    // the account exists, and a slow mail server never blocks the request.
    sendResetPassword: async ({ user, url }) => {
      await enqueueEmail('reset-password', user.email, { url, name: user.name })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link (the UI tells the user so).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await enqueueEmail('verify-email', user.email, { url, name: user.name })
    },
    // Once per account: verification only happens once.
    afterEmailVerification: async (user) => {
      await enqueueEmail('welcome', user.email, { url: `${(process.env.PUBLIC_SITE_URL || env.baseURL).replace(/\/+$/, '')}/app`, name: user.name })
    },
  },

  user: {
    // Users can delete their own account from Settings. Better Auth checks
    // the password (email accounts) or a recent sign-in (Google) first;
    // their projects and preferences are removed with them (ON DELETE CASCADE).
    deleteUser: {
      enabled: true,
      // A seller's customers keep their downloads: an account whose store has
      // paid orders is not deleted (the store's rows would cascade with it).
      beforeDelete: async (user) => {
        const row = await sql.get<{ n: number }>(
          `SELECT CAST(COUNT(*) AS INTEGER) AS n FROM seller_order o JOIN seller_store s ON s.id = o."storeId" WHERE s."userId" = ? AND o.status = 'paid'`,
          user.id,
        ).catch(() => undefined)
        if (row?.n)
          throw new APIError('BAD_REQUEST', {
            message: 'This account has a store with paid customer orders, so it can’t be deleted: buyers would lose their downloads. Contact support to close the store first.',
          })
      },
    },
    additionalFields: {
      // Subscription plan. input: false — a sign-up or profile update can
      // never set it; only the server can.
      plan: { type: 'string', required: false, defaultValue: 'free', input: false },
    },
  },

  // Google sign-in through Google's own OAuth pages (PKCE + state checked by
  // Better Auth). OpenNote never sees the Google password.
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: env.google.clientId,
          clientSecret: env.google.clientSecret,
          // Always show Google's account chooser, so another account can be picked.
          prompt: 'select_account',
        },
      }
    : {},

  account: {
    accountLinking: {
      // A Google sign-in joins an existing OpenNote account only when Google
      // has verified the address AND the OpenNote account's email is verified
      // too. An unverified look-alike account can never capture a Google login.
      enabled: true,
      requireLocalEmailVerified: true,
      trustedProviders: [],
      allowDifferentEmails: false,
    },
  },

  // Password strength is enforced here, on the server, for every way a
  // password is set: sign-up, reset and change.
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      const field =
        ctx.path === '/sign-up/email' ? 'password' : ctx.path === '/reset-password' || ctx.path === '/change-password' ? 'newPassword' : null
      if (!field) return
      const body = (ctx.body ?? {}) as Record<string, unknown>
      const problem = passwordProblem(String(body[field] ?? ''), typeof body.email === 'string' ? body.email : undefined)
      if (problem) throw new APIError('BAD_REQUEST', { message: problem, code: 'WEAK_PASSWORD' })
    }),
  },

  plugins: [
    // Session as a bearer token for cross-site hosting (see src/lib/api-base.ts).
    bearer(),
    // Adds user.role (and ban fields). Roles are assigned by syncRoles() from
    // ADMIN_EMAILS — never by the sign-up request itself.
    admin({ defaultRole: 'user', adminRoles: ['admin'] }),
  ],

  databaseHooks: {
    user: {
      // Re-evaluate roles when an account is created or its email is verified.
      create: {
        // SIGNUP_ALLOWLIST closes sign-up to everyone else, for every sign-up
        // route (email and Google alike). Existing accounts are unaffected.
        before: async (user) => {
          // Until the public launch (an admin switches it in Settings → Launch), sign-up stays limited.
          const { getLaunchMode } = await import('./launch.ts')
          if (env.signupAllowlist.length && !env.signupAllowlist.includes(String(user.email).toLowerCase()) && (await getLaunchMode()) !== 'launched') {
            throw new APIError('FORBIDDEN', { message: 'Sign-up is invite only for now. Join the waitlist instead.', code: 'SIGNUP_CLOSED' })
          }
        },
        after: async () => { await syncRoles() },
      },
      update: { after: async () => { await syncRoles() } },
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
    // Secure flag whenever the site is served over HTTPS. When the frontend is
    // hosted on a different origin than this API, cookies must be SameSite=None
    // (and Secure) or the browser will drop them on cross-origin requests.
    useSecureCookies: env.baseURL.startsWith('https://'),
    defaultCookieAttributes: (env.trustedOrigins.some((origin) => {
      try {
        const registrable = (host: string) => host.split('.').slice(-2).join('.')
        const frontendHost = new URL(origin).hostname
        const apiHost = new URL(env.baseURL).hostname
        // Subdomains of the same registrable domain (e.g. desknoty.com and
        // api.desknoty.com) are same-site, so Lax cookies still travel. Only
        // truly cross-site frontends need SameSite=None.
        return registrable(frontendHost) !== registrable(apiHost)
      } catch {
        return false
      }
    }))
      ? { sameSite: 'none', secure: true }
      : { sameSite: 'lax' },
    ipAddress: {
      ipAddressHeaders: env.ipAddressHeaders,
      ...(env.trustedProxies.length ? { trustedProxies: env.trustedProxies } : {}),
    },
  },
})
