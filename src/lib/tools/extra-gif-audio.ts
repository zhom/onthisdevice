import type { Tool } from './types'

/**
 * Round-2 batch `gif-audio`: the GIF workshop, the audio converter family, the
 * joiner, the voice recorder and the two device tests.
 *
 * Everything in here runs on the visitor's own hardware — FFmpeg compiled to
 * WebAssembly for the file work, `getUserMedia` + `MediaRecorder` for capture.
 * The three capture tools are the sharpest version of the whole product pitch:
 * every rival "mic test" and "webcam test" page streams your face or your voice
 * to a server in order to hand it back to you.
 */
export const tools: Tool[] = [
  /* ---------------------------------------------------------------- *
   * GIF
   * ---------------------------------------------------------------- */
  {
    slug: 'images-to-gif',
    title: 'GIF Maker',
    h1: 'GIF maker: turn images into an animated GIF',
    description:
      'GIF maker: turn photos or frames into an animated GIF. Drag them into order, set a delay for each frame and see a live preview.',
    keywords: [
      'gif maker',
      'images to gif',
      'photo to gif',
      'jpg to gif',
      'png to gif',
      'animated gif maker',
      'make a gif from pictures',
    ],
    category: 'media',
    icon: 'Images',
    accepts: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'],
    faqs: [
      {
        q: 'Can each frame have a different delay?',
        a: 'Yes. Every frame card has its own delay box in milliseconds. The GIF format stores delays in hundredths of a second, so values are rounded to the nearest 10 ms. Values under 20 ms are raised, because browsers play delays under 20 ms as 100 ms.',
      },
      {
        q: 'My images are different sizes. What happens?',
        a: 'A GIF has one canvas size for the whole animation, so every frame is drawn onto the output size you set. Choose "fit inside" to keep each picture whole with padding, "fill the frame" to crop the overflow, or "stretch" to distort it to fit exactly.',
      },
      {
        q: 'Why is my GIF so much bigger than the source photos?',
        a: 'GIF stores every frame as a complete palettised image with no motion prediction, so size scales with width × height × frame count. Ten 1 MB JPEGs can easily become a 12 MB GIF. Halving the width cuts roughly 75% of the size, because area scales with the square.',
      },
      {
        q: 'How many images can I use?',
        a: 'The tool holds 200 frames at a time. This is a limit of the interface. Above a few hundred frames, a GIF is so large that an MP4 is better, and the browser must hold every decoded frame at once.',
      },
      {
        q: 'Is there a watermark?',
        a: 'No. FFmpeg makes the GIF in your browser tab and adds nothing to it. There is no export limit and no paid version.',
      },
    ],
    related: ['compress-gif', 'split-gif', 'resize-gif', 'video-to-gif', 'gif-to-mp4'],
    updated: '2026-11-01',
  },
  {
    slug: 'compress-gif',
    title: 'Compress GIF',
    h1: 'Compress a GIF to an exact file size',
    description:
      'Compress a GIF to an exact KB or MB target. The tool encodes it again at lower settings until it fits and keeps the best quality under the limit.',
    keywords: [
      'compress gif',
      'reduce gif size',
      'gif optimizer',
      'shrink gif',
      'gif under 8mb',
      'make gif smaller',
    ],
    category: 'media',
    icon: 'Gauge',
    accepts: ['gif'],
    faqs: [
      {
        q: 'How does it hit an exact size?',
        a: 'It does a binary search on a quality ladder that changes resolution, frame rate and palette size together. It encodes your GIF at each step until it finds the best version that fits, usually in four encodes.',
      },
      {
        q: 'What target should I pick for Discord?',
        a: 'Discord accepts 10 MB on a free account and rejects anything over it with a generic error, so the 8 MB preset leaves a margin. A Discord custom emoji must be 128 px and under 256 KB. Slack recommends square emoji under 128 KB. The Resize GIF tool has presets for both.',
      },
      {
        q: 'Why did the tool cut the frame rate as well as the size?',
        a: 'Frame count is the biggest single contributor to GIF size, because every frame is stored in full. Dropping 24 fps to 12 fps roughly halves the file and is almost invisible on screen recordings and reaction clips. The ladder only reduces frame rate once resolution and palette cuts are no longer enough.',
      },
      {
        q: 'What if it cannot reach my target?',
        a: 'Long or very detailed GIFs have a minimum size. Trim the clip first, or convert it to MP4. H.264 uses motion prediction and is typically five to twenty times smaller than the same animation as a GIF. Chat apps and social networks play short muted MP4s inline.',
      },
    ],
    related: ['resize-gif', 'gif-to-mp4', 'split-gif', 'images-to-gif', 'video-to-gif'],
    updated: '2026-11-01',
  },
  {
    slug: 'resize-gif',
    title: 'Resize GIF',
    h1: 'Resize an animated GIF',
    description:
      'Resize a GIF to any width, such as 128 px for an emoji or 480 px for docs. The tool builds a new palette for each frame so small sizes stay sharp.',
    keywords: [
      'resize gif',
      'gif resizer',
      'change gif size',
      'gif to 128px',
      'discord emoji gif',
      'scale gif',
    ],
    category: 'media',
    icon: 'Scaling',
    accepts: ['gif'],
    faqs: [
      {
        q: 'What size do Discord and Slack emoji need?',
        a: 'Discord custom emoji are displayed at 32 px but uploaded at up to 128 × 128 and must be under 256 KB. Slack recommends square images under 128 KB, and a GIF emoji can have up to 50 frames. Both presets are in the dropdown. If the resized file is still over the byte limit, use Compress GIF next.',
      },
      {
        q: 'Why does resizing change the colours?',
        a: 'Scaling blends neighbouring pixels, which makes colours that were not in the original 256-entry palette. A simple resizer snaps them to the old palette, which makes small GIFs blotchy. This tool builds a new palette from the scaled frames and dithers again against it.',
      },
      {
        q: 'Does resizing keep the animation and the loop setting?',
        a: 'Yes. Frame count, per-frame delays and the Netscape loop block are all preserved, so the animation plays at the same speed and loops the same number of times. Only the pixel dimensions and the palette change.',
      },
      {
        q: 'Can I make a GIF larger?',
        a: 'Yes. Enter a bigger width and Lanczos scaling enlarges it. But a GIF has at most 256 colours, and enlarging cannot recover detail that the palette removed. Upscaling also multiplies the file size by the area ratio.',
      },
    ],
    related: ['compress-gif', 'images-to-gif', 'split-gif', 'gif-to-mp4', 'resize-video'],
    updated: '2026-11-01',
  },
  {
    slug: 'split-gif',
    title: 'GIF to Frames',
    h1: 'Split a GIF into individual frames',
    description:
      'Split a GIF into frames: save each frame of an animation as a numbered PNG or JPEG in one ZIP, with the exact delay of each frame.',
    keywords: [
      'gif to frames',
      'split gif',
      'gif to png',
      'extract gif frames',
      'gif frame extractor',
      'gif to jpg',
    ],
    category: 'media',
    icon: 'LayoutGrid',
    accepts: ['gif'],
    faqs: [
      {
        q: 'How do you know each frame’s delay?',
        a: 'The tool reads the delays from the Graphic Control Extension blocks of the GIF before FFmpeg loads, so the timing table has the exact values from the file. The delays are also in frame-delays.csv in the ZIP.',
      },
      {
        q: 'PNG or JPEG?',
        a: 'PNG for anything with transparency, flat colour or text. It is lossless and keeps the alpha channel that GIF transparency becomes. Use JPEG only if you need much smaller frames and the content is photographic. Transparent pixels turn black in a JPEG.',
      },
      {
        q: 'Can I rebuild the GIF afterwards?',
        a: 'Yes. Take the extracted PNGs into the GIF Maker, keep them in filename order, and enter each delay from frame-delays.csv. That round trip is the usual way to delete, retouch or reorder a few frames of an existing animation.',
      },
      {
        q: 'What is the frame limit?',
        a: 'Extraction stops at 600 frames so the browser stays responsive while holding every decoded image in memory. If your GIF is longer, choose "every 2nd frame" or higher and the sampling will cover the whole animation.',
      },
    ],
    related: ['images-to-gif', 'compress-gif', 'resize-gif', 'video-to-gif', 'gif-to-mp4'],
    updated: '2026-11-01',
  },

  /* ---------------------------------------------------------------- *
   * Audio converters
   * ---------------------------------------------------------------- */
  {
    slug: 'm4a-to-mp3',
    title: 'M4A to MP3 Converter',
    h1: 'Convert M4A to MP3',
    description:
      'Convert M4A to MP3: voice memos, GarageBand exports and other AAC or ALAC audio. Convert up to 50 files at once and choose the bitrate.',
    keywords: [
      'm4a to mp3',
      'convert m4a',
      'voice memo to mp3',
      'apple audio to mp3',
      'm4a converter',
    ],
    category: 'media',
    icon: 'FileAudio',
    accepts: ['m4a', 'mp4', 'aac'],
    faqs: [
      {
        q: 'Will converting M4A to MP3 lose quality?',
        a: 'A little. M4A holds AAC, which is already lossy, so decoding it and encoding it as MP3 adds a second loss. At 192 kbps or above the difference is inaudible for speech and very hard to hear on music. Keep the original M4A in case you must convert again later.',
      },
      {
        q: 'Where do M4A files come from?',
        a: 'Apple Voice Memos, GarageBand exports, iTunes purchases, and most phone recorders. M4A is a container (MPEG-4 audio) rather than a codec, so it usually holds AAC and occasionally ALAC. Both decode here.',
      },
      {
        q: 'Can it convert a whole folder at once?',
        a: 'Yes. Drop or select up to 50 files, and they convert one after another with a progress row each. When more than one finishes, you get a single ZIP as well as separate downloads. There is no daily limit.',
      },
      {
        q: 'Can it convert a DRM-protected iTunes purchase?',
        a: 'No. Older iTunes Store purchases use the .m4p extension and Apple FairPlay DRM, which no local tool can decode. This tool reports that it cannot read the file. Music bought since 2009 is DRM-free and converts normally.',
      },
    ],
    related: ['aac-to-mp3', 'wav-to-mp3', 'audio-converter', 'audio-joiner', 'mp3-to-wav'],
    updated: '2026-11-01',
  },
  {
    slug: 'ogg-to-mp3',
    title: 'OGG to MP3 Converter',
    h1: 'Convert OGG to MP3',
    description:
      'Convert OGG to MP3 from Vorbis or Opus audio. Drop a whole folder, pick a bitrate, and download each file or all of them in one ZIP.',
    keywords: ['ogg to mp3', 'convert ogg', 'oga to mp3', 'vorbis to mp3', 'ogg converter'],
    category: 'media',
    icon: 'AudioLines',
    accepts: ['ogg', 'oga', 'opus'],
    faqs: [
      {
        q: 'What is actually inside an .ogg file?',
        a: 'Ogg is a container. It normally holds Vorbis audio, but newer files, such as voice notes and game assets, often hold Opus. The extension does not tell you which. The tool decodes both.',
      },
      {
        q: 'Why does anything still use OGG?',
        a: 'It is patent-free, so it became the default for open-source games, Wikipedia audio, Spotify streams and many Linux tools. But many car stereos, older phones and hardware players do not support it, which is the usual reason to convert.',
      },
      {
        q: 'Which bitrate matches my original?',
        a: 'Vorbis at quality 5 is roughly 160 kbps and Opus voice notes are often 32–64 kbps. MP3 is a less efficient codec, so match or slightly exceed the source number: 192 kbps MP3 for a 160 kbps Vorbis file, 128 kbps for a 64 kbps Opus voice note.',
      },
      {
        q: 'Do the tags survive?',
        a: 'Ogg uses Vorbis comments and MP3 uses ID3, which are different formats with different field names. FFmpeg copies the basic metadata it can map as ID3v2.3. Unusual custom fields, cover art in unusual layouts and chapter data can be lost.',
      },
    ],
    related: ['opus-to-mp3', 'm4a-to-mp3', 'flac-to-mp3', 'audio-converter', 'audio-joiner'],
    updated: '2026-11-01',
  },
  {
    slug: 'flac-to-mp3',
    title: 'FLAC to MP3 Converter',
    h1: 'Convert FLAC to MP3',
    description:
      'Convert FLAC to MP3 for phones and car stereos at up to 320 kbps. Add a whole album at once. Title, artist and track tags are copied.',
    keywords: ['flac to mp3', 'convert flac', 'flac converter', 'lossless to mp3', 'flac batch'],
    category: 'media',
    icon: 'Disc3',
    accepts: ['flac'],
    faqs: [
      {
        q: 'What bitrate should I use for a FLAC album?',
        a: 'FLAC is lossless, so there is no earlier loss, and the MP3 bitrate is your choice of quality against size. Use 320 kbps for good headphones, 256 kbps for a very close match in 20% less space, and 192 kbps for a phone or a car, where road noise is louder.',
      },
      {
        q: 'How much smaller will the files get?',
        a: 'FLAC typically compresses CD audio to 55–65% of WAV, about 30 MB for a five-minute track. The same track at 320 kbps MP3 is about 12 MB, and at 192 kbps about 7 MB. A whole album goes from about 300 MB to 70–120 MB. The tool shows the exact ratio when it finishes.',
      },
      {
        q: 'Can I convert a whole album in one go?',
        a: 'Yes. Select every track. The queue converts them in order with a progress bar each, then offers one ZIP. There is no daily limit and no 100 MB file limit, because your CPU does the encoding.',
      },
      {
        q: 'Will the album art and track numbers carry over?',
        a: 'FFmpeg maps FLAC’s Vorbis comments onto ID3v2.3 tags, so title, artist, album and track number normally survive. Embedded cover art usually does too, though very large images and unusual picture types can be dropped.',
      },
    ],
    related: ['wav-to-mp3', 'm4a-to-mp3', 'mp3-to-wav', 'audio-converter', 'ogg-to-mp3'],
    updated: '2026-11-01',
  },
  {
    slug: 'aac-to-mp3',
    title: 'AAC to MP3 Converter',
    h1: 'Convert AAC to MP3',
    description:
      'Convert AAC to MP3 for car stereos, DJ software and players that only read MP3. Reads raw ADTS .aac streams and AAC in .m4a or .mp4 files.',
    keywords: ['aac to mp3', 'convert aac', 'aac converter', 'adts to mp3', 'aac file to mp3'],
    category: 'media',
    icon: 'Music4',
    accepts: ['aac', 'm4a', 'mp4'],
    faqs: [
      {
        q: 'What is the difference between .aac and .m4a?',
        a: 'They usually hold the same audio. A raw .aac file is a bare ADTS stream with no container, while .m4a puts AAC in an MPEG-4 container that can also carry tags, chapters and cover art. Raw .aac is common from broadcast captures and stream rippers. Both work here.',
      },
      {
        q: 'Why convert AAC to MP3 when AAC is the better codec?',
        a: 'For compatibility. AAC sounds better than MP3 at the same bitrate, but older car head units, DJ software, cheap MP3 players, some gym equipment and much embedded hardware read only MP3. If all your devices play AAC, do not convert.',
      },
      {
        q: 'Does converting twice make it noticeably worse?',
        a: 'A little. Each lossy encode removes more, and AAC and MP3 remove slightly different things. Encoding at 256 or 320 kbps keeps the artefacts below what most people can hear. Do not chain three or four conversions of the same file.',
      },
      {
        q: 'Why does my .aac file not play here or anywhere else?',
        a: 'Raw ADTS streams captured during a broadcast are often cut short or start halfway through a frame. If FFmpeg reports invalid data, the file is damaged. Download it again. Another converter reads the same broken bytes and also fails.',
      },
    ],
    related: ['m4a-to-mp3', 'ogg-to-mp3', 'audio-converter', 'wav-to-mp3', 'audio-joiner'],
    updated: '2026-11-01',
  },
  {
    slug: 'opus-to-mp3',
    title: 'Opus to MP3 Converter',
    h1: 'Convert Opus to MP3',
    description:
      'Convert Opus to MP3 for WhatsApp, Telegram and Discord voice notes. Select a whole chat export and get all the files back in one ZIP.',
    keywords: [
      'opus to mp3',
      'convert opus',
      'whatsapp audio to mp3',
      'telegram voice to mp3',
      'opus converter',
    ],
    category: 'media',
    icon: 'Radio',
    accepts: ['opus', 'ogg', 'oga'],
    faqs: [
      {
        q: 'Why are WhatsApp voice notes Opus files?',
        a: 'Opus is very efficient for speech at low bitrates: a clear voice note fits in 16–32 kbps. For this reason WhatsApp, Telegram, Signal, Discord and modern video-call systems use it. But Windows Media Player, older iPhones and many transcription tools do not open Opus files.',
      },
      {
        q: 'What bitrate should I choose for a voice note?',
        a: '96 or 128 kbps. The Opus source is typically 16–32 kbps, and MP3 needs three to four times that bitrate to encode speech with no audible warble. Above 128 kbps the file gets larger and sounds the same.',
      },
      {
        q: 'Does a .ogg file from Telegram work?',
        a: 'Yes. Telegram wraps Opus in an Ogg container and names it .ogg or .oga, and WhatsApp exports .opus. All three go through the same decoder here, so the extension does not matter.',
      },
      {
        q: 'Can I convert a whole WhatsApp export at once?',
        a: 'Yes. Unzip the chat export and select every audio file. The queue converts them one by one and gives you a single ZIP.',
      },
    ],
    related: ['ogg-to-mp3', 'amr-to-mp3', 'm4a-to-mp3', 'audio-joiner', 'voice-recorder'],
    updated: '2026-11-01',
  },
  {
    slug: 'amr-to-mp3',
    title: 'AMR to MP3 Converter',
    h1: 'Convert AMR to MP3',
    description:
      'Convert AMR to MP3: call recordings, voicemail and voice notes from older phones. Also reads .3ga and .3gp files, and converts many at once.',
    keywords: ['amr to mp3', 'convert amr', 'amr player', 'call recording to mp3', '3ga to mp3'],
    category: 'media',
    icon: 'Voicemail',
    accepts: ['amr', '3ga', '3gp'],
    faqs: [
      {
        q: 'What is an AMR file?',
        a: 'Adaptive Multi-Rate is the speech codec GSM phones used for calls and voicemail, running at 4.75–12.2 kbps. Android call recorders, older Samsung and Nokia voice recorders, and many voicemail systems still produce it. Almost nothing on a desktop plays it without extra codecs.',
      },
      {
        q: 'Will the recording sound better as an MP3?',
        a: 'No. No converter can. AMR keeps only 300–3400 Hz at a few kilobits per second, and the sound outside that range was never recorded. Converting makes the file playable and editable, but not clearer. 64–96 kbps MP3 holds everything AMR contains.',
      },
      {
        q: 'Why are these files so private?',
        a: 'AMR files are mostly call recordings, voicemail and dictation. Here WebAssembly decodes the audio in your tab, and the page makes no network request. You can check this in the Network tab of the browser.',
      },
      {
        q: 'Is a .3ga or .3gp file the same thing?',
        a: 'Almost. The Samsung recorder writes AMR in a 3GP container and calls it .3ga. A .3gp file can contain AMR audio with or without video. The tool accepts both and converts only the audio track.',
      },
    ],
    related: ['opus-to-mp3', 'm4a-to-mp3', 'voice-recorder', 'audio-converter', 'audio-joiner'],
    updated: '2026-11-01',
  },
  {
    slug: 'mp3-to-wav',
    title: 'MP3 to WAV Converter',
    h1: 'Convert MP3 to WAV',
    description:
      'Convert MP3 to WAV: decode to uncompressed PCM at 16, 24 or 32-bit for editing, sampling and DAW import. A minute of 16-bit stereo is 10.1 MB.',
    keywords: ['mp3 to wav', 'convert mp3 to wav', 'wav converter', 'mp3 to pcm', 'wav for daw'],
    category: 'media',
    icon: 'AudioWaveform',
    accepts: ['mp3'],
    faqs: [
      {
        q: 'Does converting to WAV improve the quality?',
        a: 'No. WAV is lossless, so it keeps exactly what the MP3 decodes to, and the detail the MP3 encoder removed stays lost. WAV gives you a format that editors, samplers and DAWs can scrub and process without decoding again, and that loses no more quality on each save.',
      },
      {
        q: 'Which bit depth should I pick?',
        a: '16-bit for files you only play or burn. It is the CD standard and the most compatible. 24-bit if the file goes into a mix where you apply gain and effects. 32-bit float if your DAW works in float and you want headroom that cannot clip during processing.',
      },
      {
        q: 'How big will the WAV be?',
        a: 'Exactly sample rate × channels × bytes per sample × seconds. Stereo 44.1 kHz 16-bit is 10.1 MB per minute, so a four-minute track is about 40 MB, whatever the bitrate of the MP3. 24-bit is 50% larger.',
      },
      {
        q: 'Why does the WAV start with a moment of silence?',
        a: 'MP3 encoders add padding at the start of the stream, and the decoder faithfully reproduces it. Most modern files carry a LAME or iTunes gapless tag that FFmpeg uses to trim it. If a few milliseconds remain, nudge the region start in your editor.',
      },
    ],
    related: ['wav-to-mp3', 'flac-to-mp3', 'audio-converter', 'trim-audio', 'audio-joiner'],
    updated: '2026-11-01',
  },
  {
    slug: 'wav-to-mp3',
    title: 'WAV to MP3 Converter',
    h1: 'Convert WAV to MP3',
    description:
      'Convert WAV to MP3 and see how much smaller each file gets: 192 kbps MP3 is about 14% of a 16-bit stereo WAV. Also reads AIFF files.',
    keywords: [
      'wav to mp3',
      'convert wav',
      'compress wav',
      'wav converter',
      'large wav to mp3',
      'daw export to mp3',
    ],
    category: 'media',
    icon: 'Waves',
    accepts: ['wav', 'wave', 'aiff', 'aif'],
    faqs: [
      {
        q: 'My WAV is 900 MB. Will this handle it?',
        a: 'Yes, on a desktop. There is no 100 MB or 500 MB limit and no queue. The limit is the memory of your device: the browser sandbox has about 2 GB of working memory. On a phone, files above a few hundred megabytes can fail.',
      },
      {
        q: 'How much smaller will it get?',
        a: 'Stereo 44.1 kHz 16-bit WAV is 1411 kbps. At 192 kbps MP3 that is about 14% of the original, and at 320 kbps about 23%. A one-hour interview drops from roughly 600 MB to 85 MB at 192 kbps. The result panel shows the exact ratio for your files.',
      },
      {
        q: 'What bitrate for a podcast or interview?',
        a: '96–128 kbps mono is the podcast standard and sounds fine for speech, and forcing mono halves the size again if the recording is a single voice. Use 192 kbps or higher only when there is music, room ambience or multiple mics you want to keep separated in the stereo field.',
      },
      {
        q: 'Should I normalise the loudness?',
        a: 'Turn it on for interviews and voice recordings with uneven levels. The EBU R128 filter brings everything to −16 LUFS, which podcast platforms expect. Leave it off for music that is already mastered, because it undoes the mastering.',
      },
    ],
    related: ['mp3-to-wav', 'flac-to-mp3', 'audio-joiner', 'audio-converter', 'trim-audio'],
    updated: '2026-11-01',
  },

  /* ---------------------------------------------------------------- *
   * Joining and capture
   * ---------------------------------------------------------------- */
  {
    slug: 'audio-joiner',
    title: 'Audio Joiner',
    h1: 'Join and merge audio files',
    description:
      'Audio joiner: merge MP3, WAV and M4A files into one track. Drag them into order, trim each piece on its waveform and add a crossfade.',
    keywords: [
      'audio joiner',
      'merge mp3',
      'combine audio files',
      'join audio',
      'mp3 merger',
      'concatenate audio',
    ],
    category: 'media',
    icon: 'ListMusic',
    accepts: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac'],
    faqs: [
      {
        q: 'Does joining re-encode my files?',
        a: 'Only when it has to. If every track is the same format and you have not trimmed anything or set a crossfade, the audio packets are copied straight through and the result is bit-identical to the sources. Mixed formats, a trim or a crossfade all require decoding, so everything is normalised to 44.1 kHz stereo and encoded once. The panel says which path ran.',
      },
      {
        q: 'How does the crossfade change the total length?',
        a: 'A crossfade overlaps neighbouring tracks, so each crossfade makes the result shorter by its own length. Three tracks with a 2-second crossfade finish 4 seconds shorter than the sum of the parts. The running total above the list includes this.',
      },
      {
        q: 'Where do the waveforms come from?',
        a: 'The Web Audio decoder of your browser reads each file, and the peaks are drawn on a canvas. Some browsers cannot decode every format (Safari cannot decode Opus, for example), and those tracks show a note in place of a waveform. Trimming and joining still work.',
      },
      {
        q: 'Is there a length or track limit?',
        a: 'Thirty tracks per session. Their length and total size are limited only by the memory of your device.',
      },
    ],
    related: ['trim-audio', 'wav-to-mp3', 'audio-converter', 'voice-recorder', 'm4a-to-mp3'],
    updated: '2026-11-01',
  },
  {
    slug: 'voice-recorder',
    title: 'Online Voice Recorder',
    h1: 'Record your voice online',
    description:
      'Online voice recorder with a live waveform, pause and resume. Save the recording as WebM, MP3 or WAV, with no time limit.',
    keywords: [
      'voice recorder',
      'online voice recorder',
      'audio recorder',
      'record voice online',
      'mic recorder',
      'record audio browser',
    ],
    category: 'media',
    icon: 'Mic',
    faqs: [
      {
        q: 'Is my recording uploaded anywhere?',
        a: 'No. The browser sends the microphone stream to MediaRecorder in this tab, and the chunks are kept in memory. The page makes no request while you record. To check, open the Network tab, or turn off Wi-Fi and record.',
      },
      {
        q: 'Is there a time limit?',
        a: 'No. Only memory limits the length: Opus at the default quality is about 30 MB per hour, so recordings of several hours work on a desktop. For very long recordings, stop and start a new take from time to time in case the browser crashes.',
      },
      {
        q: 'What format do I get, and should I convert it?',
        a: 'Chrome, Edge and Firefox record WebM with Opus. Safari records MP4 with AAC. Both are complete, playable files. Convert to MP3 if you give the file to someone with older software, or to WAV for a DAW. Each conversion is one more FFmpeg pass on your device.',
      },
      {
        q: 'Should I leave noise suppression on?',
        a: 'For speech, yes. It removes fan and air-conditioning noise well. Turn it off, with echo cancellation and automatic gain, when you record singing or an instrument. These algorithms are tuned for voice calls. They make sustained notes quieter and flatten dynamics.',
      },
      {
        q: 'Can I record what is playing on my computer?',
        a: 'No. getUserMedia gives access only to microphone inputs. To capture system audio, you need screen-capture permission with an audio share, which a screen recorder uses. On macOS you also need a loopback driver.',
      },
    ],
    related: ['microphone-test', 'audio-joiner', 'trim-audio', 'wav-to-mp3', 'audio-converter'],
    updated: '2026-11-01',
  },
  {
    slug: 'microphone-test',
    title: 'Microphone Test',
    h1: 'Test your microphone',
    description:
      'Test your microphone with a live level meter, a device picker and a five-second recording that plays back. The meter shows the raw signal.',
    keywords: [
      'microphone test',
      'mic test',
      'test my microphone',
      'audio input test',
      'check microphone',
      'mic not working',
    ],
    category: 'media',
    icon: 'MicVocal',
    faqs: [
      {
        q: 'Why can a meeting app not hear me when the meter moves?',
        a: 'The hardware, the driver and the browser permission all work. The problem is in that app: it uses a different input device. Open its audio settings and select the microphone shown in the device list here.',
      },
      {
        q: 'What if the meter does not move?',
        a: 'Check these in order: a hardware mute switch or a muted headset control, the wrong device selected below, the microphone privacy setting of the operating system, and the input volume slider in your sound settings. A flat meter with permission granted is almost never a browser fault.',
      },
      {
        q: 'Why do you switch off noise suppression?',
        a: 'A test must show what the microphone sends. The noise suppression and automatic gain of Chrome can make a broken signal look clean, or silence a very quiet microphone. The raw stream shows the real signal.',
      },
      {
        q: 'Is the five-second recording saved or sent anywhere?',
        a: 'No. It exists only as a Blob in the memory of this tab and plays back from there. Reloading or closing the page deletes it. Nothing is written to disk and no request is made: the page has no upload code, and the Content-Security-Policy of the site allows no third-party origin.',
      },
      {
        q: 'Which browser should I use for the most accurate result?',
        a: 'Any current Chrome, Edge, Firefox or Safari over HTTPS. The one difference is device names: Firefox and Safari hide them until you grant permission, so the device list can show generic labels until you allow access once.',
      },
    ],
    related: ['voice-recorder', 'webcam-test', 'audio-converter', 'audio-joiner'],
    updated: '2026-11-01',
  },
  {
    slug: 'webcam-test',
    title: 'Webcam Test',
    h1: 'Test your webcam',
    description:
      'Test your webcam with a live preview, the measured frame rate and the actual resolution. Save a snapshot as PNG or mirror the picture.',
    keywords: [
      'webcam test',
      'camera test',
      'test my camera',
      'check webcam',
      'webcam not working',
      'online camera test',
    ],
    category: 'media',
    icon: 'Webcam',
    faqs: [
      {
        q: 'Is my video streamed to a server?',
        a: 'No. The preview is your camera stream shown in a video element in this tab. The page code has no WebRTC peer connection, no signalling server and no upload endpoint, and the Content-Security-Policy of the site allows no third-party origin.',
      },
      {
        q: 'Why is the measured frame rate lower than what my camera claims?',
        a: 'The measurement counts the frames the page receives, which is the number that matters on a call. Cameras go below their rated rate in low light, because the sensor needs a longer exposure per frame. A busy CPU, a shared USB hub or a background app that also uses the camera has the same effect.',
      },
      {
        q: 'Is my camera wrong if the picture is mirrored?',
        a: 'No. Video-call apps mirror your self-view because an unmirrored image of yourself looks wrong. The other people on the call see the unmirrored version. This page mirrors by default and has a switch for it. Snapshots are saved as shown.',
      },
      {
        q: 'Why do I get 720p when I ask for 1080p?',
        a: 'The page requests the resolution as a preference, so a camera that cannot supply it returns its closest match and does not fail. Many built-in laptop cameras have 720p sensors, and some go to a lower resolution to keep a higher frame rate.',
      },
      {
        q: 'How do I turn off the camera light when I finish?',
        a: 'Press “Stop and release the camera”, which stops every track in the stream. The light goes out within a second. Closing the tab does the same. If the light stays on after both, another application or tab still has the camera open.',
      },
    ],
    related: ['microphone-test', 'voice-recorder', 'video-converter', 'compress-video'],
    updated: '2026-11-01',
  },
]
