#!/usr/bin/env node
/**
 * Unit tests for the text redaction rule engine (src/lib/ml/text).
 *
 *   node scripts/redact-test.mjs [--verbose] [filter]
 *
 * Node runs the TypeScript sources directly (type stripping); a resolve hook
 * maps extensionless relative imports to .ts files.
 */
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SRC = new URL('../src/', import.meta.url)
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@/')) {
      for (const ext of ['', '.ts', '.tsx']) {
        const url = new URL(specifier.slice(2) + ext, SRC)
        if (existsSync(fileURLToPath(url)) && ext !== '' ) return next(url.href, context)
      }
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && !/\.[cm]?[jt]s$|\.json$/.test(specifier) && context.parentURL) {
      const url = new URL(`${specifier}.ts`, context.parentURL)
      if (existsSync(fileURLToPath(url))) return next(url.href, context)
    }
    return next(specifier, context)
  },
})

const root = new URL('../src/lib/ml/text/', import.meta.url)
const { detectRules, findListed, mergeSpans } = await import(new URL('merge.ts', root).href)
const { SECRET_RULES } = await import(new URL('secret-rules.ts', root).href)
const { Replacer, maskSpans: applySpans } = await import(new URL('placeholders.ts', root).href)
const { faker } = await import('@faker-js/faker/locale/en')

const verbose = process.argv.includes('--verbose')
const filter = process.argv.slice(2).find((a) => !a.startsWith('--'))

/* Deterministic random strings for fake keys (never real credentials). */
let seed = 42
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff
  return seed / 0x7fffffff
}
const AL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const UP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const HEX = '0123456789abcdef'
const LOW = 'abcdefghijklmnopqrstuvwxyz0123456789'
const r = (n, al = AL) => Array.from({ length: n }, () => al[Math.floor(rand() * al.length)]).join('')
/** Random string that is sure to contain upper, lower and digits. */
const rm = (n) => {
  for (;;) {
    const s = r(n)
    if (/[a-z]/.test(s) && /[A-Z]/.test(s) && /\d/.test(s)) return s
  }
}

/**
 * Each case: text, the values that must be found (with type), and the
 * values that must not be found. `secrets` cases run with the secret rules.
 */
const cases = []
const yes = (name, text, found, opts = {}) => cases.push({ name, text, found, none: [], opts })
const no = (name, text, none, opts = {}) => cases.push({ name, text, found: [], none, opts })
const mixed = (name, text, found, none, opts = {}) => cases.push({ name, text, found, none, opts })

/* ---------------- emails ---------------- */
yes('email plain', 'Write to anna.berg@example.com today.', [['EMAIL', 'anna.berg@example.com']])
yes('email plus tag', 'Mail: j.doe+news@mail.co.uk.', [['EMAIL', 'j.doe+news@mail.co.uk']])
yes('email in angle brackets', 'From: Anna <anna@firma.de>', [['EMAIL', 'anna@firma.de']])
yes('email subdomain', 'ops@eu-west.corp-mail.example.org', [['EMAIL', 'ops@eu-west.corp-mail.example.org']])
yes('email uppercase', 'CONTACT: SALES@ACME.COM', [['EMAIL', 'SALES@ACME.COM']])
yes('email in json', '{"email":"x_y@test.io","id":3}', [['EMAIL', 'x_y@test.io']])
no('retina image name', 'Use logo@2x.png on retina screens.', ['logo@2x.png'])
no('git remote', 'git clone git@github.com:acme/app.git', ['git@github.com'])
no('npm scope', 'npm i @astrojs/react @types/node', ['@astrojs/react'])
no('decorator', '@Component({ selector: "x" }) class A {}', ['@Component'])

/* ---------------- phones ---------------- */
yes('phone us parens', 'Call (415) 555-0134 now', [['PHONE', '(415) 555-0134']])
yes('phone us dashes', 'cell 212-555-0187.', [['PHONE', '212-555-0187']])
yes('phone us dots', 'Phone: 646.555.0199', [['PHONE', '646.555.0199']])
yes('phone us +1', 'Reach me at +1 415 555 0134', [['PHONE', '+1 415 555 0134']])
yes('phone uk intl', 'Tel +44 20 7946 0958', [['PHONE', '+44 20 7946 0958']])
yes('phone uk national', 'Ring 020 7946 0958 after 5', [['PHONE', '020 7946 0958']])
yes('phone uk mobile', 'Mobile: 07700 900123', [['PHONE', '07700 900123']])
yes('phone de', 'Telefon: 030 12345678', [['PHONE', '030 12345678']])
yes('phone de intl paren', 'Tel. +49 (0)30 1234 5678', [['PHONE', '+49 (0)30 1234 5678']])
yes('phone fr dots', 'Appelez le 06.12.34.56.78', [['PHONE', '06.12.34.56.78']])
yes('phone fr spaces', 'Tél : 01 42 68 53 00', [['PHONE', '01 42 68 53 00']])
yes('phone intl 00', 'Fax 0041 44 668 18 00', [['PHONE', '0041 44 668 18 00']])
yes('phone bare with context', 'whatsapp 4915112345678', [['PHONE', '4915112345678']])
yes('phone es', 'móvil +34 612 34 56 78', [['PHONE', '+34 612 34 56 78']])
no('version number', 'Upgraded to version 10.0.19041.1234 yesterday', ['10.0.19041.1234'])
no('semver', 'Requires node 22.12.0 or later', ['22.12.0'])
no('iso date', 'Released 2024-03-15 at noon', ['2024-03-15'], { types: ['PHONE'] })
no('timestamp', 'at 2024-03-15 10:30:45 UTC', ['2024-03-15 10'], { types: ['PHONE'] })
no('decimal', 'pi is 3.14159265358979', ['3.14159265358979'])
no('order id', 'Order 123456789 shipped', ['123456789'], { types: ['PHONE'] })
no('money', 'Total 1 234 567 EUR', ['1 234 567'])
no('ip as phone', 'host 192.168.100.200 up', ['192.168.100.200'], { types: ['PHONE'] })
no('range', 'pages 1000-2000 and 3000-4000', ['1000-2000'])
no('unix time', 'ts=1712345678 ok', ['1712345678'])
no('hash digits', 'build 20240315123456', ['20240315123456'])
no('fraction path', 'see 10/20/300/4000', ['10/20/300/4000'])
no('coordinates', 'lat 51.507351, lon -0.127758', ['51.507351'])

/* ---------------- cards ---------------- */
yes('visa spaced', 'Card 4111 1111 1111 1111 exp 12/27', [['CARD', '4111 1111 1111 1111']])
yes('visa plain', 'cc=4012888888881881;', [['CARD', '4012888888881881']])
yes('mastercard dashes', 'MC 5555-5555-5555-4444', [['CARD', '5555-5555-5555-4444']])
yes('amex 4-6-5', 'Amex 3782 822463 10005', [['CARD', '3782 822463 10005']])
yes('discover', 'Discover 6011111111111117', [['CARD', '6011111111111117']])
yes('mastercard 2-series', 'card 2223003122003222', [['CARD', '2223003122003222']])
no('luhn fail', 'Card 4111 1111 1111 1112', ['4111 1111 1111 1112'], { types: ['CARD'] })
no('random 16 digits', 'id 1234567890123456', ['1234567890123456'], { types: ['CARD'] })
no('mixed groups', 'ref 4111-1111 1111-1111', ['4111-1111 1111-1111'], { types: ['CARD'] })
no('card-like timestamp', '1712345678901234 ms', ['1712345678901234'], { types: ['CARD'] })

/* ---------------- IBAN ---------------- */
yes('iban de spaced', 'IBAN: DE89 3704 0044 0532 0130 00.', [['IBAN', 'DE89 3704 0044 0532 0130 00']])
yes('iban gb compact', 'GB29NWBK60161331926819', [['IBAN', 'GB29NWBK60161331926819']])
yes('iban fr', 'FR14 2004 1010 0505 0001 3M02 606', [['IBAN', 'FR14 2004 1010 0505 0001 3M02 606']])
yes('iban nl then word', 'NL91ABNA0417164300 Amsterdam', [['IBAN', 'NL91ABNA0417164300']])
yes('iban ch', 'CH9300762011623852957', [['IBAN', 'CH9300762011623852957']])
no('iban bad check', 'DE89 3704 0044 0532 0130 01', ['DE89 3704 0044 0532 0130 01'], { types: ['IBAN'] })
no('iban wrong length', 'DE89370400440532013', ['DE89370400440532013'], { types: ['IBAN'] })
no('iban-like code', 'SKU AB12CDEFGHIJKLMNOP', ['AB12CDEFGHIJKLMNOP'], { types: ['IBAN'] })

/* ---------------- IP / MAC / URL ---------------- */
yes('ipv4', 'Login from 203.0.113.45 failed', [['IP', '203.0.113.45']])
yes('ipv4 private cidr', 'subnet 10.20.0.0/16', [['IP', '10.20.0.0/16']])
yes('ipv6 full', 'addr 2001:0db8:85a3:0000:0000:8a2e:0370:7334', [['IP', '2001:0db8:85a3:0000:0000:8a2e:0370:7334']])
yes('ipv6 compressed', 'client fe80::1ff:fe23:4567:890a%eth0 joined', [['IP', 'fe80::1ff:fe23:4567:890a%eth0']])
yes('ipv6 short', 'DNS 2606:4700:4700::1111', [['IP', '2606:4700:4700::1111']])
no('ipv4 version', 'AssemblyVersion 1.0.0.0 and version 2.4.10.3', ['1.0.0.0', '2.4.10.3'], { types: ['IP'] })
no('localhost ip', 'listening on 127.0.0.1:8080 and 0.0.0.0', ['127.0.0.1', '0.0.0.0'], { types: ['IP'] })
no('oid', 'OID 1.3.6.1.4.1.311', ['1.3.6.1'], { types: ['IP'] })
no('time as ipv6', 'at 12:30:45 sharp', ['12:30:45'], { types: ['IP'] })
no('cpp scope', 'std::vector<int> a; Foo::Bar::baz()', ['std::vector'], { types: ['IP'] })
no('netmask', 'mask 255.255.255.0', ['255.255.255.0'], { types: ['IP'] })
yes('mac colon', 'device 00:1A:2B:3C:4D:5E online', [['MAC', '00:1A:2B:3C:4D:5E']])
yes('mac dash', 'MAC 3c-22-fb-12-34-56', [['MAC', '3c-22-fb-12-34-56']])
yes('mac cisco', 'mac 001a.2b3c.4d5e', [['MAC', '001a.2b3c.4d5e']])
no('mac broadcast', 'ff:ff:ff:ff:ff:ff', ['ff:ff:ff:ff:ff:ff'], { types: ['MAC'] })
yes('url', 'See https://example.com/profile/anna?id=7.', [['URL', 'https://example.com/profile/anna?id=7']])
yes('url in parens', '(https://example.com/a_(b))', [['URL', 'https://example.com/a_(b)']])
yes('www url', 'visit www.example.org/me, thanks', [['URL', 'www.example.org/me']])

/* ---------------- dates ---------------- */
yes('dob context', 'Date of birth: 14/03/1987', [['DOB', '14/03/1987']])
yes('dob born', 'She was born on March 14, 1987 in Oslo', [['DOB', 'March 14, 1987']])
yes('dob de', 'geboren am 14.03.1987', [['DOB', '14.03.1987']])
yes('dob iso', 'DOB 1987-03-14', [['DOB', '1987-03-14']])
yes('date text', 'Meeting on 3rd June 2025.', [['DATE', '3rd June 2025']])
yes('date us', 'Due 12/31/2025', [['DATE', '12/31/2025']])
yes('date fr', 'le 14 juillet 2024', [['DATE', '14 juillet 2024']])
no('invalid date', 'code 31/02/2024', ['31/02/2024'], { types: ['DATE', 'DOB'] })
no('version as date', 'release v1.2.23 is out', ['1.2.23'], { types: ['DATE', 'DOB'] })
no('ratio', 'aspect 16/9/2', ['16/9/2'], { types: ['DATE', 'DOB'] })

/* ---------------- ID numbers ---------------- */
yes('us ssn', 'SSN 536-90-4399 on file', [['ID', '536-90-4399']])
yes('us ssn spaced ctx', 'social security number 536 90 4399', [['ID', '536 90 4399']])
yes('uk nino', 'NI number AB 12 34 56 C', [['ID', 'AB 12 34 56 C']])
yes('uk nhs', 'NHS number 943 476 5919', [['ID', '943 476 5919']])
yes('es dni', 'DNI 12345678Z', [['ID', '12345678Z']])
yes('es nie', 'NIE X1234567L', [['ID', 'X1234567L']])
yes('it cf', 'CF RSSMRA85T10A562S', [['ID', 'RSSMRA85T10A562S']])
yes('fr nir', 'n° sécu 1 85 05 78 006 084 91', [['ID', '1 85 05 78 006 084 91']])
yes('de steuer', 'Steuer-ID 86095742719', [['ID', '86095742719']])
yes('nl bsn', 'BSN 111222333', [['ID', '111222333']])
yes('in pan', 'PAN ABCPE1234F', [['ID', 'ABCPE1234F']])
yes('passport', 'Passport no. X1234567', [['ID', 'X1234567']])
yes('account ctx', 'Account number: 12345678', [['ID', '12345678']])
yes('customer id', 'Customer ID: CUST-2024-88812', [['ID', 'CUST-2024-88812']])
no('ssn invalid', 'code 000-12-3456 and 666-12-3456', ['000-12-3456', '666-12-3456'], { types: ['ID'] })
no('nhs without ctx', 'call 943 476 5919', ['943 476 5919'], { types: ['ID'] })
no('nino excluded prefix', 'GB 12 34 56 A', ['GB 12 34 56 A'], { types: ['ID'] })
no('account short', 'Account: 1234', ['1234'], { types: ['ID'] })

/* ---------------- addresses ---------------- */
yes('us street', 'Ship to 1600 Pennsylvania Avenue NW, Washington, DC 20500', [['ADDRESS', '1600 Pennsylvania Avenue'], ['POSTCODE', '20500']])
yes('uk street + postcode', 'Flat 2, 221B Baker Street, London NW1 6XE', [['ADDRESS', '221B Baker Street'], ['POSTCODE', 'NW1 6XE']])
yes('de street', 'Wohnt in der Hauptstraße 12a, 10115 Berlin', [['ADDRESS', 'Hauptstraße 12a'], ['POSTCODE', '10115']])
yes('de street word', 'Am Alten Markt Weg 5', [['ADDRESS', 'Markt Weg 5']])
yes('fr street', 'au 12 rue de la Paix, 75002 Paris', [['ADDRESS', '12 rue de la Paix'], ['POSTCODE', '75002']])
yes('es street', 'Calle Mayor 15, Madrid', [['ADDRESS', 'Calle Mayor 15']])
yes('nl street', 'Kalverstraat 92, 1012 PH Amsterdam', [['ADDRESS', 'Kalverstraat 92'], ['POSTCODE', '1012 PH']])
yes('ca postcode', 'Toronto, ON M5V 3L9', [['POSTCODE', 'M5V 3L9']])
yes('zip4', 'ZIP 94105-1804', [['POSTCODE', '94105-1804']])
no('thin street', 'Step 3 St', ['3 St'], { types: ['ADDRESS'] })
no('year city', 'In 2024 Berlin was cold', ['2024'], { types: ['POSTCODE'] })

/* ---------------- usernames and titled names ---------------- */
yes('handle', 'thanks @anna_berg for the fix', [['USERNAME', '@anna_berg']])
yes('handle dots', 'cc @j.doe', [['USERNAME', '@j.doe']])
yes('username ctx', 'username: kbrown42', [['USERNAME', 'kbrown42']])
no('css at rules', '@media (max-width: 600px) { @import "x.css"; }', ['@media', '@import'], { types: ['USERNAME'] })
no('jsdoc', '/** @param x the value @returns y */', ['@param', '@returns'], { types: ['USERNAME'] })
no('slack broadcast', 'hey @here and @channel', ['@here', '@channel'], { types: ['USERNAME'] })
no('package version', 'install react@19.2.0 now', ['@19.2.0'], { types: ['USERNAME'] })
yes('titled name', 'Dear Mr. John Carter,', [['PERSON', 'John Carter']])
yes('titled name de', 'Sehr geehrte Frau Müller', [['PERSON', 'Müller']])
yes('labelled name', 'Name: Anna Berg\nAge: 40', [['PERSON', 'Anna Berg']])

/* ---------------- secrets: one per provider ---------------- */
const S = { secrets: true }
const keys = [
  ['aws-access-key', `AKIA${r(16, UP.replace(/[a-z]/g, ''))}`],
  ['aws-secret-key', `aws_secret_access_key = ${r(40, AL + '/+')}`, true],
  ['gcp-api-key', `AIza${r(35, AL + '_-')}`],
  ['gcp-oauth-secret', `GOCSPX-${r(28)}`],
  ['gcp-oauth-token', `ya29.${r(60, AL + '_-')}`],
  ['azure-storage-key', `DefaultEndpointsProtocol=https;AccountName=acme;AccountKey=${r(86, AL + '+/')}==;EndpointSuffix=core.windows.net`, true],
  ['azure-client-secret', `abc8Q~${r(34, AL + '_~.-')}`],
  ['digitalocean', `dop_v1_${r(64, HEX)}`],
  ['alibaba', `LTAI${r(20)}`],
  ['scaleway', `SCW${r(17, 'ABCDEFGHJKMNPQRSTVWXYZ0123456789')}`],
  ['fly', `fo1_${r(43, AL + '_-')}`],
  ['heroku', `HRKU-AA${r(58, AL + '_-')}`],
  ['databricks', `dapi${r(32, HEX)}`],
  ['hashicorp-vault', `hvs.${r(90, AL + '_-')}`],
  ['terraform', `${r(14, LOW)}.atlasv1.${r(67, LOW)}`],
  ['pulumi', `pul-${r(40, HEX)}`],
  ['doppler', `dp.pt.${r(43)}`],
  ['supabase', `sbp_${r(40, HEX)}`],
  ['planetscale', `pscale_tkn_${r(43)}`],
  ['github-token', `ghp_${r(36)}`],
  ['github-pat', `github_pat_${r(22)}_${r(59)}`],
  ['gitlab-token', `glpat-${r(20, AL + '_-')}`],
  ['bitbucket', `ATBB${r(32)}`],
  ['atlassian', `ATATT3${r(180, AL + '_-')}`],
  ['npm', `npm_${r(36)}`],
  ['pypi', `pypi-AgEIcHlwaS5vcmc${r(60, AL + '_-')}`],
  ['rubygems', `rubygems_${r(48, HEX)}`],
  ['nuget', `oy2${r(43, 'abcdefghijklmnopqrstuvwxyz0123456789')}`],
  ['clojars', `CLOJARS_${r(60, LOW)}`],
  ['dockerhub', `dckr_pat_${r(27, AL + '_-')}`],
  ['openai', `sk-proj-${r(20)}T3BlbkFJ${r(20)}`],
  ['openai-project', `sk-proj-${r(48, AL + '_-')}`],
  ['anthropic', `sk-ant-api03-${r(93, AL + '_-')}AA`],
  ['openrouter', `sk-or-v1-${r(64, HEX)}`],
  ['huggingface', `hf_${r(34)}`],
  ['groq', `gsk_${r(52)}`],
  ['xai', `xai-${r(80)}`],
  ['perplexity', `pplx-${r(48)}`],
  ['replicate', `r8_${r(37)}`],
  ['stripe-secret', `sk_live_${r(24)}`],
  ['stripe-webhook', `whsec_${r(32)}`],
  ['stripe-publishable', `pk_test_${r(24)}`],
  ['square', `sq0csp-${r(43, AL + '_-')}`],
  ['braintree', `access_token$production$${r(16, LOW)}$${r(32, HEX)}`],
  ['shopify', `shpat_${r(32, HEX)}`],
  ['razorpay', `rzp_live_${r(14)}`],
  ['flutterwave', `FLWSECK_TEST-${r(32, 'abcdefgh0123456789')}-X`],
  ['easypost', `EZAK${r(54)}`],
  ['shippo', `shippo_live_${r(40, HEX)}`],
  ['duffel', `duffel_test_${r(43, AL + '_-')}`],
  ['slack-token', `xoxb-${r(12, '0123456789')}-${r(12, '0123456789')}-${r(24)}`],
  ['slack-app-token', `xapp-1-A${r(10, UP)}-${r(13, '0123456789')}-${r(64, HEX)}`],
  ['slack-webhook', `https://hooks.slack.com/services/T${r(8, UP)}/B${r(8, UP)}/${r(24)}`],
  ['discord-webhook', `https://discord.com/api/webhooks/${r(18, '0123456789')}/${r(68, AL + '_-')}`],
  ['discord-bot', `M${r(23)}.${r(6)}.${r(27)}`],
  ['teams-webhook', `https://acme.webhook.office.com/webhookb2/${r(36, HEX)}@${r(36, HEX)}/IncomingWebhook/${r(32, HEX)}/${r(36, HEX)}`],
  ['telegram-bot', `123456789:AA${r(33, AL + '_-')}`],
  ['twilio-key', `SK${r(32, HEX)}`],
  ['twilio-sid', `AC${r(32, HEX)}`],
  ['sendgrid', `SG.${r(22, AL + '_-')}.${r(43, AL + '_-')}`],
  ['mailgun', `key-${r(32)}`],
  ['mailchimp', `${r(32, HEX)}-us14`],
  ['resend', `re_${r(8)}_${r(24)}`],
  ['linear', `lin_api_${r(40)}`],
  ['notion', `ntn_${r(46)}`],
  ['figma', `figd_${r(40, AL + '_-')}`],
  ['postman', `PMAK-${r(24, HEX)}-${r(34, HEX)}`],
  ['sentry-token', `sntryu_${r(64, HEX)}`],
  ['sentry-dsn', `https://${r(32, HEX)}@o123456.ingest.sentry.io/4504`, true],
  ['newrelic', `NRAK-${r(27, UP)}`],
  ['grafana', `glsa_${r(32)}_${r(8, HEX)}`],
  ['dropbox', `sl.${r(140, AL + '_-')}`],
  ['asana', `2/${r(16, '0123456789')}/${r(16, '0123456789')}:${r(32)}`],
  ['airtable', `pat${r(14)}.${r(64, HEX)}`],
  ['mapbox', `sk.eyJ${r(40)}.${r(22)}`],
  ['contentful', `CFPAT-${r(43, AL + '_-')}`],
  ['typeform', `tfp_${r(59)}`],
  ['readme', `rdme_${r(70, LOW)}`],
  ['prefect', `pnu_${r(36)}`],
  ['frameio', `fio-u-${r(64)}`],
  ['facebook', `EAAB${r(120)}`],
  ['twitter-bearer', `AAAAAAAAAAAAAAAAAAAAA${r(60)}`],
  ['age-key', `AGE-SECRET-KEY-1${r(58, 'QPZRY9X8GF2TVDW0S3JN54KHCE6MUA7L')}`],
  ['jwt', `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4ifQ.${r(43, AL + '_-')}`],
]
for (const [rule, key, contextual] of keys) {
  const text = contextual ? `config: ${key}\n` : `export TOKEN_VALUE=${key}\nother line`
  cases.push({ name: `secret ${rule}`, text, found: [], none: [], opts: S, rule })
}
yes('private key', `-----BEGIN RSA PRIVATE KEY-----\nMIIEow${r(60, AL + '+/')}\n${r(64, AL + '+/')}\n-----END RSA PRIVATE KEY-----`, [['SECRET', '-----BEGIN RSA PRIVATE KEY-----']], S)
yes('openssh key', `-----BEGIN OPENSSH PRIVATE KEY-----\nb3Blbn${r(60, AL + '+/')}\n-----END OPENSSH PRIVATE KEY-----`, [['SECRET', '-----BEGIN OPENSSH']], S)
yes('escaped key in json', `{"private_key":"-----BEGIN PRIVATE KEY-----\\nMIIEv${r(80, AL + '+/')}\\n-----END PRIVATE KEY-----\\n"}`, [['SECRET', '-----BEGIN PRIVATE KEY-----']], S)
yes('url password', 'DATABASE_URL=postgres://app:s3cr3tPw@db.internal:5432/app', [['SECRET', 's3cr3tPw']], S)
yes('mongo password', 'mongodb+srv://admin:Hunter2xyz@cluster0.mongodb.net/test', [['SECRET', 'Hunter2xyz']], S)
yes('bearer header', 'Authorization: Bearer abc123def456ghi789', [['SECRET', 'abc123def456ghi789']], S)
yes('basic header', 'Authorization: Basic dXNlcjpwYXNzd29yZA==', [['SECRET', 'dXNlcjpwYXNzd29yZA==']], S)
yes('api key header', 'x-api-key: 8f14e45fceea167a5a36dedd4bea2543', [['SECRET', '8f14e45fceea167a5a36dedd4bea2543']], S)
yes('cookie', 'Cookie: sessionid=a8f5f167f44f4964e6c998dee827110c; theme=dark', [['SECRET', 'a8f5f167f44f4964e6c998dee827110c']], S)
yes('env password', 'DB_PASSWORD=correct-horse-battery', [['SECRET', 'correct-horse-battery']], S)
yes('json secret', '{"client_secret": "my secret value 9"}', [['SECRET', 'my secret value 9']], S)
yes('yaml password', 'db:\n  password: Tr0ub4dor&3\n', [['SECRET', 'Tr0ub4dor&3']], S)
yes('python token', "API_TOKEN = 'f00b4r-b4z-qux'", [['SECRET', 'f00b4r-b4z-qux']], S)
yes('ini pass', 'pass = letmein123', [['SECRET', 'letmein123']], S)
yes('npmrc', '//registry.npmjs.org/:_authToken=npm_aaaaBBBBccccDDDDeeeeFFFFgggg', [['SECRET', 'npm_aaaa']], S)
yes('entropy key', `random=${rm(40)} end`, [['SECRET', '']], S)
yes('internal host', 'connect db01.prod.corp:5432', [['URL', 'db01.prod.corp']], { secrets: true, hosts: true })
no('git sha', 'commit 9fceb02d0ae598e95dc970b74767f19372d61af8 merged', ['9fceb02d0ae598e95dc970b74767f19372d61af8'], { ...S, types: ['SECRET'] })
no('sha256', 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', ['e3b0c442'], { ...S, types: ['SECRET'] })
no('npm integrity', '"integrity": "sha512-Hm5mbUOvHgg6SyEfV9kUJtrS9FHSPvnwGoG8Ql0ruLSpRcCUmBu3xwBgMqmS4wZSTIu0q9IbQvqZRvTKdD7+Ng=="', ['Hm5mbUOv'], { ...S, types: ['SECRET'] })
no('uuid', 'request 550e8400-e29b-41d4-a716-446655440000 done', ['550e8400'], { ...S, types: ['SECRET'] })
no('camel identifier', 'const getUserProfileSettingsForAccount2 = 1', ['getUserProfileSettingsForAccount2'], { ...S, types: ['SECRET'] })
no('path', 'open src/components/tools/redact/TextRedactor.tsx', ['src/components'], { ...S, types: ['SECRET'] })
no('type annotation', 'interface Login { password: string; token?: string }', ['string'], { ...S, types: ['SECRET'] })
no('token type', '{"token_type": "bearer", "expires_in": 3600}', ['bearer', '3600'], { ...S, types: ['SECRET'] })
no('max tokens', 'max_tokens: 4096', ['4096'], { ...S, types: ['SECRET'] })
no('getpass', 'password = getpass()', ['getpass'], { ...S, types: ['SECRET'] })
no('env ref', 'API_KEY=${API_KEY}\nSECRET: process.env.SECRET', ['${API_KEY}', 'process.env.SECRET'], { ...S, types: ['SECRET'] })
no('masked value', 'password: ********', ['********'], { ...S, types: ['SECRET'] })
no('prose token', 'The token is valid for one hour.', ['valid'], { ...S, types: ['SECRET'] })
no('date in code', 'const created = "2024-01-15T10:30:00Z" // 2024-01-15', ['2024-01-15T10'], { ...S, types: ['SECRET', 'PHONE', 'ID'] })
no('version in code', '"version": "4.3.2", "node": ">=22.12.0"', ['4.3.2', '22.12.0'], { ...S, types: ['SECRET', 'PHONE', 'IP'] })
no('base64 image', `<img src="data:image/png;base64,iVBORw0KGgo${rm(60)}">`, ['iVBORw0KGgo'], { ...S, types: ['SECRET'] })
no('css classes', 'class="flex items-center justify-between gap-2 rounded-lg bg-muted px-3"', ['items-center'], { ...S, types: ['SECRET'] })
no('word list', 'TheQuickBrownFoxJumpsOverTheLazyDog2024', ['TheQuickBrownFox'], { ...S, types: ['SECRET'] })
no('placeholder', 'API_KEY=<your-api-key-here>', ['<your-api-key-here>'], { ...S, types: ['SECRET'] })
no('bearer prose', 'Bearer tokens are sent in a header.', ['tokens'], { ...S, types: ['SECRET'] })

/* ---------------- run ---------------- */
let pass = 0
let fail = 0
const failures = []

function run(c) {
  const opts = c.opts ?? {}
  let spans = detectRules(c.text, { pii: true, secrets: Boolean(opts.secrets), hosts: Boolean(opts.hosts) })
  if (opts.types) spans = spans.filter((s) => opts.types.includes(s.type))
  const got = spans.map((s) => ({ type: s.type, value: c.text.slice(s.start, s.end), rule: s.rule }))
  const problems = []
  if (c.rule) {
    if (!got.some((g) => g.rule === c.rule)) problems.push(`rule ${c.rule} did not fire: ${JSON.stringify(got)}`)
  }
  for (const [type, value] of c.found) {
    const ok = got.some((g) => g.type === type && (value === '' || g.value.includes(value)))
    if (!ok) problems.push(`missing ${type} "${value}" got ${JSON.stringify(got)}`)
  }
  for (const value of c.none) {
    const hit = got.find((g) => g.value.includes(value) || value.includes(g.value) && g.value.length >= 4)
    if (hit) problems.push(`false positive ${hit.type}/${hit.rule} "${hit.value}"`)
  }
  return problems
}

for (const c of cases) {
  if (filter && !c.name.includes(filter)) continue
  const problems = run(c)
  if (problems.length === 0) {
    pass++
    if (verbose) console.log(`ok   ${c.name}`)
  } else {
    fail++
    failures.push(`FAIL ${c.name}\n     ${problems.join('\n     ')}`)
  }
}

/* ---------------- placeholders ---------------- */
function check(name, cond, detail = '') {
  if (filter && !name.includes(filter)) return
  if (cond) pass++
  else {
    fail++
    failures.push(`FAIL ${name} ${detail}`)
  }
}

{
  const text = 'Anna Berg met John Carter. Later Anna wrote to Carter and anna.berg@example.com.'
  const spans = mergeSpans(text, [
    { start: 0, end: 9, type: 'PERSON', source: 'model', score: 0.9 },
    { start: 14, end: 25, type: 'PERSON', source: 'model', score: 0.9 },
    { start: 33, end: 37, type: 'PERSON', source: 'model', score: 0.9 },
    { start: 47, end: 53, type: 'PERSON', source: 'model', score: 0.9 },
    ...detectRules(text, { secrets: false }),
  ])
  const numbered = applySpans(text, spans, 'numbered', new Replacer(null, 1)).output
  check('numbered consistent', numbered === '[NAME 1] met [NAME 2]. Later [NAME 1] wrote to [NAME 2] and [EMAIL 1].', numbered)
  const label = applySpans(text, spans, 'label', new Replacer(null, 1)).output
  check('label', label === '[NAME] met [NAME]. Later [NAME] wrote to [NAME] and [EMAIL].', label)
  const fake = new Replacer(faker, 7)
  const out = applySpans(text, spans, 'fake', fake).output
  const parts = out.split(/ met |\. Later | wrote to | and /)
  const [a, b, a2, b2] = parts
  check('fake first name kept', a.split(' ')[0] === a2, out)
  check('fake last name kept', b.split(' ')[1] === b2, out)
  check('fake differs', !out.includes('Anna') && !out.includes('Carter'), out)
  const kept = applySpans(text, spans, 'label', new Replacer(null, 1), new Set([0])).output
  check('keep one', kept.startsWith('Anna Berg met [NAME]'), kept)
  const card = new Replacer(faker, 3).fake('CARD', '4111 1111 1111 1111')
  check('fake card shape', /^\d{4} \d{4} \d{4} \d{4}$/.test(card) && card !== '4111 1111 1111 1111', card)
}
{
  const text = 'Project Falcon is secret. FALCON launches soon; falconry is unrelated.'
  const spans = findListed(text, ['Falcon'])
  check('always-hide count', spans.length === 2, JSON.stringify(spans))
}

/* ---------------- chat parsing ---------------- */
{
  const { parseChat } = await import(new URL('chat.ts', root).href)
  const { readFileSync } = await import('node:fs')
  const fx = (f) => readFileSync(new URL(`./fixtures/text/${f}`, import.meta.url), 'utf8')
  const expectChat = (file, format, senders, mentionMin) => {
    const text = fx(file)
    const r = parseChat(text)
    const names = [...r.senders.keys()].sort()
    check(`chat ${file} format`, r.format === format, `${r.format}`)
    check(`chat ${file} senders`, JSON.stringify(names) === JSON.stringify([...senders].sort()), JSON.stringify(names))
    const mentions = r.spans.filter((s) => s.rule === 'mention').length
    check(`chat ${file} mentions`, mentions >= mentionMin, `${mentions} mentions: ${r.spans.filter((s) => s.rule === 'mention').map((s) => text.slice(s.start, s.end)).join('|')}`)
  }
  expectChat('chat-whatsapp-android.txt', 'whatsapp', ['+44 7700 900123', 'Anna Berg', 'Marco Rossi'], 3)
  expectChat('chat-whatsapp-ios.txt', 'whatsapp', ['Anna Berg', 'Marco Rossi'], 2)
  expectChat('chat-telegram.json', 'telegram', ['Anna Berg', 'Marco Rossi'], 4)
  expectChat('chat-slack.json', 'slack', ['Anna Berg', 'Marco Rossi'], 3)
  expectChat('chat-discord.txt', 'discord', ['annab#4821', 'marco_r'], 0)
  expectChat('chat-teams.txt', 'teams', ['Anna Berg', 'Marco Rossi'], 1)
  const none = parseChat('Dear team,\nThe meeting is moved.\nRegards')
  check('chat none', none.format === 'none', none.format)
}

/* ---------------- column classification ---------------- */
{
  const { classifyColumn, maskValue, headerKind } = await import(new URL('columns.ts', root).href)
  const Papa = (await import('papaparse')).default
  const { readFileSync } = await import('node:fs')
  const csv = Papa.parse(readFileSync(new URL('./fixtures/text/customers.csv', import.meta.url), 'utf8'), { header: true, skipEmptyLines: true })
  const want = {
    customer_id: 'id', first_name: 'first-name', last_name: 'last-name', email: 'email', phone: 'phone', dob: 'birth-date',
    street: 'address', city: 'city', zip: 'postcode', country: 'country', card_number: 'card', signup_date: 'date',
    ip_address: 'ip', plan: 'category', amount: 'number', notes: 'free-text', password_hash: 'secret',
  }
  for (const [col, kind] of Object.entries(want)) {
    const got = classifyColumn(col, csv.data.slice(0, 200).map((r) => r[col]))
    check(`column ${col}`, got === kind, `${got} != ${kind}`)
  }
  // Values only, no telling header.
  const vals = (col) => csv.data.map((r) => r[col])
  check('column by values email', classifyColumn('field_3', vals('email')) === 'email')
  check('column by values card', classifyColumn('x', vals('card_number')) === 'card')
  check('column by values ip', classifyColumn('col7', vals('ip_address')) === 'ip')
  check('column by values phone', classifyColumn('col8', vals('phone')) === 'phone', classifyColumn('col8', vals('phone')))
  check('column header de', headerKind('Vorname') === 'first-name' && headerKind('Geburtsdatum') === 'birth-date' && headerKind('PLZ') === 'postcode')
  check('column header camel', headerKind('emailAddress') === 'email' && headerKind('userName') === 'username' && headerKind('productName') === null, `${headerKind('productName')}`)
  check('mask email', maskValue('email', 'jane.doe@example.com') === 'j***@e***.com', maskValue('email', 'jane.doe@example.com'))
  check('mask card', maskValue('card', '4111 1111 1111 1234') === '**** **** **** 1234', maskValue('card', '4111 1111 1111 1234'))
  check('mask dob', maskValue('birth-date', '1987-03-14') === '1987-**-**', maskValue('birth-date', '1987-03-14'))
  check('mask name', maskValue('full-name', 'Anna Berg') === 'A*** B***', maskValue('full-name', 'Anna Berg'))
}

/* ---------------- metadata strippers ---------------- */
{
  const { readFileSync, writeFileSync } = await import('node:fs')
  const exifr = (await import('exifr')).default
  const docs = new URL('../src/components/tools/redact/docs/', import.meta.url)
  const { stripJpeg, stripPng, stripWebp, webpBlocks } = await import(new URL('meta-image.ts', docs).href)
  const { stripHeif, stripVideo, readVideoMeta } = await import(new URL('meta-isobmff.ts', docs).href)
  const { stripPdf, readPdfMeta, stripOffice, readOfficeMeta } = await import(new URL('meta-docs.ts', docs).href)
  const fx = (f) => new Uint8Array(readFileSync(new URL(`./fixtures/text/meta/${f}`, import.meta.url)))
  const { join } = await import('node:path')
  const { tmpdir } = await import('node:os')
  const save = (f, b) => writeFileSync(join(tmpdir(), `otd-meta-out-${f}`), b)
  const opts = { keepIcc: true, keepOrientation: true }
  const parse = (b) => exifr.parse(b, { tiff: true, xmp: true, iptc: true, gps: true, mergeOutput: false }).catch(() => null)
  for (const [f, fn] of [['photo.jpg', stripJpeg], ['photo.png', stripPng]]) {
    const before = await parse(fx(f))
    const r = fn(fx(f), opts)
    save(f, r.bytes)
    const after = await parse(r.bytes)
    check(`meta ${f} had gps`, Boolean(before?.gps), JSON.stringify(before)?.slice(0, 80))
    const leftover = after ? Object.entries(after).filter(([k, v]) => v && Object.keys(v).some((x) => x !== 'Orientation' && !['ImageWidth', 'ImageHeight', 'BitDepth', 'ColorType', 'Compression', 'Filter', 'Interlace'].includes(x))) : []
    check(`meta ${f} clean`, leftover.length === 0, JSON.stringify(after))
    check(`meta ${f} orientation kept`, (await exifr.orientation(r.bytes)) === 6, String(await exifr.orientation(r.bytes)))
  }
  {
    const r = stripWebp(fx('photo.webp'), opts)
    save('photo.webp', r.bytes)
    const blocks = webpBlocks(r.bytes)
    check('meta webp clean', blocks.xmp === null && blocks.tiff && blocks.tiff.length === 26, JSON.stringify(r.removed))
  }
  {
    const r = stripHeif(fx('photo.heic'))
    save('photo.heic', r.bytes)
    const after = await parse(r.bytes)
    check('meta heic clean', !after?.gps && !after?.ifd0?.Make, JSON.stringify(after)?.slice(0, 200) + JSON.stringify(r.removed))
  }
  for (const f of ['clip.mp4', 'clip.mov']) {
    const before = readVideoMeta(fx(f))
    const r = stripVideo(fx(f))
    save(f, r.bytes)
    const after = readVideoMeta(r.bytes)
    check(`meta ${f} had location`, before.some((m) => /location|ISO6709/i.test(m.label)), JSON.stringify(before))
    check(`meta ${f} clean`, after.length === 0, JSON.stringify(after))
    check(`meta ${f} same size`, r.bytes.length === fx(f).length)
  }
  {
    const before = await readPdfMeta(new Uint8Array(readFileSync(new URL('./fixtures/text/bad-redaction.pdf', import.meta.url))))
    const out = await stripPdf(new Uint8Array(readFileSync(new URL('./fixtures/text/bad-redaction.pdf', import.meta.url))))
    save('bad-redaction.pdf', out)
    const after = await readPdfMeta(out)
    check('meta pdf had author', before.some((f) => f.label === 'Author'), JSON.stringify(before))
    check('meta pdf clean', after.length === 0, JSON.stringify(after))
  }
  for (const f of ['letter.docx', 'budget.xlsx', 'deck.pptx']) {
    let src
    try { src = fx(f) } catch { continue }
    const before = await readOfficeMeta(src)
    const out = await stripOffice(src)
    save(f, out)
    const after = await readOfficeMeta(out)
    const personal = (list) => list.filter((x) => /Author|Last saved|Company|Manager|Names on|Custom|Comments/.test(x.label))
    check(`meta ${f} had people`, personal(before).length > 0, JSON.stringify(before))
    check(`meta ${f} clean`, personal(after).length === 0, JSON.stringify(after))
  }
}

const providerRules = new Set(SECRET_RULES.map((rule) => rule.id))
check('60+ secret formats', providerRules.size >= 60, String(providerRules.size))

console.log(failures.join('\n'))
console.log(`\n${pass} passed, ${fail} failed, ${providerRules.size} secret rules`)
process.exit(fail ? 1 : 0)
