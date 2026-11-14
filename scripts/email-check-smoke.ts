/** Unit checks for server/email-check.ts with controlled DNS answers (no network). */
import { checkEmail, suggestDomain, validSyntax } from '../server/email-check.ts'
import type { DnsAnswer } from '../server/email-check.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => { if (ok) console.log(`  PASS  ${label}`); else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) } }
const dns = (a: DnsAnswer) => async () => a
const mx = dns({ kind: 'mx', hosts: ['mx.example.net'] })
const nx = dns({ kind: 'nxdomain' })
const none = dns({ kind: 'none' })
const noMail = dns({ kind: 'mx', hosts: ['.'] })
const down = dns({ kind: 'error' })
const forever = () => new Promise<DnsAnswer>(() => {})

console.log('\n  Syntax')
for (const bad of ['plainaddress', '@no-local.com', 'a@b', 'a..b@site.com', '.a@site.com', 'a.@site.com', 'a@-site.com', 'a@site.c', 'a b@site.com', `${'x'.repeat(65)}@site.com`])
  check(`rejects ${bad.slice(0, 30)}`, !validSyntax(bad))
for (const good of ['a@site.com', 'first.last+tag@sub.site.co.uk', 'x7q9zk2w@site.io', "o'brien@site.ie", 'user@xn--bcher-kva.example'])
  check(`accepts ${good}`, validSyntax(good))

console.log('\n  Typo suggestions')
check('gmial.com → gmail.com', suggestDomain('gmial.com') === 'gmail.com')
check('gmail.con → gmail.com', suggestDomain('gmail.con') === 'gmail.com')
check('hotmial.com → hotmail.com', suggestDomain('hotmial.com') === 'hotmail.com')
check('yahooo.com → yahoo.com', suggestDomain('yahooo.com') === 'yahoo.com')
check('a real company domain is left alone', suggestDomain('acme-studio.com') === null && suggestDomain('gmail.com') === null)
check('short real domains are not "corrected"', suggestDomain('mail.de') === null && suggestDomain('me.org') === null)

console.log('\n  Verdicts (built-in: syntax + DNS)')
check('malformed: invalid', (await checkEmail('not-an-email', {}, { dns: mx })).status === 'invalid')
const sug = await checkEmail('mia@gmial.com', {}, { dns: mx })
check('typo: asks the buyer to confirm a suggestion', sug.status === 'suggest' && sug.suggestion === 'mia@gmail.com')
check('typo kept on purpose: checked as entered', (await checkEmail('mia@gmial.com', { acceptSuggestion: true }, { dns: mx })).status === 'ok')
check('domain that doesn’t exist: invalid', JSON.stringify(await checkEmail('a@nope-not-real.example', {}, { dns: nx })) === JSON.stringify({ status: 'invalid', reason: 'no-domain' }))
check('domain with no mail host: invalid', JSON.stringify(await checkEmail('a@site.example', {}, { dns: none })) === JSON.stringify({ status: 'invalid', reason: 'no-mail' }))
check('null MX (accepts no mail): invalid', (await checkEmail('a@site.example', {}, { dns: noMail })).status === 'invalid')
check('a domain that accepts mail: ok', JSON.stringify(await checkEmail('a@site.com', {}, { dns: mx })) === JSON.stringify({ status: 'ok', detail: 'mx.example.net' }))
check('missing MX alone isn’t invalid when the host accepts mail', (await checkEmail('a@mail.example', {}, { dns: async () => ({ kind: 'mx', hosts: ['mail.example'] }) })).status === 'ok')
check('random-looking local part is fine', JSON.stringify(await checkEmail('x7q9zk2w4p@site.com', {}, { dns: mx })) === JSON.stringify({ status: 'ok', detail: 'mx.example.net' }))
check('DNS outage: temporary, not proof the address is fake', JSON.stringify(await checkEmail('a@site.com', {}, { dns: down })) === JSON.stringify({ status: 'temporary', detail: 'dns' }))
check('DNS that never answers times out: temporary', (await checkEmail('a@site.com', {}, { dns: forever })).status === 'temporary')

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll email check tests passed.')
process.exit(failures ? 1 : 0)
