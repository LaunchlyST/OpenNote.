/**
 * SSR smoke test for the public landing page.
 *
 * Executes every landing component through react-dom/server with the browser
 * globals stubbed, then asserts the expected copy is present. This catches
 * runtime crashes, bad imports and missing exports that a type check alone
 * misses — without needing a browser.
 *
 * Run with: node scripts/ssr-smoke.mjs
 */
import { createServer } from 'vite'
import React from 'react'
import { renderToString } from 'react-dom/server'

/* ------------------------------------------------------------------ */
/* Minimal browser-global stubs                                        */
/* ------------------------------------------------------------------ */

class StubElement {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase()
    this.children = []
    this.style = {}
    this.dataset = {}
    this.classList = {
      _set: new Set(),
      add: (...c) => c.forEach((x) => this.classList._set.add(x)),
      remove: (...c) => c.forEach((x) => this.classList._set.delete(x)),
      contains: (c) => this.classList._set.has(c),
    }
    this.attributes = {}
    this.offsetHeight = 68
    this.id = ''
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v)
  }
  getAttribute(k) {
    return this.attributes[k] ?? null
  }
  appendChild(c) {
    this.children.push(c)
    return c
  }
  addEventListener() {}
  removeEventListener() {}
  querySelector() {
    return null
  }
  querySelectorAll() {
    return []
  }
  getBoundingClientRect() {
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 }
  }
  contains() {
    return false
  }
  focus() {}
}

const noopObserver = () => ({
  observe() {},
  unobserve() {},
  disconnect() {},
  takeRecords: () => [],
})

const store = {
  _v: new Map(),
  getItem(k) {
    return this._v.has(k) ? this._v.get(k) : null
  },
  setItem(k, v) {
    this._v.set(k, String(v))
  },
  removeItem(k) {
    this._v.delete(k)
  },
}
globalThis.localStorage = store

globalThis.window = {
  location: { pathname: '/', href: 'http://localhost/', hash: '', search: '' },
  history: {
    pushState: () => {},
    replaceState: () => {},
  },
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  requestAnimationFrame: (cb) => cb(0),
  cancelAnimationFrame: () => {},
  matchMedia: () => ({
    matches: false,
    media: '',
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
  }),
  IntersectionObserver: noopObserver,
  ResizeObserver: noopObserver,
  setTimeout: () => 0,
  clearTimeout: () => {},
  getComputedStyle: () => ({ getPropertyValue: () => '' }),
  localStorage: store,
}
globalThis.document = {
  title: '',
  documentElement: new StubElement('html'),
  body: new StubElement('body'),
  head: new StubElement('head'),
  createElement: (t) => new StubElement(t),
  getElementById: () => null,
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
}
globalThis.IntersectionObserver = noopObserver
globalThis.ResizeObserver = noopObserver
globalThis.matchMedia = globalThis.window.matchMedia
globalThis.HTMLElement = StubElement
globalThis.Element = StubElement
globalThis.localStorage = store
globalThis.PopStateEvent = class {
  constructor(type) {
    this.type = type
  }
}

/** Renders the calendar app exactly as `Root` mounts it. */
const TEST_USER = {
  id: 'usr_test',
  fullName: 'Test User',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
  emailVerified: true,
  plan: 'free',
}

/** Renders the calendar app exactly as `Root` mounts it, with a fixed session. */
async function renderApp(props, user = TEST_USER) {
  const appMod = await vite.ssrLoadModule('/src/App.tsx')
  const auth = await vite.ssrLoadModule('/src/auth.tsx')
  const routerMod = await vite.ssrLoadModule('/src/router.tsx')
  return renderToString(
    React.createElement(
      auth.StaticAuthProvider,
      { user },
      React.createElement(routerMod.RouterProvider, null, React.createElement(appMod.default, props)),
    ),
  )
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const vite = await createServer({
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
})

/** Renders a freshly created (empty) project's calendar. */
async function renderProject() {
  const appMod = await vite.ssrLoadModule('/src/App.tsx')
  const auth = await vite.ssrLoadModule('/src/auth.tsx')
  const routerMod = await vite.ssrLoadModule('/src/router.tsx')
  const screens = await vite.ssrLoadModule('/src/screens.tsx')
  const now = new Date().toISOString()
  const project = { id: 'prj_test', workspace: 'free', name: 'Business', color: 'blue', description: '', createdAt: now, updatedAt: now, openedAt: now, eventCount: 0, noteCount: 0 }
  const data = { events: [], calendars: [{ id: 'cal_main', name: 'My calendar', color: 'blue', visible: true }], notes: [], settings: {} }
  return renderToString(
    React.createElement(auth.StaticAuthProvider, { user: TEST_USER },
      React.createElement(routerMod.RouterProvider, null,
        React.createElement(screens.ScreenProvider, null,
          React.createElement(appMod.ProjectCalendar, { project, data, persist: false })))),
  )
}

let failures = 0
const check = (label, ok, detail = '') => {
  if (ok) console.log(`  PASS  ${label}`)
  else {
    failures += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Renders the landing page the way `Root` does — inside both providers. */
async function renderLanding(user = null) {
  const mod = await vite.ssrLoadModule('/src/landing/LandingPage.tsx')
  const auth = await vite.ssrLoadModule('/src/auth.tsx')
  const routerMod = await vite.ssrLoadModule('/src/router.tsx')
  return renderToString(
    React.createElement(
      auth.StaticAuthProvider,
      { user },
      React.createElement(
        routerMod.RouterProvider,
        null,
        React.createElement(mod.LandingPage),
      ),
    ),
  )
}

let authMod
try {
  authMod = await vite.ssrLoadModule('/src/auth.tsx')
  const html = await renderLanding()

  check('renders a non-trivial document', html.length > 8000, `${html.length} chars`)

  /* Content contract — the copy the brief asked for. */
  const expected = [
    // Hero
    'Plan the day.',
    'Keep the thought.',
    'OpenNote is a calendar with your notes built in.',
    'Start Planning Free',
    'See it in action',
    'Sign In',
    'Free plan, no card required',
    // How it works
    'From a blank week to a plan.',
    'Pick the day',
    'Block the time',
    'Pin the thought',
    // Features
    'Your calendar and notes, finally together.',
    'The thought stays next to the plan.',
    'See the shape of your week in colour.',
    'Month at a glance',
    'Move through time',
    'Create in seconds',
    // Preview
    'Try it right here.',
    'Full Week',
    'No account needed.',
    // Pricing
    'Simple plans. Better planning.',
    'Free Forever',
    'Introductory Price',
    'Coming Soon',
    'Built for Teams',
    'isn’t available yet. Nothing can be purchased',
    'Already a member of our main platform?',
    'Shared team calendars',
    'Advanced permissions',
    // FAQ
    'Questions &amp; answers',
    'What is OpenNote?',
    'Is OpenNote free?',
    'When is OpenNote Business launching?',
    // Final CTA
    'Get OpenNote',
    'for free.',
    'Start Planning for Free',
    // Footer
    'OpenNote',
    'Privacy Policy',
    'Terms of Service',
    'All rights reserved.',
  ]

  for (const text of expected) {
    check(`copy: “${text}”`, html.includes(text))
  }

  /* Structure and semantics */
  check('single h1', (html.match(/<h1/g) || []).length === 1)
  check('h2 section headings present', (html.match(/<h2/g) || []).length >= 6)
  check('nav landmark present', html.includes('<nav'))
  check('main landmark present', html.includes('<main'))
  check('footer landmark present', html.includes('<footer'))
  check('skip link present', html.includes('Skip to content'))
  check('FAQ uses aria-expanded', html.includes('aria-expanded'))
  check('preview switcher uses aria-pressed', html.includes('aria-pressed'))
  check('Business CTA is a real disabled button', /disabled[^>]*>[^<]*Coming Soon/.test(html.replace(/\s+/g, ' ')))
  check('Pro CTA is not a link', !/href="\/app\/signup"[^>]*>[^<]*Get OpenNote Pro/.test(html))
  check('Pro is not offered for purchase', !html.includes('Get OpenNote Pro') && !html.includes('Most Popular'))
  check('no checkout or payment links', !/href="[^"]*(checkout|stripe|billing)/i.test(html))

  /* Product mockups */
  check('hero shows the week grid', html.includes('Morning planning'))
  check('page shows a note card', html.includes('Grocery list'))
  check('demo calendars render', html.includes('Colour-coded') && html.includes('Study'))
  check('no localStorage writes during render', globalThis.localStorage._v.size === 0)

  /* No placeholders or debug leftovers */
  for (const bad of ['TODO', 'FIXME', 'Lorem ipsum', 'undefined', 'NaN']) {
    check(`absent: “${bad}”`, !html.includes(bad))
  }

  /* -------------------------------------------------------------- */
  /* Authenticated state — the nav must reflect a real session.      */
  /* -------------------------------------------------------------- */
  console.log('\n  Authenticated state:')
  const authedHtml = await renderLanding(TEST_USER)
  // Scope to the header: the pricing section legitimately keeps its own
  // “Get Started Free” button for the Free plan.
  const authedHeader = authedHtml.slice(0, authedHtml.indexOf('<main'))
  check('nav shows “Open My Calendar” when signed in', authedHeader.includes('Open My Calendar'))
  check('nav hides “Get Started Free” when signed in', !authedHeader.includes('Get Started Free'))
  check('nav still shows Sign In when signed in', authedHeader.includes('Sign In'))
  check('hero secondary CTA becomes Switch account', authedHtml.includes('Switch account'))


  /* -------------------------------------------------------------- */
  /* The existing calendar app must still render.                   */
  /* -------------------------------------------------------------- */
  console.log('\n  Workspace picker (after sign-in):')
  const appHtml = await renderApp()
  check('signed-in /app shows the workspace picker', appHtml.includes('Choose Your Workspace'))
  check('picker offers OpenNote Free', appHtml.includes('OpenNote Free') && appHtml.includes('Open Free workspace'))
  check('picker shows OpenNote Pro', appHtml.includes('OpenNote Pro'))
  check('Pro is locked for a Free account', appHtml.includes('Pro is coming soon') && !appHtml.includes('Open Pro workspace'))
  check('picker does not jump straight to the calendar', !appHtml.includes('Full Week'))
  const proHtml = await renderApp(undefined, { ...TEST_USER, plan: 'pro' })
  check('Pro account can open the Pro workspace', proHtml.includes('Open Pro workspace'))

  console.log('\n  Project calendar (existing calendar UI):')
  const calHtml = await renderProject()
  check('calendar app renders', calHtml.length > 3000, `${calHtml.length} chars`)
  check('calendar shows the OpenNote wordmark', calHtml.includes('OpenNote'))
  check('calendar shows the view switcher', calHtml.includes('Full Week'))
  check('calendar shows the notes rail', calHtml.includes('Notes'))
  check('calendar shows the date title', /\d{4}/.test(calHtml))
  check('calendar shows the sidebar calendars', calHtml.includes('My Calendars'))
  check('calendar has Back to Projects', calHtml.includes('Back to Projects'))
  check('calendar shows the project name', calHtml.includes('Business'))
  for (const demo of ['Team stand-up', 'Morning yoga', 'Sprint planning', 'Client call', 'Dinner with friends', '1:1 with Alex', 'Read a chapter', 'Grocery list']) {
    check(`new project has no demo content: “${demo}”`, !calHtml.includes(demo))
  }

  /* Route-provided screens */
  const guestHtml = await renderApp(undefined, null)
  check('workspace is not rendered without a session', !guestHtml.includes('Full Week') && !guestHtml.includes('Choose Your Workspace'))
  const forgotHtml = await renderApp({ screen: 'forgot' }, null)
  check('/app/forgot-password renders the reset request form', forgotHtml.includes('Reset your password'))
  const resetHtml = await renderApp({ screen: 'reset' }, null)
  check('/app/reset-password renders the new password form', resetHtml.includes('Choose a new password'))

  const signupHtml = await renderApp({ screen: 'signup' })
  check('/app/signup renders the sign-up form', signupHtml.includes('Create your account'))
  check('sign-up form asks for a full name', signupHtml.includes('Full name'))
  check('sign-up form asks to confirm password', signupHtml.includes('Confirm password'))

  const signinHtml = await renderApp({ screen: 'signin' })
  check('/app/signin renders the sign-in form', signinHtml.includes('Welcome back'))

  /* The calendar itself must not be reachable from a sign-in route. */
  check('sign-in route does not render the calendar grid', !signinHtml.includes('Full Week'))
} catch (err) {
  failures += 1
  console.log('\n  RENDER THREW:')
  console.log(err && err.stack ? err.stack : String(err))
} finally {
  await vite.close()
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
