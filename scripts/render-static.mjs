/**
 * Renders the landing page to a standalone HTML file with the compiled CSS
 * inlined, so it can be viewed without a running server or a visible browser.
 *
 * Run with: node scripts/render-static.mjs
 */
import { createServer } from 'vite'
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import React from 'react'
import { renderToString } from 'react-dom/server'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/* ------------------------------------------------------------------ */
/* Browser-global stubs (same approach as ssr-smoke.mjs)               */
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
  setAttribute(k, v) { this.attributes[k] = String(v) }
  getAttribute(k) { return this.attributes[k] ?? null }
  appendChild(c) { this.children.push(c); return c }
  addEventListener() {}
  removeEventListener() {}
  querySelector() { return null }
  querySelectorAll() { return [] }
  getBoundingClientRect() { return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 } }
  contains() { return false }
  focus() {}
}

const store = {
  _v: new Map(),
  getItem(k) { return this._v.has(k) ? this._v.get(k) : null },
  setItem(k, v) { this._v.set(k, String(v)) },
  removeItem(k) { this._v.delete(k) },
}
const noopObserver = () => ({ observe() {}, unobserve() {}, disconnect() {}, takeRecords: () => [] })

globalThis.localStorage = store
globalThis.window = {
  location: { pathname: '/', href: 'http://localhost/', hash: '', search: '' },
  history: { pushState() {}, replaceState() {} },
  scrollTo() {},
  addEventListener() {}, removeEventListener() {},
  requestAnimationFrame: (cb) => cb(0),
  cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  IntersectionObserver: noopObserver,
  ResizeObserver: noopObserver,
  setTimeout: () => 0,
  clearTimeout() {},
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
  addEventListener() {}, removeEventListener() {},
}
globalThis.IntersectionObserver = noopObserver
globalThis.ResizeObserver = noopObserver
globalThis.matchMedia = globalThis.window.matchMedia
globalThis.PopStateEvent = class { constructor(t) { this.type = t } }

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */

const vite = await createServer({
  logLevel: 'silent',
  server: { middlewareMode: true },
  appType: 'custom',
})

const mod = await vite.ssrLoadModule('/src/landing/LandingPage.tsx')
const auth = await vite.ssrLoadModule('/src/auth.tsx')
const routerMod = await vite.ssrLoadModule('/src/router.tsx')

const body = renderToString(
  React.createElement(
    auth.AuthProvider,
    null,
    React.createElement(
      routerMod.RouterProvider,
      null,
      React.createElement(mod.LandingPage),
    ),
  ),
)

await vite.close()

/* ------------------------------------------------------------------ */
/* Assemble a standalone document                                      */
/* ------------------------------------------------------------------ */

const cssPath = join(root, 'dist/assets')
const cssFile = readdirSync(cssPath).find((f) => f.endsWith('.css'))
if (!cssFile) {
  console.error('No compiled CSS found in dist/assets — run `npm run build` first.')
  process.exit(1)
}
const css = readFileSync(join(cssPath, cssFile), 'utf8')

// reveal-on-scroll content is hidden by CSS until JS marks it visible; for a
// static render the content must be readable without any scripting.
const staticCss = css.replace(/\.lp-reveal\s*\{[^}]*\}/g, '.lp-reveal { opacity: 1; transform: none; }')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenNote — Your time. Your plans. One beautiful place.</title>
<style>${staticCss}</style>
</head>
<body class="lp-body">
<div id="root">${body}</div>
</body>
</html>
`

const out = join(root, 'dist/landing-preview.html')
writeFileSync(out, html)
console.log(`Wrote ${out} (${(html.length / 1024).toFixed(0)} kB)`)
