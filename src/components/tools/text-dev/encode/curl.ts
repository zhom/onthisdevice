/** curl command lines to request code in JavaScript, Python, Go and PHP. */

/** POSIX-style word splitting: single and double quotes, $'...' strings, backslashes and line continuations. */
export function shellWords(cmd: string): string[] {
  const s = cmd.replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ')
  const out: string[] = []
  let cur = ''
  let has = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (/\s/.test(c)) {
      if (has) out.push(cur)
      cur = ''
      has = false
    } else if (c === "'") {
      const end = s.indexOf("'", i + 1)
      if (end < 0) throw new Error('A single quote is not closed.')
      cur += s.slice(i + 1, end)
      i = end
      has = true
    } else if (c === '$' && s[i + 1] === "'") {
      let j = i + 2
      for (; j < s.length && s[j] !== "'"; j++) {
        if (s[j] === '\\') {
          const n = s[++j]
          cur += ({ n: '\n', t: '\t', r: '\r', "'": "'", '\\': '\\' } as Record<string, string>)[n] ?? n
        } else cur += s[j]
      }
      i = j
      has = true
    } else if (c === '"') {
      let j = i + 1
      for (; j < s.length && s[j] !== '"'; j++) {
        if (s[j] === '\\' && /["\\$`]/.test(s[j + 1] ?? '')) j++
        cur += s[j]
      }
      if (j >= s.length) throw new Error('A double quote is not closed.')
      i = j
      has = true
    } else if (c === '\\' && i + 1 < s.length) {
      cur += s[++i]
      has = true
    } else {
      cur += c
      has = true
    }
  }
  if (has) out.push(cur)
  return out
}

export interface Request {
  method: string
  url: string
  headers: [string, string][]
  body: string | null
  form: [string, string][]
  user: string | null
  insecure: boolean
  follow: boolean
  json: boolean
}

const WITH_VALUE = new Set(['-X', '--request', '-H', '--header', '-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode', '--json', '-u', '--user', '-F', '--form', '--form-string', '-b', '--cookie', '-A', '--user-agent', '-e', '--referer', '-o', '--output', '-m', '--max-time', '--connect-timeout', '-x', '--proxy', '--url', '-w', '--write-out', '--retry', '-T', '--upload-file', '--cert', '--key', '--cacert', '-c', '--cookie-jar', '-r', '--range', '-z', '--time-cond'])

export function parseCurl(cmd: string): Request {
  const words = shellWords(cmd.trim())
  if (words[0] !== 'curl') throw new Error('The command must start with curl.')
  const r: Request = { method: '', url: '', headers: [], body: null, form: [], user: null, insecure: false, follow: false, json: false }
  const data: string[] = []
  let get = false
  let head = false
  for (let i = 1; i < words.length; i++) {
    let w = words[i]
    let v: string | undefined
    // --flag=value and -Xvalue forms.
    const eq = /^(--[a-z-]+)=(.*)$/s.exec(w)
    if (eq && WITH_VALUE.has(eq[1])) [w, v] = [eq[1], eq[2]]
    else if (/^-[A-Za-z]./.test(w) && !w.startsWith('--') && WITH_VALUE.has(w.slice(0, 2))) [w, v] = [w.slice(0, 2), w.slice(2)]
    if (WITH_VALUE.has(w) && v === undefined) {
      v = words[++i]
      if (v === undefined) throw new Error(`${w} needs a value.`)
    }
    switch (w) {
      case '-X':
      case '--request':
        r.method = (v ?? '').toUpperCase()
        break
      case '-H':
      case '--header': {
        const k = (v ?? '').indexOf(':')
        if (k > 0) r.headers.push([(v ?? '').slice(0, k).trim(), (v ?? '').slice(k + 1).trim()])
        break
      }
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-binary':
      case '--data-ascii':
        data.push(w === '--data-binary' ? (v ?? '') : (v ?? '').replace(/[\r\n]/g, ''))
        break
      case '--data-urlencode': {
        const s = v ?? ''
        const k = s.indexOf('=')
        data.push(k >= 0 ? `${s.slice(0, k + 1)}${encodeURIComponent(s.slice(k + 1))}` : encodeURIComponent(s))
        break
      }
      case '--json':
        data.push(v ?? '')
        r.json = true
        break
      case '-F':
      case '--form':
      case '--form-string': {
        const s = v ?? ''
        const k = s.indexOf('=')
        r.form.push([s.slice(0, k), s.slice(k + 1)])
        break
      }
      case '-u':
      case '--user':
        r.user = v ?? ''
        break
      case '-b':
      case '--cookie':
        r.headers.push(['Cookie', v ?? ''])
        break
      case '-A':
      case '--user-agent':
        r.headers.push(['User-Agent', v ?? ''])
        break
      case '-e':
      case '--referer':
        r.headers.push(['Referer', v ?? ''])
        break
      case '--url':
        r.url = v ?? ''
        break
      case '-G':
      case '--get':
        get = true
        break
      case '-I':
      case '--head':
        head = true
        break
      case '-k':
      case '--insecure':
        r.insecure = true
        break
      case '-L':
      case '--location':
        r.follow = true
        break
      default:
        if (!w.startsWith('-') && !r.url) r.url = w
    }
  }
  if (!r.url) throw new Error('No URL found in the command.')
  if (!/^[a-z]+:\/\//i.test(r.url)) r.url = `http://${r.url}`
  if (data.length) {
    if (get) r.url += (r.url.includes('?') ? '&' : '?') + data.join('&')
    else r.body = data.join('&')
  }
  if (r.json) {
    if (!r.headers.some(([k]) => /^content-type$/i.test(k))) r.headers.push(['Content-Type', 'application/json'])
    if (!r.headers.some(([k]) => /^accept$/i.test(k))) r.headers.push(['Accept', 'application/json'])
  }
  if (r.body !== null && !r.headers.some(([k]) => /^content-type$/i.test(k))) r.headers.push(['Content-Type', 'application/x-www-form-urlencoded'])
  r.method ||= head ? 'HEAD' : r.body !== null || r.form.length ? 'POST' : 'GET'
  return r
}

const q = (s: string) => JSON.stringify(s)
const pyStr = (s: string) => (s.includes('\n') ? `"""${s.replace(/\\/g, '\\\\').replace(/"""/g, '\\"""')}"""` : `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
const isJson = (r: Request) => r.headers.some(([k, v]) => /^content-type$/i.test(k) && /json/i.test(v))
const parsedJson = (s: string): unknown => {
  try {
    return JSON.parse(s) as unknown
  } catch {
    return undefined
  }
}
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)))

export function toFetch(r: Request): string {
  const headers = [...r.headers]
  if (r.user !== null) headers.push(['Authorization', `Basic ${b64(r.user)}`])
  const lines: string[] = []
  if (r.form.length) {
    lines.push('const form = new FormData()')
    for (const [k, v] of r.form) lines.push(v.startsWith('@') ? `form.append(${q(k)}, fileInput.files[0]) // ${v.slice(1)}` : `form.append(${q(k)}, ${q(v)})`)
    lines.push('')
  }
  const opts: string[] = [`  method: ${q(r.method)},`]
  const hs = headers.filter(([k]) => !(r.form.length && /^content-type$/i.test(k)))
  if (hs.length) opts.push(`  headers: {\n${hs.map(([k, v]) => `    ${q(k)}: ${q(v)},`).join('\n')}\n  },`)
  if (r.form.length) opts.push('  body: form,')
  else if (r.body !== null) {
    const j = isJson(r) ? parsedJson(r.body) : undefined
    opts.push(j !== undefined ? `  body: JSON.stringify(${JSON.stringify(j, null, 2).replace(/\n/g, '\n  ')}),` : `  body: ${q(r.body)},`)
  }
  if (!r.follow) opts.push("  redirect: 'manual',")
  lines.push(`const response = await fetch(${q(r.url)}, {\n${opts.join('\n')}\n})`)
  lines.push(r.method === 'HEAD' ? 'console.log(response.status, [...response.headers])' : `const data = await response.${isJsonAccept(r) ? 'json' : 'text'}()\nconsole.log(response.status, data)`)
  return lines.join('\n')
}

const isJsonAccept = (r: Request) => r.json || r.headers.some(([k, v]) => /^accept$/i.test(k) && /json/i.test(v))

export function toPython(r: Request): string {
  const lines = ['import requests', '']
  const args = [`    ${pyStr(r.url)},`]
  const hs = r.headers.filter(([k]) => !(r.form.length && /^content-type$/i.test(k)))
  if (hs.length) {
    lines.push(`headers = {\n${hs.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`).join('\n')}\n}`)
    args.push('    headers=headers,')
  }
  if (r.form.length) {
    const files = r.form.filter(([, v]) => v.startsWith('@'))
    const fields = r.form.filter(([, v]) => !v.startsWith('@'))
    if (fields.length) {
      lines.push(`data = {\n${fields.map(([k, v]) => `    ${pyStr(k)}: ${pyStr(v)},`).join('\n')}\n}`)
      args.push('    data=data,')
    }
    if (files.length) {
      lines.push(`files = {\n${files.map(([k, v]) => `    ${pyStr(k)}: open(${pyStr(v.slice(1))}, 'rb'),`).join('\n')}\n}`)
      args.push('    files=files,')
    }
  } else if (r.body !== null) {
    const j = isJson(r) ? parsedJson(r.body) : undefined
    if (j !== undefined) {
      lines.push(`json_data = ${JSON.stringify(j, null, 4).replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`)
      args.push('    json=json_data,')
    } else {
      lines.push(`data = ${pyStr(r.body)}`)
      args.push('    data=data,')
    }
  }
  if (r.user !== null) {
    const [u, ...p] = r.user.split(':')
    args.push(`    auth=(${pyStr(u)}, ${pyStr(p.join(':'))}),`)
  }
  if (r.insecure) args.push('    verify=False,')
  if (!r.follow) args.push('    allow_redirects=False,')
  if (lines.at(-1) !== '') lines.push('')
  lines.push(`response = requests.request(\n    ${pyStr(r.method)},\n${args.join('\n')}\n)`)
  lines.push(r.method === 'HEAD' ? 'print(response.status_code, response.headers)' : 'print(response.status_code, response.text)')
  return lines.join('\n')
}

export function toGo(r: Request): string {
  const goStr = (s: string) => (s.includes('`') || !s.includes('\n') ? q(s) : `\`${s}\``)
  const body = r.body !== null ? `strings.NewReader(${goStr(r.body)})` : 'nil'
  const imports = ['"fmt"', '"io"', '"net/http"', ...(r.body !== null ? ['"strings"'] : []), ...(r.insecure ? ['"crypto/tls"'] : [])].sort()
  const lines = [
    'package main',
    '',
    `import (\n${imports.map((i) => `\t${i}`).join('\n')}\n)`,
    '',
    'func main() {',
    r.insecure
      ? '\tclient := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}}'
      : '\tclient := &http.Client{}',
  ]
  if (!r.follow) lines.push('\tclient.CheckRedirect = func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }')
  lines.push(`\treq, err := http.NewRequest(${q(r.method)}, ${q(r.url)}, ${body})`, '\tif err != nil {', '\t\tpanic(err)', '\t}')
  for (const [k, v] of r.headers) lines.push(`\treq.Header.Set(${q(k)}, ${q(v)})`)
  if (r.user !== null) {
    const [u, ...p] = r.user.split(':')
    lines.push(`\treq.SetBasicAuth(${q(u)}, ${q(p.join(':'))})`)
  }
  if (r.form.length) lines.push('\t// Multipart form fields: build the body with mime/multipart.Writer.')
  lines.push('\tresp, err := client.Do(req)', '\tif err != nil {', '\t\tpanic(err)', '\t}', '\tdefer resp.Body.Close()', '\tdata, _ := io.ReadAll(resp.Body)', '\tfmt.Println(resp.StatusCode, string(data))', '}')
  return lines.join('\n')
}

export function toPhp(r: Request): string {
  const phpStr = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  const lines = ['<?php', '', `$ch = curl_init(${phpStr(r.url)});`, 'curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);']
  if (r.method !== 'GET') lines.push(`curl_setopt($ch, CURLOPT_CUSTOMREQUEST, ${phpStr(r.method)});`)
  if (r.headers.length) lines.push(`curl_setopt($ch, CURLOPT_HTTPHEADER, [\n${r.headers.map(([k, v]) => `    ${phpStr(`${k}: ${v}`)},`).join('\n')}\n]);`)
  if (r.form.length) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, [\n${r.form.map(([k, v]) => `    ${phpStr(k)} => ${v.startsWith('@') ? `new CURLFile(${phpStr(v.slice(1))})` : phpStr(v)},`).join('\n')}\n]);`)
  else if (r.body !== null) lines.push(`curl_setopt($ch, CURLOPT_POSTFIELDS, ${phpStr(r.body)});`)
  if (r.user !== null) lines.push(`curl_setopt($ch, CURLOPT_USERPWD, ${phpStr(r.user)});`)
  if (r.follow) lines.push('curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);')
  if (r.insecure) lines.push('curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);')
  lines.push('', '$response = curl_exec($ch);', '$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);', 'curl_close($ch);', '', 'echo $status, "\\n", $response;')
  return lines.join('\n')
}
