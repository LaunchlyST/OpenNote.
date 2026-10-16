/**
 * Prints every DNS record OpenNote's own mail server needs, and creates the
 * DKIM key pair if there is none yet. Uses only the values you pass in — it
 * never guesses a domain or IP.
 *
 *   npm run mail:dns -- --domain yourdomain.com --ip 203.0.113.10 [--host mail.yourdomain.com] [--selector opennote]
 *
 * The private key is written to data/dkim/<selector>.private.pem (git-ignored,
 * mode 600). Only the public half is printed.
 */
import { generateKeyPairSync, createPublicKey } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isIP } from 'node:net'

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? (process.argv[i + 1] ?? '') : ''
}

const domain = arg('domain').toLowerCase()
const ip = arg('ip')
const selector = arg('selector') || 'opennote'
const host = (arg('host') || `mail.${domain}`).toLowerCase()

if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) || isIP(ip) === 0) {
  console.error('Usage: npm run mail:dns -- --domain yourdomain.com --ip <server public IP> [--host mail.yourdomain.com]')
  process.exit(1)
}

const dir = 'data/dkim'
const keyPath = `${dir}/${selector}.private.pem`
mkdirSync(dir, { recursive: true })
if (!existsSync(keyPath)) {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  writeFileSync(keyPath, privateKey.export({ type: 'pkcs8', format: 'pem' }))
  chmodSync(keyPath, 0o600)
  console.log(`Created DKIM private key: ${keyPath} (keep it secret, never commit it)\n`)
}
const publicDer = createPublicKey(readFileSync(keyPath, 'utf8')).export({ type: 'spki', format: 'der' })
const p = publicDer.toString('base64')
const v6 = isIP(ip) === 6

const rows: Array<[string, string, string, string]> = [
  ['A' + (v6 ? 'AAA' : ''), host, ip, 'mail server address'],
  ['MX', domain, `10 ${host}.`, 'where other servers deliver mail for your domain'],
  ['TXT', domain, `v=spf1 ${v6 ? 'ip6' : 'ip4'}:${ip} mx -all`, 'SPF: only this server may send as your domain'],
  ['TXT', `${selector}._domainkey.${domain}`, `v=DKIM1; k=rsa; p=${p}`, 'DKIM public key'],
  ['TXT', `_dmarc.${domain}`, `v=DMARC1; p=quarantine; adkim=s; aspf=s; rua=mailto:postmaster@${domain}`, 'DMARC policy'],
  ['PTR', ip, `${host}.`, 'reverse DNS — set at your SERVER provider, not your DNS host'],
]

console.log(`DNS records for ${domain} (mail host ${host}, IP ${ip})\n`)
for (const [type, name, value, note] of rows) {
  console.log(`${type.padEnd(5)} ${name}\n      ${value}\n      ↳ ${note}\n`)
}
console.log(`Then in OpenNote's .env:
  EMAIL_FROM="OpenNote <no-reply@${domain}>"
  DKIM_DOMAIN=${domain}
  DKIM_SELECTOR=${selector}
  DKIM_PRIVATE_KEY_PATH=${keyPath}
and check everything with: npm run mail:doctor`)
