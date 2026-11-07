/** docker run command lines to a Compose file. */
import { shellWords } from './curl'

type Service = Record<string, unknown>

const FLAG_VALUE = new Set([
  '--name', '-p', '--publish', '-v', '--volume', '--mount', '-e', '--env', '--env-file', '--restart', '--network', '--net',
  '-w', '--workdir', '-u', '--user', '--entrypoint', '-h', '--hostname', '-l', '--label', '--cap-add', '--cap-drop', '--device',
  '--tmpfs', '--add-host', '--dns', '-m', '--memory', '--cpus', '--gpus', '--log-driver', '--log-opt', '--health-cmd',
  '--health-interval', '--health-timeout', '--health-retries', '--platform', '--pull', '--shm-size', '--ulimit', '--sysctl',
  '--expose', '--security-opt', '--stop-signal', '--network-alias', '--ip', '--pid', '--ipc', '--runtime', '--group-add',
  '--memory-reservation', '--cpu-shares', '--link', '--volumes-from', '--domainname', '--mac-address', '--init-path',
])
const LISTS: Record<string, string> = {
  '-p': 'ports', '--publish': 'ports', '-v': 'volumes', '--volume': 'volumes', '--mount': 'volumes', '-e': 'environment', '--env': 'environment',
  '--env-file': 'env_file', '-l': 'labels', '--label': 'labels', '--cap-add': 'cap_add', '--cap-drop': 'cap_drop', '--device': 'devices',
  '--tmpfs': 'tmpfs', '--add-host': 'extra_hosts', '--dns': 'dns', '--expose': 'expose', '--security-opt': 'security_opt',
  '--sysctl': 'sysctls', '--group-add': 'group_add', '--link': 'links', '--volumes-from': 'volumes_from',
}
const SCALARS: Record<string, string> = {
  '--name': 'container_name', '--restart': 'restart', '-w': 'working_dir', '--workdir': 'working_dir', '-u': 'user', '--user': 'user',
  '-h': 'hostname', '--hostname': 'hostname', '--platform': 'platform', '--shm-size': 'shm_size', '--stop-signal': 'stop_signal',
  '--pid': 'pid', '--ipc': 'ipc', '--runtime': 'runtime', '--domainname': 'domainname', '--mac-address': 'mac_address',
  '-m': 'mem_limit', '--memory': 'mem_limit', '--cpus': 'cpus', '--memory-reservation': 'mem_reservation', '--cpu-shares': 'cpu_shares',
  '--pull': 'pull_policy',
}

function push(s: Service, key: string, value: unknown) {
  const list = (s[key] as unknown[] | undefined) ?? []
  list.push(value)
  s[key] = list
}

/** Short --mount syntax: type=bind,source=/a,target=/b,readonly to "/a:/b:ro". Other mounts stay as long syntax. */
function mount(spec: string): unknown {
  const kv = Object.fromEntries(spec.split(',').map((p) => (p.includes('=') ? [p.slice(0, p.indexOf('=')), p.slice(p.indexOf('=') + 1)] : [p, 'true'])))
  const source = kv.source ?? kv.src
  const target = kv.target ?? kv.destination ?? kv.dst
  const ro = kv.readonly === 'true' || kv.ro === 'true'
  if ((kv.type === 'bind' || kv.type === 'volume' || !kv.type) && source && target) return `${source}:${target}${ro ? ':ro' : ''}`
  return { type: kv.type, ...(source ? { source } : {}), target, ...(ro ? { read_only: true } : {}) }
}

export function runToService(cmd: string): { name: string; service: Service; notes: string[] } {
  const words = shellWords(cmd)
  let i = 0
  if (words[i] === 'sudo') i++
  if (words[i] === 'docker') i++
  if (words[i] === 'container') i++
  if (words[i] !== 'run' && words[i] !== 'create') throw new Error('Each command must be docker run (or docker create).')
  i++
  const s: Service = {}
  const notes: string[] = []
  const health: Record<string, string> = {}
  const logging: { driver?: string; options?: Record<string, string> } = {}
  let image = ''
  for (; i < words.length; i++) {
    let w = words[i]
    let v: string | undefined
    const eq = /^(--[a-z-]+)=(.*)$/s.exec(w)
    if (eq) [w, v] = [eq[1], eq[2]]
    else if (/^-[pvewuhlm].+/.test(w) && FLAG_VALUE.has(w.slice(0, 2))) [w, v] = [w.slice(0, 2), w.slice(2)]
    if (!w.startsWith('-')) {
      image = w
      break
    }
    if (FLAG_VALUE.has(w) && v === undefined) v = words[++i]
    const val = v ?? ''
    if (LISTS[w]) push(s, LISTS[w], w === '--mount' ? mount(val) : val)
    else if (SCALARS[w]) s[SCALARS[w]] = /^\d+(\.\d+)?$/.test(val) && (w === '--cpus' || w === '--cpu-shares') ? Number(val) : val
    else if (w === '--network' || w === '--net') {
      if (['host', 'none', 'bridge'].includes(val) || val.startsWith('container:')) s.network_mode = val
      else push(s, 'networks', val)
    } else if (w === '--entrypoint') s.entrypoint = val
    else if (w === '--gpus') s.deploy = { resources: { reservations: { devices: [{ count: val === 'all' ? 'all' : Number(val.replace(/\D/g, '')) || 1, capabilities: ['gpu'] }] } } }
    else if (w === '--log-driver') logging.driver = val
    else if (w === '--log-opt') logging.options = { ...logging.options, [val.split('=')[0]]: val.split('=').slice(1).join('=') }
    else if (w.startsWith('--health-')) health[w.slice(9)] = val
    else if (w === '--ulimit') {
      const [k, lim] = val.split('=')
      const [soft, hard] = (lim ?? '').split(':').map(Number)
      s.ulimits = { ...(s.ulimits as object), [k]: hard ? { soft, hard } : soft }
    } else if (w === '--privileged') s.privileged = true
    else if (w === '--init') s.init = true
    else if (w === '--read-only') s.read_only = true
    else if (w === '-i' || w === '--interactive') s.stdin_open = true
    else if (w === '-t' || w === '--tty') s.tty = true
    else if (/^-[dit]+$/.test(w)) {
      if (w.includes('i')) s.stdin_open = true
      if (w.includes('t')) s.tty = true
    } else if (w === '--rm') notes.push('--rm has no Compose equivalent; docker compose down removes containers.')
    else if (w === '-d' || w === '--detach') continue
    else if (w === '-P' || w === '--publish-all') notes.push('--publish-all has no Compose equivalent; list the ports.')
    else if (w === '--network-alias') notes.push(`--network-alias ${val}: add it under networks.<name>.aliases.`)
    else if (w === '--ip') notes.push(`--ip ${val}: add it under networks.<name>.ipv4_address.`)
    else notes.push(`${w} is not converted.`)
  }
  if (!image) throw new Error('No image found after the options.')
  s.image = image
  const command = words.slice(i + 1)
  if (command.length) s.command = command
  if (Object.keys(health).length) {
    s.healthcheck = {
      ...(health.cmd ? { test: ['CMD-SHELL', health.cmd] } : {}),
      ...(health.interval ? { interval: health.interval } : {}),
      ...(health.timeout ? { timeout: health.timeout } : {}),
      ...(health.retries ? { retries: Number(health.retries) } : {}),
    }
  }
  if (logging.driver || logging.options) s.logging = logging
  const name = String(s.container_name ?? image.split('/').pop()?.split(':')[0] ?? 'app').replace(/[^a-zA-Z0-9_.-]/g, '-')
  // Keep the usual order: image first.
  const ordered: Service = { image, ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'image')) }
  return { name, service: ordered, notes }
}

/** Splits text into docker commands: one per line, joining lines that end with a backslash. */
export function splitCommands(text: string): string[] {
  return text
    .replace(/\\\r?\n/g, ' ')
    .split(/\r?\n|&&|;/)
    .map((l) => l.trim())
    .filter((l) => /^(sudo\s+)?docker\s/.test(l))
}

export async function composeYaml(text: string): Promise<{ yaml: string; services: number; notes: string[] }> {
  const commands = splitCommands(text)
  if (commands.length === 0) throw new Error('No docker run command found.')
  const services: Record<string, Service> = {}
  const networks = new Set<string>()
  const named = new Set<string>()
  const notes: string[] = []
  for (const c of commands) {
    const r = runToService(c)
    let name = r.name
    for (let n = 2; services[name]; n++) name = `${r.name}-${n}`
    services[name] = r.service
    notes.push(...r.notes)
    for (const n of (r.service.networks as string[] | undefined) ?? []) networks.add(n)
    for (const v of (r.service.volumes as unknown[] | undefined) ?? []) {
      const src = typeof v === 'string' ? v.split(':')[0] : ''
      if (src && !/^[./~$]/.test(src) && v !== src) named.add(src)
    }
  }
  const doc: Record<string, unknown> = { services }
  if (networks.size) doc.networks = Object.fromEntries([...networks].map((n) => [n, { external: true }]))
  if (named.size) doc.volumes = Object.fromEntries([...named].map((n) => [n, {}]))
  const { stringify } = await import('yaml')
  return { yaml: stringify(doc, { lineWidth: 0 }).replace(/: \{\}$/gm, ':'), services: commands.length, notes: [...new Set(notes)] }
}
