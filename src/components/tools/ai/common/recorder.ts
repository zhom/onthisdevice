/**
 * Records the microphone to a file with MediaRecorder.
 *
 *   const rec = await startRecording()   // asks for the microphone
 *   const file = await rec.stop()        // File, WebM or MP4 by browser
 */
export interface Recording {
  stop(): Promise<File>
  cancel(): void
  started: number
}

export async function startRecording(): Promise<Recording> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('This browser cannot record from a microphone.')
  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
  } catch {
    throw new Error('The microphone is blocked. Allow it in the address bar and try again.')
  }
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) => MediaRecorder.isTypeSupported(t))
  const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
  const chunks: Blob[] = []
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
  rec.start(1000)
  const end = () => stream.getTracks().forEach((t) => t.stop())
  return {
    started: Date.now(),
    stop: () =>
      new Promise<File>((resolve) => {
        rec.onstop = () => {
          end()
          const mime = rec.mimeType || 'audio/webm'
          const ext = mime.includes('mp4') ? 'm4a' : 'webm'
          resolve(new File(chunks, `recording.${ext}`, { type: mime }))
        }
        rec.stop()
      }),
    cancel() {
      rec.onstop = end
      rec.stop()
    },
  }
}
