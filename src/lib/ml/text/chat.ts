/**
 * Finds the people in a chat export: the sender of each message from the line
 * format (or the JSON fields), and later mentions of those names in the
 * messages. The spans have source "chat" so they win over other detectors and
 * every person keeps one replacement.
 */
import type { EntityType, Span } from './types'

export type ChatFormat =
  | 'whatsapp'
  | 'telegram'
  | 'slack'
  | 'discord'
  | 'teams'
  | 'signal'
  | 'generic'
  | 'none'

export const CHAT_FORMAT_NAMES: Record<ChatFormat, string> = {
  whatsapp: 'WhatsApp export',
  telegram: 'Telegram export',
  slack: 'Slack export',
  discord: 'Discord export',
  teams: 'Teams chat',
  signal: 'Signal or iMessage export',
  generic: 'Chat with "Name: message" lines',
  none: 'No chat format found',
}

export interface ChatParse {
  format: ChatFormat
  /** Sender name to number of messages. */
  senders: Map<string, number>
  spans: Span[]
  messages: number
}

interface LineRule {
  format: ChatFormat
  re: RegExp
}

const D = '\\d{1,4}[./-]\\d{1,2}[./-]\\d{1,4}'
const T = '\\d{1,2}[:.]\\d{2}(?:[:.]\\d{2})?(?:[\\s\\u202f]?[AaPp]\\.?[Mm]\\.?)?'
const NAME = "([^\\n:\\[\\]]{1,60}?)"

/** Line formats, tried in order; group 1 is the sender. */
const LINE_RULES: LineRule[] = [
  // [12/03/2025, 09:14:02] Anna Berg: hi        (WhatsApp on iPhone)
  { format: 'whatsapp', re: new RegExp(`^[\\u200e\\u200f]?\\[${D},\\s${T}\\]\\s${NAME}:\\s`, 'gm') },
  // 12/03/2025, 09:14 - Anna Berg: hi           (WhatsApp on Android)
  { format: 'whatsapp', re: new RegExp(`^[\\u200e\\u200f]?${D},\\s${T}\\s[-–]\\s${NAME}:\\s`, 'gm') },
  // [12-Mar-25 09:14 AM] anna#1234               (Discord text export, message on the next line)
  { format: 'discord', re: new RegExp(`^\\[\\d{1,2}-[A-Za-z]{3}-\\d{2,4}\\s${T}\\]\\s([^\\n]{1,60}?)\\s*$`, 'gm') },
  // Anna — Today at 9:14 AM / Anna — 03/12/2025 9:14 AM   (Discord copy)
  { format: 'discord', re: new RegExp(`^([^\\n—]{1,60}?)\\s—\\s(?:Today at|Yesterday at|${D})\\s?${T}?\\s*$`, 'gm') },
  // Anna Berg, [12.03.2025 09:14]                (Telegram copy)
  { format: 'telegram', re: new RegExp(`^${NAME},\\s\\[${D}\\s${T}\\]\\s*$`, 'gm') },
  // [12/03/2025 9:14 AM] Anna Berg: hi           (Teams copy)
  { format: 'teams', re: new RegExp(`^\\[${D}\\s${T}\\]\\s${NAME}:\\s`, 'gm') },
  // Anna Berg  9:14 AM                           (Slack or Teams copy, message on the next line)
  { format: 'slack', re: new RegExp(`^([A-Z][^\\n:]{0,40}?)\\s{1,3}${T}\\s*$`, 'gm') },
  // 2025-03-12 09:14:02 Anna Berg: hi            (Signal, iMessage and other exports)
  { format: 'signal', re: new RegExp(`^\\[?\\d{4}-\\d{2}-\\d{2}[ T]${T}\\]?\\s(?:[-–]\\s)?${NAME}:\\s`, 'gm') },
  // Anna: hi                                     (plain transcripts)
  { format: 'generic', re: /^([A-Z][\p{L}'’.-]*(?:\s[A-Z][\p{L}'’.-]*){0,3}|\+?[\d ()-]{7,20}|[\p{L}\d_.-]{2,30}):\s/gmu },
]

const PHONE_NAME = /^\+?[\d\s()\-‪‬]{7,22}$/
const SYSTEM_SENDERS = /^(?:system|you|me|bot|messages and calls are end-to-end encrypted.*)$/i

function typeOfSender(name: string): EntityType {
  if (PHONE_NAME.test(name)) return 'PHONE'
  if (/^@|#\d{4}$/.test(name) || /^[a-z0-9_.]+$/.test(name)) return 'USERNAME'
  return 'PERSON'
}

function chatSpan(start: number, end: number, type: EntityType, rule: string): Span {
  return { start, end, type, source: 'chat', score: 1, rule, label: rule === 'sender' ? 'Sender' : 'Mention' }
}

/** JSON exports: Telegram (messages[].from), Slack (user_profile, user_name), Discord (author.name). */
function parseJson(text: string): ChatParse | null {
  const trimmed = text.trimStart()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return null
  }
  const senders = new Map<string, number>()
  const aliases = new Set<string>()
  let format: ChatFormat = 'none'
  let messages = 0
  const add = (name: unknown) => {
    if (typeof name === 'string' && name.trim()) senders.set(name.trim(), (senders.get(name.trim()) ?? 0) + 1)
  }
  const list = Array.isArray(data) ? data : (data as { messages?: unknown }).messages
  if (!Array.isArray(list)) return null
  for (const m of list as Record<string, unknown>[]) {
    if (!m || typeof m !== 'object') continue
    messages++
    if ('from' in m || 'actor' in m) {
      format = 'telegram'
      add(m.from ?? m.actor)
    } else if ('user_profile' in m || 'user_name' in m) {
      format = 'slack'
      const p = (m.user_profile ?? {}) as Record<string, unknown>
      add(p.real_name || p.display_name || p.name || m.user_name)
      for (const alias of [p.display_name, p.name, m.user_name]) if (typeof alias === 'string' && alias.trim()) aliases.add(alias.trim())
    } else if ('author' in m && typeof m.author === 'object' && m.author) {
      format = 'discord'
      const a = m.author as Record<string, unknown>
      add(a.nickname || a.name)
      if (typeof a.name === 'string' && a.name.trim()) aliases.add(a.name.trim())
    }
  }
  if (format === 'none') return null
  const spans: Span[] = []
  // Every quoted occurrence of a sender name or alias in the JSON text.
  for (const name of new Set([...senders.keys(), ...aliases])) {
    const quoted = JSON.stringify(name)
    let at = text.indexOf(quoted)
    while (at >= 0) {
      spans.push(chatSpan(at + 1, at + quoted.length - 1, typeOfSender(name), 'sender'))
      at = text.indexOf(quoted, at + quoted.length)
    }
  }
  // Slack user IDs in mentions and fields: <@U0123ABCD>, "user": "U0123ABCD".
  if (format === 'slack') {
    for (const m of text.matchAll(/(?<=<@|"user":\s*"|"user_id":\s*")[UW][A-Z0-9]{6,12}(?=[>"|])/g)) {
      spans.push(chatSpan(m.index, m.index + m[0].length, 'USERNAME', 'mention'))
    }
  }
  if (format === 'telegram') {
    for (const m of text.matchAll(/(?<="(?:from_id|actor_id)":\s*")user\d+(?=")/g)) {
      spans.push(chatSpan(m.index, m.index + m[0].length, 'USERNAME', 'mention'))
    }
  }
  return { format, senders, spans, messages }
}

/** Mentions of the senders inside messages: full names, first names and last names. */
function mentions(text: string, senders: string[], taken: Span[]): Span[] {
  const terms = new Set<string>()
  for (const s of senders) {
    if (typeOfSender(s) !== 'PERSON') continue
    terms.add(s)
    for (const part of s.split(/\s+/)) if (part.length >= 3 && /^\p{Lu}/u.test(part)) terms.add(part)
  }
  const out: Span[] = []
  const sorted = [...terms].sort((a, b) => b.length - a.length)
  const covered = (a: number, b: number) => [...taken, ...out].some((s) => s.start < b && a < s.end)
  for (const term of sorted) {
    const re = new RegExp(`(?<![\\p{L}\\p{N}_@])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}_])`, 'gu')
    for (const m of text.matchAll(re)) {
      if (!covered(m.index, m.index + m[0].length)) out.push(chatSpan(m.index, m.index + m[0].length, 'PERSON', 'mention'))
    }
  }
  return out
}

/** Finds the chat format, the senders and the spans of their names. */
export function parseChat(text: string): ChatParse {
  const json = parseJson(text)
  if (json) {
    json.spans.push(...mentions(text, [...json.senders.keys()], json.spans))
    return json
  }
  let best: { rule: LineRule; hits: RegExpMatchArray[] } | null = null
  for (const rule of LINE_RULES) {
    const hits = [...text.matchAll(rule.re)].filter((m) => {
      const name = m[1]?.trim()
      return name && !SYSTEM_SENDERS.test(name) && !/https?:|www\./.test(name)
    })
    const distinct = new Set(hits.map((h) => h[1].trim())).size
    // Plain "Name:" lines count only when the names repeat, as they do in a conversation.
    if (rule.format === 'generic' && (hits.length < 3 || distinct > hits.length / 2 + 1)) continue
    if (hits.length >= 2 && (!best || hits.length > best.hits.length)) best = { rule, hits }
  }
  if (!best) return { format: 'none', senders: new Map(), spans: [], messages: 0 }
  const senders = new Map<string, number>()
  const spans: Span[] = []
  for (const h of best.hits) {
    const raw = h[1]
    const name = raw.trim()
    senders.set(name, (senders.get(name) ?? 0) + 1)
    const at = (h.index ?? 0) + h[0].indexOf(raw) + raw.indexOf(name)
    spans.push(chatSpan(at, at + name.length, typeOfSender(name), 'sender'))
  }
  spans.push(...mentions(text, [...senders.keys()], spans))
  return { format: best.rule.format, senders, spans, messages: best.hits.length }
}
