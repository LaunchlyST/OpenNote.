import { Router } from 'express'
import type { Request, Response } from 'express'
import { resolveProductLink } from './seller.ts'
import { isShortProductId } from '../shared/short-link.ts'

/**
 * Desknoty product links.
 *
 * Two doors into the same server-side resolver:
 *
 *   GET /p/:id                 true 302 redirect when Express hosts the site
 *                              (or a host-level rewrite points here)
 *   GET /api/p/:id/redirect    true 302 redirect used as the final step from
 *                              the GitHub Pages SPA bootstrap
 *   GET /api/p/:id             JSON for that bootstrap. It deliberately returns
 *                              only a path, never the stored Amazon URL.
 *
 * GitHub Pages cannot run a dynamic redirect itself, so /p/:id on that host is
 * served by the SPA shell, which asks /api/p/:id and then navigates to the
 * redirect endpoint. Both paths revalidate the destination on every request.
 */
export function productLinksRouter(): Router {
  const r = Router()
  r.use((_req, res, next) => (res.set('Cache-Control', 'no-store'), next()))

  r.get('/api/p/:shortId', async (req, res) => {
    const id = String(req.params.shortId ?? '')
    if (!isShortProductId(id)) return void res.status(404).json({ ok: false, error: LINK_ERROR })
    const link = await resolveProductLink(id)
    if (!link.ok) return void res.status(link.status).json({ ok: false, error: link.reason })
    res.json({
      ok: true,
      kind: link.kind,
      // The affiliate destination stays on the server. The browser only gets
      // the redirect endpoint, which performs the checked 302 itself.
      path: link.kind === 'affiliate' ? `/api/p/${id}/redirect` : link.path,
    })
  })

  const redirect = async (req: Request, res: Response) => {
    const id = String(req.params.shortId ?? '')
    if (!isShortProductId(id)) return void sendError(res, 404, LINK_ERROR)
    const link = await resolveProductLink(id)
    if (!link.ok) return void sendError(res, link.status, link.reason)
    res.redirect(302, link.url)
  }
  r.get('/p/:shortId', redirect)
  r.get('/api/p/:shortId/redirect', redirect)

  return r
}

const LINK_ERROR = 'This product link isn’t available.'

/** A plain page, with no product data and no script, for a dead or unsafe link. */
function sendError(res: Response, status: number, message: string) {
  const safe = message.replace(/[<>&"']/g, '')
  res.status(status).type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Link unavailable · Desknoty</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f7f7f5;color:#16161a;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}main{max-width:32rem;padding:2rem;text-align:center}h1{font-size:1.35rem;margin:0 0 .6rem}p{color:#60606b;margin:0}a{color:#16161a}</style></head><body><main><h1>Link unavailable</h1><p>${safe}</p><p><a href="/">Desknoty</a></p></main></body></html>`)
}
