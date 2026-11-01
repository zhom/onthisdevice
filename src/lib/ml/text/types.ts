/**
 * Shared types for text redaction: what a detector returns and how the tools
 * group the results for the user.
 */

/** Every kind of item a detector can report. */
export type EntityType =
  | 'PERSON'
  | 'ORG'
  | 'LOCATION'
  | 'ADDRESS'
  | 'POSTCODE'
  | 'EMAIL'
  | 'PHONE'
  | 'CARD'
  | 'IBAN'
  | 'ID'
  | 'DOB'
  | 'DATE'
  | 'IP'
  | 'MAC'
  | 'URL'
  | 'USERNAME'
  | 'SECRET'
  | 'PRODUCT'

/** Where a span came from. `list` is the user's always-hide list. */
export type SpanSource = 'rule' | 'model' | 'list' | 'chat'

/** A detected item: a half-open range [start, end) of UTF-16 offsets into the text. */
export interface Span {
  start: number
  end: number
  type: EntityType
  source: SpanSource
  /** 0..1. Rules with a checksum report 1. */
  score: number
  /** Rule id, for example `aws-access-key` or `iban`. */
  rule?: string
  /** Short human name of what was found, for example "AWS access key". */
  label?: string
}

export interface TypeInfo {
  type: EntityType
  /** Placeholder word, used as [NAME] or [NAME 1]. */
  tag: string
  /** Plural name for the type picker. */
  name: string
  /** Singular, lower case, for counts. */
  one: string
  /** On when the tool opens. */
  defaultOn: boolean
}

/** The order here is the order of the type picker. */
export const TYPE_INFO: readonly TypeInfo[] = [
  { type: 'PERSON', tag: 'NAME', name: 'Names', one: 'name', defaultOn: true },
  { type: 'EMAIL', tag: 'EMAIL', name: 'Emails', one: 'email', defaultOn: true },
  { type: 'PHONE', tag: 'PHONE', name: 'Phone numbers', one: 'phone number', defaultOn: true },
  { type: 'ADDRESS', tag: 'ADDRESS', name: 'Street addresses', one: 'street address', defaultOn: true },
  { type: 'POSTCODE', tag: 'POSTCODE', name: 'Postcodes', one: 'postcode', defaultOn: true },
  { type: 'CARD', tag: 'CARD', name: 'Card numbers', one: 'card number', defaultOn: true },
  { type: 'IBAN', tag: 'IBAN', name: 'Bank accounts', one: 'bank account', defaultOn: true },
  { type: 'ID', tag: 'ID', name: 'ID numbers', one: 'ID number', defaultOn: true },
  { type: 'DOB', tag: 'BIRTH DATE', name: 'Birth dates', one: 'birth date', defaultOn: true },
  { type: 'SECRET', tag: 'SECRET', name: 'Keys and passwords', one: 'key or password', defaultOn: true },
  { type: 'USERNAME', tag: 'USERNAME', name: 'Usernames', one: 'username', defaultOn: true },
  { type: 'IP', tag: 'IP', name: 'IP addresses', one: 'IP address', defaultOn: true },
  { type: 'MAC', tag: 'MAC', name: 'MAC addresses', one: 'MAC address', defaultOn: true },
  { type: 'ORG', tag: 'ORG', name: 'Organizations', one: 'organization', defaultOn: false },
  { type: 'LOCATION', tag: 'PLACE', name: 'Places', one: 'place', defaultOn: false },
  { type: 'URL', tag: 'URL', name: 'Links', one: 'link', defaultOn: false },
  { type: 'DATE', tag: 'DATE', name: 'Other dates', one: 'date', defaultOn: false },
  { type: 'PRODUCT', tag: 'PRODUCT', name: 'Products', one: 'product', defaultOn: false },
]

export const TYPE_BY_ID: Record<EntityType, TypeInfo> = Object.fromEntries(
  TYPE_INFO.map((t) => [t.type, t]),
) as Record<EntityType, TypeInfo>

export function defaultTypes(): Set<EntityType> {
  return new Set(TYPE_INFO.filter((t) => t.defaultOn).map((t) => t.type))
}
