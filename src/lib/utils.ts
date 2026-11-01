import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 1234567 -> "1.2 MB" */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${parseFloat((bytes / k ** i).toFixed(decimals))} ${sizes[i]}`
}

/** Trigger a browser download for a Blob without leaking the object URL. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

/** "report.final.pdf" -> "report.final" */
export function stripExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i <= 0 ? filename : filename.slice(0, i)
}

/** "report.final.PDF" -> "pdf" */
export function fileExtension(filename: string): string {
  const i = filename.lastIndexOf('.')
  return i < 0 ? '' : filename.slice(i + 1).toLowerCase()
}

/** Clamp a number into [min, max]. */
export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

/** Format a number with locale separators, capped decimals. */
export function formatNumber(n: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, { maximumFractionDigits })
}

/** Format as currency; falls back gracefully for unknown codes. */
export function formatCurrency(n: number, currency = 'USD', maximumFractionDigits = 2): string {
  if (!Number.isFinite(n)) return '—'
  try {
    return n.toLocaleString(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits,
    })
  } catch {
    return `${currency} ${formatNumber(n, maximumFractionDigits)}`
  }
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** Await the next animation frame — lets the UI paint between heavy chunks. */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()))
}
