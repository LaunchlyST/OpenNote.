import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import type { Server, Socket } from 'node:net'
import { join } from 'node:path'

/**
 * A minimal SMTP server for local development and tests (RFC 5321 subset:
 * EHLO/HELO, MAIL FROM, RCPT TO, DATA, RSET, NOOP, QUIT). It accepts every
 * message on 127.0.0.1 and writes it to the dev inbox instead of delivering
 * it, so OpenNote's real SMTP code path can be exercised end to end without
 * any outside service. It is NOT a mail server for the internet: it does no
 * relaying, no TLS and no authentication, and only listens on loopback.
 */

export interface CaughtMessage {
  from: string
  to: string[]
  raw: string
  subject: string
  html: string
  text: string
}

function decodeBody(body: string, encoding: string): string {
  const enc = encoding.toLowerCase()
  if (enc === 'base64') return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
  if (enc === 'quoted-printable') {
    const bytes = body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-F]{2})/gi, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    return Buffer.from(bytes, 'latin1').toString('utf8')
  }
  return body
}

/** Pulls the subject and the text/html parts out of a (possibly multipart) message. */
export function parseMessage(raw: string): { subject: string; html: string; text: string } {
  const [head, ...rest] = raw.split(/\r?\n\r?\n/)
  const unfolded = head.replace(/\r?\n[ \t]+/g, ' ')
  const header = (name: string, h = unfolded) => new RegExp(`^${name}:\\s*(.*)$`, 'im').exec(h)?.[1]?.trim() ?? ''
  const subject = header('Subject').replace(/=\?utf-8\?q\?(.*?)\?=/gi, (_m, q: string) =>
    decodeBody(q.replace(/_/g, ' '), 'quoted-printable'),
  )

  let html = ''
  let text = ''
  const boundary = /boundary="?([^";]+)"?/i.exec(header('Content-Type'))?.[1]
  const parts = boundary ? rest.join('\n\n').split(`--${boundary}`) : [rest.join('\n\n')]
  for (const part of parts) {
    const [ph, ...pb] = part.replace(/^\r?\n/, '').split(/\r?\n\r?\n/)
    const pHead = boundary ? ph.replace(/\r?\n[ \t]+/g, ' ') : unfolded
    const body = boundary ? pb.join('\n\n') : part
    const type = header('Content-Type', pHead).toLowerCase()
    const decoded = decodeBody(body.trim(), header('Content-Transfer-Encoding', pHead))
    if (type.startsWith('text/html')) html = decoded
    else if (type.startsWith('text/plain')) text = decoded
  }
  return { subject, html, text }
}

export function startSmtpCatcher(opts: {
  port: number
  host?: string
  mailboxDir?: string
  onMessage?: (m: CaughtMessage) => void
}): Promise<Server> {
  const server = createServer((socket: Socket) => {
    let from = ''
    let to: string[] = []
    let inData = false
    let buffer = ''
    let data: string[] = []
    const reply = (line: string) => socket.write(`${line}\r\n`)

    reply('220 opennote-dev-catcher ESMTP ready')
    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      let idx: number
      while ((idx = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)

        if (inData) {
          if (line === '.') {
            inData = false
            const raw = data.join('\r\n')
            const parsed = parseMessage(raw)
            const msg: CaughtMessage = { from, to, raw, ...parsed }
            if (opts.mailboxDir) {
              mkdirSync(opts.mailboxDir, { recursive: true })
              const id = `${Date.now()}-smtp${Math.random().toString(36).slice(2, 8)}`
              writeFileSync(
                join(opts.mailboxDir, `${id}.json`),
                JSON.stringify({ id, to: to.join(', '), subject: parsed.subject, html: parsed.html, text: parsed.text, receivedAt: new Date().toISOString(), via: 'smtp-catcher' }, null, 2),
              )
            }
            opts.onMessage?.(msg)
            reply('250 OK: message accepted for local inbox')
            from = ''
            to = []
            data = []
          } else {
            data.push(line.startsWith('..') ? line.slice(1) : line)
          }
          continue
        }

        const cmd = line.slice(0, 4).toUpperCase()
        if (cmd === 'EHLO') {
          socket.write('250-opennote-dev-catcher\r\n250-8BITMIME\r\n250-SMTPUTF8\r\n250 SIZE 10485760\r\n')
        } else if (cmd === 'HELO') reply('250 opennote-dev-catcher')
        else if (cmd === 'MAIL') {
          from = /<([^>]*)>/.exec(line)?.[1] ?? ''
          reply('250 OK')
        } else if (cmd === 'RCPT') {
          to.push(/<([^>]*)>/.exec(line)?.[1] ?? '')
          reply('250 OK')
        } else if (cmd === 'DATA') {
          if (!to.length) reply('503 RCPT first')
          else {
            inData = true
            reply('354 End data with <CR><LF>.<CR><LF>')
          }
        } else if (cmd === 'RSET') {
          from = ''
          to = []
          reply('250 OK')
        } else if (cmd === 'NOOP') reply('250 OK')
        else if (cmd === 'QUIT') {
          reply('221 Bye')
          socket.end()
        } else reply('502 Command not implemented')
      }
    })
    socket.on('error', () => socket.destroy())
  })

  return new Promise((resolve) => server.listen(opts.port, opts.host ?? '127.0.0.1', () => resolve(server)))
}
