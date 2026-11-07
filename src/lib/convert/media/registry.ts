/** Registry entries for the audio and video pair pages. */
import type { Faq, Tool } from '@/lib/tools/types'
import { fitDescription } from '@/lib/convert/units/registry'
import { MEDIA, MEDIA_PAIRS, type MediaPairSpec } from './formats'
import { isAudioTarget } from './plan'

const FAST = new Set(['mp4', 'mov', 'mkv', 'webm'])

function faqs(p: MediaPairSpec): Faq[] {
  const A = MEDIA[p.from].label
  const B = MEDIA[p.to].label
  const audioOut = isAudioTarget(p.to)
  const out: Faq[] = []
  if (p.to === 'gif') {
    out.push({
      q: 'How do I keep the GIF small?',
      a: 'Use a short clip, a width of 480 px or less and 10 to 12 frames per second. Every frame of a GIF is stored as an image with 256 colours, so length and size add up fast. A 5-second clip at 480 px is usually 1 to 4 MB.',
    })
  } else if (MEDIA[p.from].kind === 'video' && audioOut) {
    out.push({
      q: `Is the video in the ${A} file converted too?`,
      a: `No. Only the sound track is read and written as ${B}. That is why it takes seconds rather than minutes.`,
    })
  } else if (!audioOut) {
    out.push({
      q: `Does converting ${A} to ${B} lose quality?`,
      a: `Not when the streams can be copied: the page checks the codecs in the file and copies video and sound that ${B} can hold, which is lossless and fast. Streams that must be re-encoded lose a little quality; the Quality setting controls how much.`,
    })
  } else {
    const lossless = ['wav', 'flac', 'aiff'].includes(p.to)
    out.push({
      q: `Does converting ${A} to ${B} lose quality?`,
      a: lossless
        ? `No. ${B} is lossless, so it stores the decoded audio exactly. It cannot add back detail that a lossy source already lost.`
        : `${B} is a lossy format, so a little detail is lost. At the bitrate shown (${p.to === 'opus' ? '128' : '192'} kbps by default) most listeners hear no difference.`,
    })
  }
  out.push({
    q: 'How long does it take?',
    a: FAST.has(p.to)
      ? `Copying streams takes seconds. A full re-encode uses the browser's built-in video encoders where possible, and the FFmpeg engine (a one-time 10 MB download) otherwise, at a fraction of real time to a few times real time.`
      : audioOut
        ? 'Audio converts many times faster than real time: a 5-minute song takes a few seconds once the FFmpeg engine (a one-time 10 MB download) has loaded.'
        : 'Re-encoding video in the browser runs at a fraction of real time to a few times real time, depending on the resolution and your processor. Choose a smaller size to make it faster.',
  })
  out.push({
    q: 'Is my file uploaded?',
    a: 'No. The conversion runs in this browser tab. The FFmpeg engine is a file of this site that runs on your device, and the page cannot send your file anywhere.',
  })
  out.push({
    q: 'Is there a file size limit?',
    a: 'There is no limit set by the site. The browser gives the engine at most about 2 GB of memory, so very long or very large videos may fail. Trim them first, or convert a smaller size.',
  })
  return out
}

function description(p: MediaPairSpec): string {
  const A = MEDIA[p.from].label
  const B = MEDIA[p.to].label
  return fitDescription([
    `Convert ${A} to ${B} in your browser. ${p.note} No upload, no sign-up.`,
    `Convert ${A} to ${B} on your device. ${p.note}`,
    `Convert ${A} files to ${B} in your browser with FFmpeg, with streams copied where possible. No upload and no file size cap.`,
  ])
}

export const mediaTools: Tool[] = MEDIA_PAIRS.map((p) => {
  const A = MEDIA[p.from].label
  const B = MEDIA[p.to].label
  const reverse = MEDIA_PAIRS.find((x) => x.from === p.to && x.to === p.from)?.slug
  const siblings = MEDIA_PAIRS.filter((x) => x.slug !== p.slug && (x.from === p.from || x.to === p.to)).map((x) => x.slug)
  const audioOut = isAudioTarget(p.to)
  return {
    slug: p.slug,
    title: `${A} to ${B}`,
    h1: `Convert ${A} to ${B}`,
    description: description(p),
    keywords: [`${A.toLowerCase()} to ${B.toLowerCase()} converter`, `convert ${A.toLowerCase()} to ${B.toLowerCase()}`, ...p.keywords],
    category: 'media',
    icon: p.to === 'gif' ? 'ImagePlay' : audioOut ? 'AudioLines' : 'Film',
    accepts: MEDIA[p.from].ext,
    faqs: faqs(p),
    related: [...(reverse ? [reverse] : []), ...siblings.slice(0, 4), audioOut ? 'audio-converter' : 'video-converter'],
    updated: '2026-11-07',
  }
})
