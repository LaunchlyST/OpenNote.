import { betterAuth } from 'better-auth'
import { db } from './db.ts'
import { env, googleConfigured, requireEmailVerification } from './env.ts'
import { sendActionEmail } from './mail.ts'

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
    sendResetPassword: async ({ user, url }) => {
      await sendActionEmail({
        to: user.email,
        subject: 'Reset your OpenNote password',
        heading: 'Reset your password',
        body: 'We received a request to reset the password for your OpenNote account. This link expires in one hour. If you did not ask for this, you can ignore this email.',
        action: 'Choose a new password',
        url,
      })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    // Signing in before verifying sends a fresh link (the UI tells the user so).
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendActionEmail({
        to: user.email,
        subject: 'Verify your OpenNote email',
        heading: 'Confirm your email address',
        body: 'Thanks for signing up for OpenNote. Confirm your email address to finish creating your account.',
        action: 'Verify email',
        url,
      })
    },
  },

  socialProviders: googleConfigured
    ? { google: { clientId: env.google.clientId, clientSecret: env.google.clientSecret } }
    : {},

  session: {
    // Stay signed in for 30 days; the expiry slides forward once a day of use.
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
