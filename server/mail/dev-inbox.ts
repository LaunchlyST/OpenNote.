import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { Router } from 'express'
import { env } from '../env.ts'

/**
 * A tiny web inbox for development: lists the messages the local transport
 * (or the local SMTP catcher) has written to MAILBOX_DIR, and shows each one
 * exactly as a mail client would. Only mounted when NODE_ENV is not
 * production, so one-time links never become reachable on a live site.
 */

interface Stored {
  id: number | string
  to: string
  subject: string
  html: string
  text: string
  receivedAt: string
  via: string
}

export function readMailbox(): Array<Stored & { file: string }> {
  const dir = env.mail.mailboxDir
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse()
    .map((file) => ({ file, ...(JSON.parse(readFileSync(join(dir, file), 'utf8')) as Stored) }))
}

function esc(v: string) {
  return v.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
}

export function devMailRouter() {
  const router = Router()
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  router.get('/', (_req, res) => {
    const rows = readMailbox()
      .map(
        (m) =>
          `<tr><td>${esc(new Date(m.receivedAt).toLocaleString())}</td><td>${esc(m.to)}</td><td><a href="./${encodeURIComponent(m.file)}">${esc(m.subject)}</a></td><td>${esc(m.via)}</td></tr>`,
      )
      .join('')
    res.type('html').send(`<!doctype html><meta charset="utf-8"><title>OpenNote dev inbox</title>
<style>body{font:14px/1.5 Inter,Segoe UI,Arial,sans-serif;margin:32px;color:#191919}table{border-collapse:collapse;width:100%}td,th{padding:8px 10px;border-bottom:1px solid #ececea;text-align:left}th{color:#8f8e8a;font-weight:600;font-size:12px;text-transform:uppercase}</style>
<h1 style="font-size:20px">OpenNote dev inbox</h1>
<p style="color:#8f8e8a">Local development only. These messages never left this computer.</p>
<table><tr><th>Received</th><th>To</th><th>Subject</th><th>Via</th></tr>${rows || '<tr><td colspan=4>No messages yet.</td></tr>'}</table>`)
  })

  router.get('/:file', (req, res) => {
    const file = basename(req.params.file)
    const msg = readMailbox().find((m) => m.file === file)
    if (!msg) {
      res.status(404).send('Not found')
      return
    }
    res.type('html').send(msg.html)
  })

  return router
}
