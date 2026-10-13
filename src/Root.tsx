import { lazy, Suspense, useEffect, useRef } from 'react'
import { AuthProvider } from './auth'
import { RouterProvider, useRouter } from './router'
import type { Screen } from './screens'
import { SITE, useDocumentMeta } from './landing/seo'
import { Button, Logo } from './landing/components/primitives'
import { LandingPage } from './landing/LandingPage'

/**
 * Application shell.
 *
 * `/`          → the public landing page
 * `/app`       → the OpenNote calendar (also reachable at `/dashboard`)
 * `/app/signin`, `/app/signup`, `/app/account` → the existing auth screens
 *
 * The calendar is code-split so a first-time visitor to the landing page never
 * downloads it. Nothing inside `App.tsx` is rewritten — the route only chooses
 * which subtree is mounted, and passes the initial screen when the URL asks for
 * one.
 */
const App = lazy(() => import('./App'))

function screenForPath(path: string): Screen | undefined {
  if (path === '/app/signin' || path === '/signin') return 'signin'
  if (path === '/app/signup' || path === '/signup') return 'signup'
  if (path === '/app/account' || path === '/account') return 'account'
  return undefined
}

function isAppRoute(path: string): boolean {
  return (
    path === '/app' ||
    path === '/dashboard' ||
    path === '/app/signin' ||
    path === '/app/signup' ||
    path === '/app/account'
  )
}

function RouteFallback() {
  return (
    <div className="grid h-full min-h-[60vh] w-full place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-4">
        <Logo />
        <span
          className="h-1 w-24 overflow-hidden rounded-full bg-[#e4e6ec]"
          aria-hidden="true"
        >
          <span
            className="block h-full w-1/3 rounded-full bg-lime-bright"
            style={{ animation: 'lp-spin-slow 1s linear infinite', width: '40%' }}
          />
        </span>
        <span className="sr-only" role="status">
          Loading OpenNote…
        </span>
      </div>
    </div>
  )
}

function NotFound() {
  useDocumentMeta(`Page not found — ${SITE.name}`, SITE.description)
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-lp-bg px-6 text-center">
      <Logo />
      <div>
        <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-lp-ink">
          This page doesn’t exist
        </h1>
        <p className="mt-2 text-[15px] text-lp-body">
          The link may be out of date. Try the calendar or start again from the
          home page.
        </p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button href="/" variant="secondary" size="lg">
          Back to home
        </Button>
        <Button href="/app" variant="primary" size="lg">
          Open calendar
        </Button>
      </div>
    </div>
  )
}

function Routes() {
  const { path } = useRouter()
  const previous = useRef(path)

  // A route change always starts at the top; in-page scrolling is handled by
  // the landing page's own anchor logic and never changes the path.
  useEffect(() => {
    if (previous.current === path) return
    previous.current = path
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [path])

  if (path === '/') return <LandingPage />
  if (isAppRoute(path)) {
    // The key remounts the calendar when the path changes, so a different
    // `initialScreen` (e.g. /app → /app/signup) is honoured immediately
    // instead of being ignored by an already-mounted ScreenProvider.
    return (
      <Suspense fallback={<RouteFallback />}>
        <App key={path} screen={screenForPath(path)} />
      </Suspense>
    )
  }
  return <NotFound />
}

export default function Root() {
  return (
    <AuthProvider>
      <RouterProvider>
        <Routes />
      </RouterProvider>
    </AuthProvider>
  )
}