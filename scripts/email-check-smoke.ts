/** Unit checks for server/email-check.ts with controlled DNS and provider answers (no network). */
import { checkEmail, suggestDomain, validSyntax } from '../server/email-check.ts'
import type { DnsAnswer } from '../server/email-check.ts'

let failures = 0
const check = (label: string, ok: boolean, detail = '') => { if (ok) console.log(`  PASS  ${label}`); else { failures++; console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`) } }
const dns = (a: DnsAnswer) => async () => a
const mx = dns({ kind: 'mx', hosts: ['mx.example.net'] })
const none = async () => null

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

console.log('\n  Verdicts')
check('malformed: invalid', (await checkEmail('not-an-email', {}, { dns: mx, mailbox: none })).status === 'invalid')
const sug = await checkEmail('mia@gmial.com', {}, { dns: mx, mailbox: none })
check('typo: asks the buyer to confirm a suggestion', sug.status === 'suggest' && sug.suggestion === 'mia@gmail.com')
check('typo kept on purpose: checked as entered', (await checkEmail('mia@gmial.com', { acceptSuggestion: true }, { dns: mx, mailbox: none })).status === 'ok')
check('domain that doesn’t exist: invalid', JSON.stringify(await checkEmail('a@nope-not-real.example', {}, { dns: dns({ kind: 'nxdomain' }), mailbox: none })) === JSON.stringify({ status: 'invalid', reason: 'no-domain' }))
check('domain with no mail host: invalid', JSON.stringify(await checkEmail('a@site.example', {}, { dns: dns({ kind: 'none' }), mailbox: none })) === JSON.stringify({ status: 'invalid', reason: 'no-mail' }))
check('null MX (accepts no mail): invalid', (await checkEmail('a@site.example', {}, { dns: dns({ kind: 'mx', hosts: ['.'] }), mailbox: none })).status === 'invalid')
check('provider says the mailbox is rejected: invalid', JSON.stringify(await checkEmail('a@site.com', {}, { dns: mx, mailbox: async () => 'rejected' })) === JSON.stringify({ status: 'invalid', reason: 'mailbox-rejected' }))
check('provider unknown / catch-all: inconclusive, not fake', JSON.stringify(await checkEmail('a@site.com', {}, { dns: mx, mailbox: async () => 'inconclusive' })) === JSON.stringify({ status: 'ok', confidence: 'inconclusive', detail: 'provider-inconclusive' }))
check('provider says deliverable', (await checkEmail('a@site.com', {}, { dns: mx, mailbox: async () => 'deliverable' })).status === 'ok')
check('no provider configured: inconclusive', JSON.stringify(await checkEmail('a@site.com', {}, { dns: mx, mailbox: none })) === JSON.stringify({ status: 'ok', confidence: 'inconclusive', detail: 'no-provider' }))
check('provider down (throws): inconclusive', JSON.stringify(await checkEmail('a@site.com', {}, { dns: mx, mailbox: async () => { throw new Error('down') } })) === JSON.stringify({ status: 'ok', confidence: 'inconclusive', detail: 'provider-inconclusive' }))
check('DNS outage: inconclusive, not invalid', JSON.stringify(await checkEmail('a@site.com', {}, { dns: dns({ kind: 'error' }), mailbox: none })) === JSON.stringify({ status: 'ok', confidence: 'inconclusive', detail: 'dns-unavailable' }))
check('DNS that never answers times out as inconclusive', (await checkEmail('a@site.com', {}, { dns: () => new Promise(() => {}), mailbox: none })).status === 'ok')
check('random-looking local part is fine', (await checkEmail('x7q9zk2w4p@site.com', {}, { dns: mx, mailbox: none })).status === 'ok')

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll email check tests passed.')
process.exit(failures ? 1 : 0)
