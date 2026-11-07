import type { Tool } from './types'

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  {
    slug: 'video-converter',
    title: 'Video Converter',
    h1: 'Convert video files in your browser',
    description:
      'Video converter for MP4, WebM, MKV, MOV and AVI files. Convert to MP4 (H.264), WebM (VP8) or GIF with quality and resolution presets.',
    keywords: [
      'convert video',
      'mkv to mp4',
      'mov to mp4',
      'avi to mp4',
      'webm to mp4',
      'video file converter',
      'free video converter',
    ],
    category: 'media',
    icon: 'FileVideo',
    popular: true,
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'Is my video uploaded anywhere?',
        a: 'No. An FFmpeg build compiled to WebAssembly runs in this tab, so your own CPU decodes and encodes the file. Nothing is sent to a server, and the tool works with your network switched off.',
      },
      {
        q: 'Why does the first conversion pause before starting?',
        a: 'The first run downloads the FFmpeg engine (10 MB) once. Your browser then caches it, so each later conversion on any tool on this site starts immediately.',
      },
      {
        q: 'Which output should I pick, MP4 or WebM?',
        a: 'MP4 with H.264 plays on essentially every device, encodes fastest and gives the smallest file. Pick WebM (VP8) only when a site or player asks for it.',
      },
      {
        q: 'How big a file can I convert?',
        a: 'The browser sandbox gives WebAssembly about 2 GB of working memory, and the input and the output both use it. Files up to about 500 MB work well. For larger files, trim or downscale first.',
      },
      {
        q: 'What does the CRF quality setting do?',
        a: 'CRF sets a constant quality target, and the bitrate changes: each frame gets as many bits as it needs. Lower numbers give better quality and bigger files. 18 is visually lossless, 23 is the default, and 28 is visibly compressed.',
      },
    ],
    related: ['compress-video', 'video-to-mp3', 'resize-video', 'video-to-gif', 'trim-video'],
    updated: UPDATED,
  },
  {
    slug: 'video-to-mp3',
    title: 'Video to MP3',
    h1: 'Convert video to MP3',
    description:
      'Convert video to MP3: extract the soundtrack of a video and save it as an MP3 at 96, 192 or 320 kbps. Trim it first if you need only a part.',
    keywords: [
      'mp4 to mp3',
      'video to audio',
      'extract mp3 from video',
      'mov to mp3',
      'youtube video to mp3 file',
      'convert video to mp3',
    ],
    category: 'media',
    icon: 'Music',
    popular: true,
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'Which bitrate should I choose?',
        a: '192 kbps is transparent for most music and is the default. Use 320 kbps for the highest MP3 quality, and 96 kbps for speech: a one-hour talk is then about 43 MB.',
      },
      {
        q: 'Can I export only part of the video?',
        a: 'Yes. Turn on "Trim before extracting" and drag the two handles, or type exact times. FFmpeg seeks to the start point before decoding, so trimming also makes the export faster.',
      },
      {
        q: 'Does converting to MP3 lose quality?',
        a: 'Some, and this cannot be avoided. The video soundtrack is already lossy (usually AAC), and encoding it to MP3 is a second lossy pass. For a bit-perfect copy, use the extract-audio tool in stream-copy mode.',
      },
      {
        q: 'What happens if the video has no sound?',
        a: 'FFmpeg reports that no audio stream matched, and the tool tells you so in plain language. You do not get an empty file.',
      },
    ],
    related: ['extract-audio-from-video', 'audio-converter', 'trim-audio', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'video-to-gif',
    title: 'Video to GIF',
    h1: 'Convert video to an animated GIF',
    description:
      'Convert video to GIF: pick the time range, frame rate and width of the clip. A two-pass palette gives accurate colour in the animated GIF.',
    keywords: [
      'mp4 to gif',
      'gif maker',
      'video to gif converter',
      'make a gif from video',
      'mov to gif',
      'animated gif from video',
    ],
    category: 'media',
    icon: 'ImagePlay',
    popular: true,
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'What is the two-pass palette and why does it matter?',
        a: 'GIF supports only 256 colours per frame. The first pass scans your clip and builds a palette from the colours it contains. The second pass maps each frame onto that palette. The result looks much better than the generic web palette, especially on skin tones and gradients.',
      },
      {
        q: 'Why is my GIF so much bigger than the video?',
        a: 'GIF has no motion compensation: each frame is stored almost independently. To keep a GIF small, cut the frame rate to 10-12 fps, the width to 480 px and the length to a few seconds.',
      },
      {
        q: 'Which dithering option should I use?',
        a: 'Sierra2 4A is the best default. Bayer gives a crisp, ordered pattern that compresses well for flat graphics, and turning dithering off yields the smallest file but visible colour banding.',
      },
      {
        q: 'Can I make the GIF play only once?',
        a: 'Yes. Set Looping to "Play once" under advanced options. This writes a loop count of zero into the GIF header in place of the infinite-loop flag.',
      },
    ],
    related: ['video-converter', 'trim-video', 'compress-video', 'resize-video'],
    updated: UPDATED,
  },
  {
    slug: 'compress-video',
    title: 'Compress Video',
    h1: 'Compress a video file',
    description:
      'Compress a video (MP4, MOV, MKV or WebM) with H.264 CRF encoding. See an estimated output size before you start and the real size after.',
    keywords: [
      'reduce video size',
      'make video smaller',
      'video compressor',
      'compress mp4',
      'shrink video file',
      'reduce mb of video',
    ],
    category: 'media',
    icon: 'Shrink',
    popular: true,
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'How much smaller will my file get?',
        a: 'It depends on the source. A phone recording at a high bitrate often gets 60-80% smaller at CRF 24 with no visible difference. A file that is already well compressed may barely shrink. The tool shows an estimate before you start and the real numbers after.',
      },
      {
        q: 'Should I lower the resolution or raise the CRF?',
        a: 'Lower the resolution. Going from 1080p to 720p removes 56% of the pixels. This usually saves more than several CRF steps, and on a phone screen it looks better than a heavily quantised 1080p file.',
      },
      {
        q: 'Why is the estimated size not exact?',
        a: 'CRF encoding has a variable bitrate: a static talking head needs a fraction of the bits of a handheld action shot. The estimate assumes typical motion at 30 fps, so use it as a rough guide.',
      },
      {
        q: 'Does compressing twice make things worse?',
        a: 'Yes. Each lossy encode removes detail permanently. Always compress from the original file, and not from a copy that is already compressed.',
      },
    ],
    related: ['video-converter', 'resize-video', 'trim-video', 'compress-image'],
    updated: UPDATED,
  },
  {
    slug: 'trim-video',
    title: 'Trim Video',
    h1: 'Trim and cut a video',
    description:
      'Trim a video with a dual-handle slider and a live preview. Choose a lossless stream copy that cuts at keyframes or a frame-exact re-encode.',
    keywords: [
      'cut video',
      'video trimmer',
      'crop video length',
      'shorten video',
      'split video',
      'cut mp4 online',
    ],
    category: 'media',
    icon: 'Scissors',
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'What is the difference between lossless and frame-exact mode?',
        a: 'Lossless mode copies the encoded video stream through, so quality does not change and the export takes seconds. But the cut must start on a keyframe, which can be a second or two before the point you chose. Frame-exact mode encodes again and starts on your exact frame, but it takes longer and loses a little quality.',
      },
      {
        q: 'Why does my lossless clip start earlier than I asked?',
        a: 'A video frame in the middle of a group of pictures cannot be decoded on its own. So a stream copy starts at the nearest keyframe before your point. Switch to frame-exact mode when the exact first frame matters.',
      },
      {
        q: 'How do I set the handles precisely?',
        a: 'Play the video, pause where you want the cut and press "Set here", or type a timecode such as 1:23.50 into the start or end box. The slider handles also respond to the arrow keys once focused.',
      },
      {
        q: 'Can I keep the original format?',
        a: 'Lossless mode always writes to the same container: MP4 stays MP4, MKV stays MKV. Frame-exact mode outputs MP4, because it encodes with H.264.',
      },
    ],
    related: ['video-converter', 'compress-video', 'mute-video', 'trim-audio', 'video-to-gif'],
    updated: UPDATED,
  },
  {
    slug: 'mute-video',
    title: 'Mute Video',
    h1: 'Remove the audio from a video',
    description:
      'Mute a video by removing its audio track. The video stream is copied bit for bit without decoding, so the picture stays identical.',
    keywords: [
      'remove audio from video',
      'silence video',
      'strip sound from mp4',
      'delete audio track',
      'mute mp4',
    ],
    category: 'media',
    icon: 'VolumeX',
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'Does muting reduce the video quality?',
        a: 'No. Only the audio track is removed. The video stream is copied without decoding, so the picture is bit-for-bit identical to the original.',
      },
      {
        q: 'How much smaller does the file get?',
        a: 'About the size of the audio track: usually 1-2 MB per minute for AAC at 128-192 kbps. On a file with a high video bitrate, the saving is small. On a screen recording, it can be large.',
      },
      {
        q: 'Can I remove the metadata too?',
        a: 'Yes. The "Also strip metadata" switch clears titles, comments, creation timestamps and any GPS tags the camera embedded, which is worth doing before sharing a clip publicly.',
      },
      {
        q: 'What if the muted file will not play?',
        a: 'A few exotic containers refuse a plain stream copy. Turn on "Re-encode instead of copying" and the video is rebuilt as a standard H.264 MP4 that plays everywhere.',
      },
    ],
    related: ['extract-audio-from-video', 'trim-video', 'compress-video', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'audio-converter',
    title: 'Audio Converter',
    h1: 'Convert audio files',
    description:
      'Audio converter for MP3, WAV, OGG, M4A and FLAC. Set the bitrate, sample rate and channels, and turn on EBU R128 loudness normalisation.',
    keywords: [
      'mp3 converter',
      'wav to mp3',
      'flac to mp3',
      'm4a to mp3',
      'ogg converter',
      'convert audio format',
      'audio file converter',
    ],
    category: 'media',
    icon: 'AudioLines',
    accepts: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'wma', 'aiff'],
    faqs: [
      {
        q: 'Which format should I convert to?',
        a: 'MP3 for maximum compatibility, M4A (AAC) for better quality at the same bitrate, FLAC when you need a lossless archive at about half the size of WAV, and WAV when a program demands raw PCM.',
      },
      {
        q: 'Does converting FLAC to MP3 lose quality?',
        a: 'Yes. MP3 is lossy, so detail is removed permanently. Converting MP3 to FLAC does not restore anything. It only puts the degraded audio in a bigger file.',
      },
      {
        q: 'What does loudness normalisation do?',
        a: 'It applies the EBU R128 loudnorm filter with a target of −16 LUFS, the level most podcast platforms expect. Use it for voice recordings. Leave it off for music that is already mastered.',
      },
      {
        q: 'Can I feed it a video file?',
        a: 'Yes. Drop an MP4, MOV or MKV. The tool ignores the video track and converts only the soundtrack to the format you picked.',
      },
    ],
    related: ['video-to-mp3', 'trim-audio', 'extract-audio-from-video', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'trim-audio',
    title: 'Trim Audio',
    h1: 'Trim and cut audio files',
    description:
      'Trim audio files (MP3, WAV, M4A, FLAC and OGG) with a dual-handle slider or exact timecodes. Add fades, or cut losslessly in copy mode.',
    keywords: [
      'cut mp3',
      'audio trimmer',
      'mp3 cutter',
      'crop audio',
      'ringtone maker',
      'shorten audio file',
    ],
    category: 'media',
    icon: 'AudioWaveform',
    accepts: ['mp3', 'wav', 'ogg', 'oga', 'opus', 'm4a', 'aac', 'flac', 'wma', 'aiff'],
    faqs: [
      {
        q: 'Is the cut lossless?',
        a: 'In copy mode, yes. The encoded samples are copied through with no decode and encode cycle. MP3 cuts snap to the nearest frame boundary, about 26 milliseconds, so you cannot hear the difference.',
      },
      {
        q: 'How do I add a fade in or fade out?',
        a: 'Open "Fade in / fade out" and set a length in seconds. Fades change the samples, so the tool switches to re-encoding automatically and tells you it has done so.',
      },
      {
        q: 'Can I make a phone ringtone with this?',
        a: 'Yes. Trim the section you want, then convert it with the audio converter if your phone needs M4A or a specific bitrate.',
      },
      {
        q: 'Why can I not see a waveform?',
        a: 'To draw a waveform, the tool must decode the whole file first, which is slow for long recordings. You get an audio player, a precise dual-handle slider and a "Set here" button that copies the playhead position into either field.',
      },
    ],
    related: ['audio-converter', 'video-to-mp3', 'trim-video', 'extract-audio-from-video'],
    updated: UPDATED,
  },
  {
    slug: 'extract-audio-from-video',
    title: 'Extract Audio from Video',
    h1: 'Extract the audio track from a video',
    description:
      'Extract audio from a video without re-encoding: the original AAC, Opus, MP3 or FLAC stream is copied bit for bit, or converted to another format.',
    keywords: [
      'extract audio',
      'rip audio from video',
      'video to m4a',
      'get sound from mp4',
      'save audio track',
      'demux audio',
    ],
    category: 'media',
    icon: 'FileAudio',
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'How is this different from the video-to-MP3 tool?',
        a: 'This tool can copy the existing audio stream without encoding it again, so there is zero quality loss and the export takes a second or two. Video-to-MP3 always makes an MP3, which is a second lossy generation.',
      },
      {
        q: 'What file will I get?',
        a: 'Whatever the video already contains: AAC comes out as .m4a, Opus and Vorbis as .ogg, MP3 as .mp3, FLAC as .flac. The tool detects the codec with FFmpeg before choosing the container.',
      },
      {
        q: 'What if the codec has no standalone container?',
        a: 'For unusual codecs, the tool converts the track to your chosen format and tells you so in the result. You do not get a file that nothing can open.',
      },
      {
        q: 'Can I extract from an MKV or an AVI?',
        a: 'Yes. FFmpeg reads MKV, AVI, MOV, WebM, MPEG and more, also when the browser cannot play them. The preview may be unavailable, but the extraction still works.',
      },
    ],
    related: ['video-to-mp3', 'audio-converter', 'mute-video', 'trim-audio'],
    updated: UPDATED,
  },
  {
    slug: 'resize-video',
    title: 'Resize Video',
    h1: 'Resize and rescale a video',
    description:
      'Resize a video to 1080p, 720p, 480p or a custom size. Lock the aspect ratio, and fit the new frame with letterbox bars or a crop.',
    keywords: [
      'change video resolution',
      'scale video',
      'video resizer',
      '1080p to 720p',
      'resize mp4',
      'video aspect ratio',
    ],
    category: 'media',
    icon: 'Maximize2',
    accepts: ['mp4', 'webm', 'mkv', 'mov', 'avi', 'm4v', 'mpg', 'mpeg', '3gp', 'ogv'],
    faqs: [
      {
        q: 'Should I letterbox or crop?',
        a: 'Letterboxing keeps the whole frame and adds bars, which is safest for footage you did not shoot. Cropping fills the frame edge to edge but cuts off the sides. Use it to turn a landscape clip into a vertical one when the subject is in the centre.',
      },
      {
        q: 'Can I upscale a video?',
        a: 'Yes, but scaling up adds no detail. It only interpolates. The presets are for scaling down, which reduces the file size and the decoding load.',
      },
      {
        q: 'Why are odd widths and heights adjusted?',
        a: 'H.264 and VP9 store colour at half resolution (4:2:0 chroma), so both dimensions must be even numbers. The tool rounds your input down to the nearest even value.',
      },
      {
        q: 'Does resizing recompress the video?',
        a: 'Yes. A change to the pixel grid needs a full decode and encode. Pick CRF 18-21 to keep the result visually identical to the source at the new size.',
      },
    ],
    related: ['compress-video', 'video-converter', 'trim-video', 'video-to-gif'],
    updated: UPDATED,
  },
]
