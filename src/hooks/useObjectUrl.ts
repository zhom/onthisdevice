import { useEffect, useState } from 'react'

/**
 * Create an object URL for a Blob/File and revoke it whenever the blob changes
 * or the component unmounts.
 *
 * SSR-safe: returns `null` during server render (the URL is created in an
 * effect, which never runs on the server).
 */
export function useObjectUrl(file: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!file || typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') {
      setUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  return url
}
