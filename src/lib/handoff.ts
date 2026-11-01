/**
 * Hands files from one page to the next tool page: the file is dropped on the home page, the
 * visitor picks a tool, and the tool page opens with the file already loaded. The files sit in
 * this browser's IndexedDB for at most 10 minutes and are deleted when the tool reads them.
 * They never leave the device.
 */

const DB_NAME = 'otd-handoff'
const STORE = 'files'
const TTL_MS = 10 * 60 * 1000
/** Set while a handoff waits, so pages without one never open the database. */
const FLAG = 'otd:handoff'

interface Entry {
  slug: string
  at: number
  files: File[]
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'slug' })
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'))
  })
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('IndexedDB transaction failed'))
  })
}

function currentSlug(): string {
  return location.pathname.split('/').filter(Boolean)[0] ?? ''
}

function readFlag(): string[] {
  try {
    return (sessionStorage.getItem(FLAG) ?? '').split(' ').filter(Boolean)
  } catch {
    return []
  }
}

function writeFlag(slugs: string[]): void {
  try {
    if (slugs.length) sessionStorage.setItem(FLAG, slugs.join(' '))
    else sessionStorage.removeItem(FLAG)
  } catch {
    /* storage off: the database is still checked on the next stash */
  }
}

/** Keeps `files` for the tool page `slug` to pick up. */
export async function stashHandoff(files: File[], slug: string): Promise<void> {
  const db = await open()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const entry: Entry = { slug, at: Date.now(), files }
    store.put(entry)
    await done(tx)
  } finally {
    db.close()
  }
  writeFlag([...readFlag().filter((s) => s !== slug), slug])
}

/**
 * Returns the files stashed for this page (or `slug`) in the last 10 minutes and deletes them.
 * Returns [] when there are none. Safe to call on every page load: without a pending handoff it
 * does not touch IndexedDB.
 */
export async function consumeHandoff(slug: string = currentSlug()): Promise<File[]> {
  if (typeof indexedDB === 'undefined' || !readFlag().includes(slug)) return []
  writeFlag(readFlag().filter((s) => s !== slug))
  let db: IDBDatabase
  try {
    db = await open()
  } catch {
    return []
  }
  try {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.get(slug)
    const entry = await new Promise<Entry | undefined>((resolve) => {
      req.onsuccess = () => resolve(req.result as Entry | undefined)
      req.onerror = () => resolve(undefined)
    })
    store.delete(slug)
    // Drop anything else that waited too long.
    const now = Date.now()
    const all = store.openCursor()
    all.onsuccess = () => {
      const cursor = all.result
      if (!cursor) return
      if (now - (cursor.value as Entry).at > TTL_MS) cursor.delete()
      cursor.continue()
    }
    await done(tx)
    if (!entry || now - entry.at > TTL_MS) return []
    return entry.files.filter((f): f is File => f instanceof File)
  } catch {
    return []
  } finally {
    db.close()
  }
}
