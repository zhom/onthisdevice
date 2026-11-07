/** Content-Security-Policy: parse a policy and rate its weak points. */

export type Severity = 'High' | 'Medium' | 'Low' | 'Info'

export interface Finding {
  severity: Severity
  directive: string
  text: string
}

export function parseCsp(input: string): Map<string, string[]> {
  const policy = input
    .trim()
    .replace(/^content-security-policy(-report-only)?\s*:\s*/i, '')
    .replace(/^<meta[^>]*content=["']([^"']*)["'][^>]*>$/i, '$1')
  const out = new Map<string, string[]>()
  for (const part of policy.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/)
    if (!name) continue
    const key = name.toLowerCase()
    // A repeated directive is ignored by browsers; only the first counts.
    if (!out.has(key)) out.set(key, values)
  }
  return out
}

const FETCH_FALLBACK = (csp: Map<string, string[]>, name: string) => csp.get(name) ?? csp.get('default-src')

export function evaluateCsp(csp: Map<string, string[]>): Finding[] {
  const f: Finding[] = []
  const add = (severity: Severity, directive: string, text: string) => f.push({ severity, directive, text })
  const script = csp.get('script-src-elem') ?? csp.get('script-src') ?? csp.get('default-src')
  const scriptName = csp.has('script-src') ? 'script-src' : 'default-src'
  if (!script) add('High', 'script-src', 'No script-src or default-src: scripts from any origin can run.')
  else {
    const has = (v: string) => script.some((x) => x.toLowerCase() === v)
    const nonceOrHash = script.some((x) => /^'(nonce|sha256|sha384|sha512)-/i.test(x))
    const strict = has("'strict-dynamic'")
    if (has("'unsafe-inline'") && !nonceOrHash) add('High', scriptName, "'unsafe-inline' lets any inline script run, so an injected <script> works. Use nonces or hashes.")
    if (has("'unsafe-inline'") && nonceOrHash) add('Info', scriptName, "'unsafe-inline' is ignored by modern browsers because a nonce or hash is present. It only helps old browsers.")
    if (has("'unsafe-eval'")) add('Medium', scriptName, "'unsafe-eval' allows eval() and new Function(), which turn strings into code.")
    if (script.some((x) => x === '*')) add('High', scriptName, '* allows scripts from any host.')
    if (script.some((x) => /^(https?:|data:|blob:)$/i.test(x))) add('High', scriptName, `${script.filter((x) => /^(https?:|data:|blob:)$/i.test(x)).join(' ')} allows scripts from any host with that scheme.`)
    const wild = script.filter((x) => /^(https?:\/\/)?\*\./.test(x))
    if (wild.length && !strict) add('Medium', scriptName, `Wildcard hosts (${wild.join(', ')}) allow every subdomain, including ones that host user content.`)
    if (strict) add('Info', scriptName, "'strict-dynamic' trusts scripts loaded by a nonced or hashed script and ignores host lists in browsers that support it.")
    if (has("'wasm-unsafe-eval'")) add('Low', scriptName, "'wasm-unsafe-eval' allows compiling WebAssembly. It is needed for WebAssembly and narrower than 'unsafe-eval'.")
  }
  const obj = FETCH_FALLBACK(csp, 'object-src')
  if (!obj || !(obj.length === 1 && obj[0] === "'none'")) add('Medium', 'object-src', "object-src is not 'none', so plugins can load. Set object-src 'none'.")
  if (!csp.has('base-uri')) add('Medium', 'base-uri', "No base-uri: an injected <base> tag can redirect relative script URLs. Set base-uri 'self' or 'none'.")
  if (!csp.has('frame-ancestors')) add('Low', 'frame-ancestors', 'No frame-ancestors: other sites can frame this page (clickjacking) unless X-Frame-Options blocks it.')
  if (!csp.has('form-action')) add('Low', 'form-action', 'No form-action: an injected form can send data to any host.')
  const style = FETCH_FALLBACK(csp, 'style-src')
  if (style?.includes("'unsafe-inline'")) add('Low', 'style-src', "'unsafe-inline' in style-src allows injected styles, which can leak data through CSS selectors.")
  if (!csp.has('default-src')) add('Low', 'default-src', 'No default-src: fetch directives that are not set allow every source.')
  if (csp.has('report-uri') && !csp.has('report-to')) add('Info', 'report-uri', 'report-uri is deprecated. Add report-to as well; browsers that support it use it instead.')
  if (!csp.has('upgrade-insecure-requests') && !csp.has('block-all-mixed-content')) add('Info', 'upgrade-insecure-requests', 'upgrade-insecure-requests would load http: resources over https.')
  const known = new Set(['default-src', 'script-src', 'script-src-elem', 'script-src-attr', 'style-src', 'style-src-elem', 'style-src-attr', 'img-src', 'font-src', 'connect-src', 'media-src', 'object-src', 'frame-src', 'child-src', 'worker-src', 'manifest-src', 'base-uri', 'form-action', 'frame-ancestors', 'upgrade-insecure-requests', 'block-all-mixed-content', 'report-uri', 'report-to', 'sandbox', 'require-trusted-types-for', 'trusted-types', 'fenced-frame-src', 'webrtc'])
  for (const k of csp.keys()) if (!known.has(k)) add('Medium', k, `${k} is not a CSP directive. Check the spelling; browsers ignore it.`)
  const order: Severity[] = ['High', 'Medium', 'Low', 'Info']
  return f.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity))
}
