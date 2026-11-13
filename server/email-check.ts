/**
 * Email address checks before a free product is sent.
 *
 * What this can and can't know:
 * - Syntax and whether the domain can receive mail (DNS: MX, or A/AAAA as the
 *   implicit mail host, and RFC 7505 "null MX") are definite.
 * - Whether a mailbox exists usually can't be known for sure. A configured
 *   mailbox-validation provider (Kickbox) can say "rejected"; anything else it
 *   returns (unknown, accept-all, timeouts, outages) is inconclusive.
 * - Inconclusive is never treated as fake. Every free claim is confirmed by a
 *   link sent to the address anyway, so only the inbox owner gets the file.
 * Random-looking local parts are never a reason to reject.
 */
import { resolveMx, resolve4, resolve6 } from 'node:dns/promises'
import { env } from './env.ts'

export type EmailVerdict =
  | { status: 'invalid'; reason: 'syntax' | 'no-domain' | 'no-mail' | 'mailbox-rejected' }
  | { status: 'suggest'; suggestion: string }
  | { status: 'deliverable'; detail: string }
  | { status: 'inconclusive'; detail: string }
  | { status: 'unavailable'; detail: string }

export type DnsAnswer = { kind: 'mx'; hosts: string[] } | { kind: 'none' } | { kind: 'nxdomain' } | { kind: 'error' }
/** Mailbox-provider outcome. `null` means "not configured" — i.e. the check is unavailable. */
export type MailboxOutcome =
  | { outcome: 'deliverable'; detail?: string }
  | { outcome: 'rejected' }
  | { outcome: 'inconclusive'; detail?: string }
  | { outcome: 'unavailable'; detail?: string }
export type Deps = {
  /** MX lookup; falls back to A/AAAA when there are no MX records. */
  dns?: (domain: string) => Promise<DnsAnswer>
  /** Mailbox provider; returns null when not configured. */
  mailbox?: (email: string) => Promise<MailboxOutcome | null>
}

const COMMON = ['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.co.uk', 'outlook.com', 'live.com', 'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'gmx.com', 'btinternet.com', 'sky.com', 'msn.com', 'mail.com']

/** Damerau-Levenshtein distance (adjacent swaps count as one edit). */
export function editDistance(a: string, b: string): number {
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  return d[a.length][b.length]
}

/** A likely typo of a big provider's domain ("gmial.com" → "gmail.com"), or null. */
export function suggestDomain(domain: string): string | null {
  const d = domain.toLowerCase()
  if (COMMON.includes(d)) return null
  const tld = d.replace(/\.(con|cmo|ocm|comm|om|vom|xom)$/, '.com')
  if (tld !== d && COMMON.includes(tld)) return tld
  let best: string | null = null
  let bestD = 3
  for (const c of COMMON) {
    const dist = editDistance(d, c)
    if (dist > 0 && dist < bestD && Math.abs(d.length - c.length) <= 2) { best = c; bestD = dist }
  }
  // two edits only on longer names, so short real domains aren't "corrected"
  if (best && bestD === 2 && d.length < 9) return null
  return best
}

/** Practical syntax check (RFC 5321 lengths, dot rules, hostname labels). Allows unusual but valid local parts. */
export function validSyntax(email: string): boolean {
  if (email.length > 254) return false
  const at = email.lastIndexOf('@')
  if (at < 1) return false
  const local = email.slice(0, at), domain = email.slice(at + 1)
  if (local.length > 64 || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local) || local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  if (domain.length > 253 || !domain.includes('.')) return false
  const labels = domain.split('.')
  if (!labels.every((l) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(l))) return false
  return /^(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i.test(labels[labels.length - 1])
}

const withTimeout = <T>(p: Promise<T>, ms: number, fallback: T) => Promise.race([p, new Promise<T>((r) => setTimeout(() => r(fallback), ms))])

/** Real DNS: MX first; no MX means the A/AAAA host takes mail (RFC 5321 §5.1). */
export async function realDns(domain: string): Promise<DnsAnswer> {
  const code = (e: unknown) => (e as { code?: string }).code
  try {
    const mx = await resolveMx(domain)
    if (mx.length) return { kind: 'mx', hosts: mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange) }
  } catch (e) {
    if (code(e) === 'ENOTFOUND' || code(e) === 'ENXDOMAIN') return { kind: 'nxdomain' }
    if (code(e) !== 'ENODATA') return { kind: 'error' }
  }
  try {
    const [a, aaaa] = await Promise.allSettled([resolve4(domain), resolve6(domain)])
    if ((a.status === 'fulfilled' && a.value.length) || (aaaa.status === 'fulfilled' && aaaa.value.length)) return { kind: 'mx', hosts: [domain] }
    const codes = [a, aaaa].map((r) => (r.status === 'rejected' ? code(r.reason) : 'ENODATA'))
    if (codes.every((c) => c === 'ENODATA' || c === 'ENOTFOUND')) return { kind: 'none' }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}

/**
 * DNS over HTTPS (Cloudflare's JSON API). Works in any runtime with fetch, including the
 * Supabase edge runtime, and reports NXDOMAIN clearly. Only the domain is sent, never the address.
 */
export async function dohDns(domain: string): Promise<DnsAnswer> {
  const ask = async (type: string) => {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' } })
    if (!res.ok) throw new Error(`DoH ${res.status}`)
    return (await res.json()) as { Status: number; Answer?: Array<{ type: number; data: string }> }
  }
  try {
    const mx = await ask('MX')
    if (mx.Status === 3) return { kind: 'nxdomain' }
    if (mx.Status !== 0) return { kind: 'error' }
    const hosts = (mx.Answer ?? []).filter((a) => a.type === 15).map((a) => a.data.trim().split(/\s+/))
      .sort((a, b) => Number(a[0]) - Number(b[0])).map((p) => (p[1] === '.' ? '.' : (p[1] ?? '').replace(/\.$/, '')))
    if (hosts.length) return { kind: 'mx', hosts }
    const [a, aaaa] = await Promise.all([ask('A'), ask('AAAA')])
    if ((a.Answer ?? []).some((x) => x.type === 1) || (aaaa.Answer ?? []).some((x) => x.type === 28)) return { kind: 'mx', hosts: [domain] }
    if (a.Status === 0 && aaaa.Status === 0) return { kind: 'none' }
    return { kind: 'error' }
  } catch {
    return { kind: 'error' }
  }
}

/** DoH first; the runtime's own resolver only if DoH can't answer. */
export async function lookupDomain(domain: string): Promise<DnsAnswer> {
  const doh = await dohDns(domain)
  return doh.kind === 'error' ? realDns(domain) : doh
}

/**
 * Mailbox provider (Kickbox), when KICKBOX_API_KEY is set on the server. Returns null when not
 * configured — i.e. the mailbox check is unavailable and must never be silently bypassed.
 */
export async function kickbox(email: string): Promise<MailboxOutcome | null> {
  const key = (process.env.KICKBOX_API_KEY ?? '').trim()
  if (!key) {
    // No provider key: outside production the local dev/test harness runs on reserved test
    // addresses, so it uses a deterministic stand-in; in production the check is unavailable.
    if (!env.isProduction) return { outcome: 'deliverable', detail: 'dev-standin' }
    return null
  }
  try {
    const res = await fetch(`https://api.kickbox.com/v2/verify?email=${encodeURIComponent(email)}&timeout=6000`, { headers: { Authorization: `token ${key}` } })
    if (!res.ok) return { outcome: 'unavailable', detail: `http-${res.status}` }
    const j = (await res.json()) as { result?: string; reason?: string }
    if (j.result === 'deliverable') return { outcome: 'deliverable' }
    if (j.result === 'undeliverable' && ['rejected_email', 'invalid_email', 'invalid_domain', 'invalid_smtp'].includes(String(j.reason))) return { outcome: 'rejected' }
    return { outcome: 'inconclusive', detail: j.result ?? 'unknown' }
  } catch {
    return { outcome: 'unavailable', detail: 'network' }
  }
}

/** In development and tests, the reserved .test domains (RFC 2606) count as mail-capable. Never in production. */
const testDomains = () => process.env.NODE_ENV !== 'production' && process.env.EMAIL_ALLOW_TEST_DOMAINS === '1'

export async function checkEmail(raw: string, opts: { acceptSuggestion?: boolean } = {}, deps: Deps = {}): Promise<EmailVerdict> {
  const email = raw.trim()
  if (!validSyntax(email)) return { status: 'invalid', reason: 'syntax' }
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
  const hint = suggestDomain(domain)
  if (hint && !opts.acceptSuggestion) return { status: 'suggest', suggestion: `${email.slice(0, email.lastIndexOf('@'))}@${hint}` }
  let dnsAnswer: DnsAnswer
  if (testDomains() && domain.endsWith('.test')) dnsAnswer = { kind: 'mx', hosts: [domain] }
  else dnsAnswer = await withTimeout((deps.dns ?? lookupDomain)(domain), 4000, { kind: 'error' })
  if (dnsAnswer.kind === 'nxdomain') return { status: 'invalid', reason: 'no-domain' }
  if (dnsAnswer.kind === 'none') return { status: 'invalid', reason: 'no-mail' }
  // RFC 7505: a single MX of "." means the domain accepts no mail
  if (dnsAnswer.kind === 'mx' && dnsAnswer.hosts.length === 1 && (dnsAnswer.hosts[0] === '' || dnsAnswer.hosts[0] === '.')) return { status: 'invalid', reason: 'no-mail' }
  const mailbox = await withTimeout((deps.mailbox ?? kickbox)(email).catch((): Promise<MailboxOutcome> => Promise.resolve({ outcome: 'unavailable', detail: 'network' })), 8000, { outcome: 'unavailable', detail: 'timeout' })
  const mb: MailboxOutcome = mailbox ?? { outcome: 'unavailable', detail: 'no-provider' }
  if (mb.outcome === 'rejected') return { status: 'invalid', reason: 'mailbox-rejected' }
  // Only a provider-confirmed deliverable mailbox gets the free product email.
  if (mb.outcome === 'deliverable') return { status: 'deliverable', detail: 'provider' }
  if (mb.outcome === 'unavailable') return { status: 'unavailable', detail: mb.detail ?? 'provider' }
  return { status: 'inconclusive', detail: mb.detail ?? 'unknown' }
}
