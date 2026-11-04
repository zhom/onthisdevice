/** File digests. Each algorithm runs in its own worker, so asking for four costs about the time of the slowest. */
import { run } from './pool'
import type { HashName } from './kernels'

export type { HashName }

export async function hashFile<A extends HashName>(
  file: Blob,
  algorithms: readonly A[],
  options: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {},
): Promise<Record<A, string>> {
  const done = new Map<A, number>()
  // Each algorithm reads the whole file, so progress counts all of those bytes.
  const total = file.size * algorithms.length
  const digests = await Promise.all(
    algorithms.map((algorithm) =>
      run(
        'hash',
        { file, algorithm },
        {
          signal: options.signal,
          onProgress: (bytes) => {
            done.set(algorithm, bytes)
            options.onProgress?.([...done.values()].reduce((a, b) => a + b, 0), total)
          },
        },
      ),
    ),
  )
  return Object.fromEntries(algorithms.map((a, i) => [a, digests[i]])) as Record<A, string>
}
