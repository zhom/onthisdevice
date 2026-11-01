import type { Tool } from './types'

/**
 * Round-2 batch `video` — FFmpeg (WebAssembly) video tools, remux-first.
 *
 * Every entry here is a real page under `src/pages/` backed by an island in
 * `src/components/tools/media/`. Sibling slugs (e.g. `mkv-to-mp4` sharing the
 * `VideoRemux` island with `mov-to-mp4`) get their own entry, their own
 * description and their own FAQs — a shared component is not a shared page.
 */

const UPDATED = '2026-11-01'

export const tools: Tool[] = [
  /* ------------------------------------------------------------------ *
   * Container conversion — remux when the codecs already fit
   * ------------------------------------------------------------------ */
  {
    slug: 'mov-to-mp4',
    title: 'MOV to MP4',
    h1: 'Convert MOV to MP4',
    description:
      'Convert MOV to MP4. When the QuickTime file already holds H.264 video, the streams are copied in seconds with no quality loss.',
    keywords: [
      'mov to mp4 converter',
      'quicktime to mp4',
      'iphone mov to mp4',
      'convert mov file',
      'mov mp4 no upload',
    ],
    category: 'media',
    icon: 'FileVideo',
    accepts: ['mov', 'qt', 'm4v'],
    faqs: [
      {
        q: 'Why is a MOV to MP4 conversion sometimes instant?',
        a: 'Most MOV files from an iPhone, a DSLR or QuickTime already contain H.264 or HEVC video and AAC audio, which is what an MP4 holds. Only the container changes, so the compressed data is copied packet by packet and is not decoded and compressed again. A 2 GB clip can finish in a few seconds and looks the same.',
      },
      {
        q: 'When does it have to re-encode instead?',
        a: 'When the MOV holds something MP4 cannot carry: Apple ProRes, Animation, or uncompressed PCM audio. These are common in footage exported from an editing suite. The page tells you which of the two paths it takes before it starts, and again on the result.',
      },
      {
        q: 'Is there a file size limit?',
        a: 'The tool sets no limit. The limit is your device: browsers give WebAssembly about 2 GB of working memory, and a stream copy needs much less of it than a re-encode.',
      },
      {
        q: 'Does the audio stay in sync?',
        a: 'Yes. On the copy path the timestamps are copied unchanged. On the re-encode path FFmpeg keeps the original presentation timestamps, so variable-frame-rate iPhone footage does not drift out of sync.',
      },
      {
        q: 'Will the MP4 play on Windows and Android?',
        a: 'H.264 MP4 plays on almost every device made since about 2008. HEVC MOV files copied into MP4 keep HEVC, which needs a recent device. If a player does not play it, run the file again with the method set to “always re-encode”.',
      },
    ],
    related: ['mkv-to-mp4', 'avi-to-mp4', 'mp4-to-mov', 'video-converter', 'compress-video'],
    updated: UPDATED,
  },
  {
    slug: 'mkv-to-mp4',
    title: 'MKV to MP4',
    h1: 'Convert MKV to MP4',
    description:
      'Convert MKV to MP4 for TVs, phones and editors. The Matroska streams are usually copied without re-encoding, so even a 4 GB film takes seconds.',
    keywords: [
      'mkv to mp4 converter',
      'matroska to mp4',
      'convert mkv',
      'mkv player fix',
      'mkv to mp4 no upload',
    ],
    category: 'media',
    icon: 'Film',
    accepts: ['mkv', 'webm'],
    faqs: [
      {
        q: 'Why will my TV not play MKV in the first place?',
        a: 'MKV is a container format that most smart TVs, PlayStations and older phones never licensed. The video inside is often plain H.264, which the device can decode, but the device refuses the container. Changing the container is all that is necessary.',
      },
      {
        q: 'What happens to subtitles and extra audio tracks?',
        a: 'The default video and audio streams are carried over. Soft subtitles and secondary language tracks are not copied, because MP4 has no equivalent for MKV subtitle formats such as ASS or PGS. If you need those, keep the MKV and use a player that supports it, such as VLC.',
      },
      {
        q: 'Can it handle a 4 GB or 8 GB film?',
        a: 'Usually yes, on a desktop with enough free memory. The copy path is fast because nothing is decoded. Very large files are the case where a browser tool can fail, because the whole input and output are in the memory of the tab. If it fails, the page shows an error and does not hang.',
      },
      {
        q: 'Does converting MKV to MP4 reduce quality?',
        a: 'Not on the copy path. The video data is the same bit for bit. Quality is lost only when the MKV contains something MP4 cannot hold, such as VP9 video or FLAC audio, and the page warns you before that happens.',
      },
    ],
    related: ['mov-to-mp4', 'avi-to-mp4', 'mkv-to-mp3', 'video-converter', 'trim-video'],
    updated: UPDATED,
  },
  {
    slug: 'avi-to-mp4',
    title: 'AVI to MP4',
    h1: 'Convert AVI to MP4',
    description:
      'Convert AVI to MP4 that plays on phones and in browsers. Old DivX and Xvid video is re-encoded to H.264 and the sound to AAC.',
    keywords: [
      'avi to mp4 converter',
      'divx to mp4',
      'xvid to mp4',
      'convert old avi',
      'avi mp4 offline',
    ],
    category: 'media',
    icon: 'Clapperboard',
    accepts: ['avi', 'divx'],
    faqs: [
      {
        q: 'Will my AVI file convert in seconds like MOV files do?',
        a: 'Usually not. AVI files from the DivX and Xvid era hold MPEG-4 Part 2 video and MP3 audio. MP4 can carry both, so a copy is sometimes possible. But many old AVI files also have problems, such as packed bitstreams or VBR MP3 with a broken header, that only a re-encode fixes. The page checks your file and tells you which path it will take.',
      },
      {
        q: 'Why does my AVI have no sound on a phone?',
        a: 'AVI often carries AC-3 or an old ADPCM variant that mobile devices never decode. Converting here re-encodes the soundtrack to AAC, which every phone plays, so the sound comes back.',
      },
      {
        q: 'Can the tool fix interlaced video?',
        a: 'No. Deinterlacing is a separate filter, and it makes progressive footage softer. Combing on fast motion is interlacing from an old camcorder or TV capture, and this tool does not remove it.',
      },
      {
        q: 'How long does a re-encode take?',
        a: 'About real time on a modern laptop for standard-definition AVI: a 10-minute clip takes about 10 minutes. The progress bar shows the percentage of the clip that is done, and you can cancel at any time.',
      },
    ],
    related: ['mkv-to-mp4', 'mov-to-mp4', 'avi-to-mp3', 'compress-video', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'mp4-to-mov',
    title: 'MP4 to MOV',
    h1: 'Convert MP4 to MOV',
    description:
      'Convert MP4 to MOV for Final Cut, iMovie and QuickTime Player. The streams are copied into the QuickTime container, so nothing is compressed again.',
    keywords: [
      'mp4 to mov converter',
      'mp4 to quicktime',
      'final cut mp4 import',
      'imovie mov',
      'convert mp4 mac',
    ],
    category: 'media',
    icon: 'MonitorPlay',
    accepts: ['mp4', 'm4v'],
    faqs: [
      {
        q: 'What is actually different between MP4 and MOV?',
        a: 'Very little. Both use the ISO base media file format, which came from the QuickTime format of Apple. MOV allows a few extra things (ProRes, timecode tracks, PCM audio), but for normal H.264 footage the two containers hold the same data with a different four-character brand.',
      },
      {
        q: 'Why does Final Cut or iMovie want MOV then?',
        a: 'Apple’s editors are stricter about the brand and the audio format than a player is. A new MOV container is often enough to make an import work. If Final Cut still refuses the clip, it needs a transcode to ProRes in a desktop encoder. This tool cannot do that.',
      },
      {
        q: 'Does this change the video quality at all?',
        a: 'No. On the copy path every video and audio packet is written to the new container unchanged, so the picture is byte-for-byte the source. The file size stays within a few kilobytes of the original.',
      },
      {
        q: 'Is a MOV file bigger than an MP4?',
        a: 'No. The container overhead differs by less than one percent. When people say MOV is “higher quality”, they mean ProRes MOV files from a camera, which are different from H.264 in a MOV container.',
      },
    ],
    related: ['mov-to-mp4', 'mp4-to-webm', 'video-converter', 'resize-video', 'trim-video'],
    updated: UPDATED,
  },
  {
    slug: 'webm-to-mp4',
    title: 'WebM to MP4',
    h1: 'Convert WebM to MP4',
    description:
      'Convert WebM to MP4 for screen recordings and Discord clips. VP8 or VP9 video is transcoded to H.264, with a progress bar and no length limit.',
    keywords: [
      'webm to mp4 converter',
      'vp9 to h264',
      'obs webm to mp4',
      'discord clip to mp4',
      'convert webm offline',
    ],
    category: 'media',
    icon: 'Video',
    accepts: ['webm'],
    faqs: [
      {
        q: 'Why is WebM to MP4 slower than MKV to MP4?',
        a: 'It is a full transcode. WebM holds VP8 or VP9 video, which MP4 players do not read, so every frame is decoded and encoded again as H.264. There is no shortcut: a site that converts WebM to MP4 in a second has only renamed the file.',
      },
      {
        q: 'How long will a 10-minute screen recording take?',
        a: 'About 8-15 minutes on a modern laptop at the default settings, and the progress bar shows the percentage. Screen recordings compress well because most of the frame does not move, so “small file” loses little visible quality and finishes faster.',
      },
      {
        q: 'Why does my WebM have no sound after converting?',
        a: 'WebM audio is Opus or Vorbis, and both are re-encoded to AAC here. If the result is silent, the source recording had no audio track at all, which is common when a screen recorder was started without the “share audio” checkbox ticked.',
      },
      {
        q: 'Why will my browser-recorded WebM not seek?',
        a: 'MediaRecorder writes WebM files with no duration in the header, so players cannot scrub them. Converting rebuilds the file and the timeline works again. For this reason, convert a browser recording before you share it.',
      },
    ],
    related: ['mp4-to-webm', 'screen-recorder', 'webm-to-mp3', 'compress-video', 'mkv-to-mp4'],
    updated: UPDATED,
  },
  {
    slug: 'mp4-to-webm',
    title: 'MP4 to WebM',
    h1: 'Convert MP4 to WebM',
    description:
      'Convert MP4 to WebM with VP8 video and Opus audio for the HTML5 video element. Encoding uses constant quality (CRF) and takes about real time for 720p.',
    keywords: [
      'mp4 to webm converter',
      'h264 to vp8',
      'webm for website',
      'html5 video webm',
      'convert mp4 webm free',
    ],
    category: 'media',
    icon: 'Globe',
    accepts: ['mp4', 'mov', 'm4v'],
    faqs: [
      {
        q: 'Is WebM smaller than MP4?',
        a: 'Not here. This page encodes WebM with VP8, which needs about the same size as H.264 for the same quality. Use WebM when a player or site asks for it. For the smallest file, use MP4.',
      },
      {
        q: 'Why does this take so much longer than converting to MP4?',
        a: 'Every frame is re-encoded to VP8 on your CPU, with no hardware acceleration. Expect about real time for 720p: a one-minute clip takes about a minute. Trim first if you only need part of it.',
      },
      {
        q: 'Which browsers play WebM?',
        a: 'Chrome, Edge, Firefox and Opera have played VP8 WebM for years, and current Safari plays it too. Older iOS devices and smart TVs are the gap, so list WebM first and MP4 second in a <video> element.',
      },
      {
        q: 'Can I control the file size directly?',
        a: 'No. This page uses constant-quality (CRF) encoding, which sets the quality and lets the size vary. To get a specific size, use the compress-video tool, which targets a bitrate.',
      },
    ],
    related: ['webm-to-mp4', 'compress-video', 'video-converter', 'gif-to-mp4', 'resize-video'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ *
   * Audio extraction
   * ------------------------------------------------------------------ */
  {
    slug: 'mp4-to-mp3',
    title: 'MP4 to MP3',
    h1: 'Convert MP4 to MP3',
    description:
      'Convert MP4 to MP3: extract the soundtrack from a video at up to 320 kbps. Add many files at once and download them one by one or as a ZIP.',
    keywords: [
      'mp4 to mp3 converter',
      'extract audio from mp4',
      'video to mp3 320kbps',
      'mp4 audio only',
      'batch mp4 to mp3',
    ],
    category: 'media',
    icon: 'Music',
    popular: true,
    accepts: ['mp4', 'm4v', 'mov'],
    faqs: [
      {
        q: 'Does converting to MP3 lose quality?',
        a: 'A little. MP4 video normally carries AAC audio, and AAC to MP3 is a second lossy compression. What the first compression removed cannot come back. At 192 kbps the difference is inaudible on most material, and at 320 kbps on all of it. For no second loss, extract to M4A with the audio converter.',
      },
      {
        q: 'Which bitrate should I choose?',
        a: 'For music, use 192 kbps, or 320 kbps for the maximum. For a lecture, podcast or interview, 128 kbps or 96 kbps mono halves the file, because speech does not need more.',
      },
      {
        q: 'Can I convert several videos at once?',
        a: 'Yes. Drop in as many as you like. They run one after another with a progress bar each, and you download them one by one or as a single ZIP. There is no daily limit.',
      },
      {
        q: 'Does it keep the artist and title tags?',
        a: 'No. The MP3 is written with no ID3 metadata at all, which also means no stray tags from the source file travel with it. Add tags afterwards in your music player if you need them.',
      },
    ],
    related: ['mkv-to-mp3', 'webm-to-mp3', 'video-to-mp3', 'audio-converter', 'trim-audio'],
    updated: UPDATED,
  },
  {
    slug: 'mkv-to-mp3',
    title: 'MKV to MP3',
    h1: 'Convert MKV to MP3',
    description:
      'Convert MKV to MP3: extract the audio of concerts, lectures and recordings. Reads FLAC, DTS, AC-3, Opus and AAC tracks, with bitrate control.',
    keywords: [
      'mkv to mp3 converter',
      'extract audio from mkv',
      'matroska audio',
      'mkv soundtrack',
      'mkv to mp3 batch',
    ],
    category: 'media',
    icon: 'FileAudio',
    accepts: ['mkv', 'webm'],
    faqs: [
      {
        q: 'Which audio track is used when my MKV has several?',
        a: 'The first audio stream, which is the default track in nearly every file. This page has no stream mapping to pick a language track. For another track, use a desktop tool.',
      },
      {
        q: 'The MKV holds FLAC or DTS audio. Will that work?',
        a: 'Yes. FFmpeg decodes FLAC, DTS, AC-3, Opus, Vorbis and AAC alike, then re-encodes to MP3. Converting lossless FLAC to MP3 does lose data by definition, so pick 320 kbps if the source was lossless and the result matters.',
      },
      {
        q: 'Why is the MP3 so much smaller than the MKV?',
        a: 'The video, typically 95% of the file, is removed. A 4 GB film with a two-hour soundtrack becomes about 170 MB at 192 kbps.',
      },
      {
        q: 'Is anything uploaded while it works?',
        a: 'No. The FFmpeg build that decodes the file is WebAssembly from this site and runs in the tab. After the engine loads once, conversions also work in offline mode.',
      },
    ],
    related: ['mp4-to-mp3', 'mkv-to-mp4', 'avi-to-mp3', 'audio-converter', 'extract-audio-from-video'],
    updated: UPDATED,
  },
  {
    slug: 'avi-to-mp3',
    title: 'AVI to MP3',
    h1: 'Convert AVI to MP3',
    description:
      'Convert AVI to MP3: extract the audio from old AVI video, choose the bitrate and convert a whole folder of files into one ZIP download.',
    keywords: [
      'avi to mp3 converter',
      'extract audio from avi',
      'old video audio rip',
      'avi soundtrack mp3',
      'convert avi audio',
    ],
    category: 'media',
    icon: 'AudioLines',
    accepts: ['avi', 'divx'],
    faqs: [
      {
        q: 'Is it lossless when the AVI already contains MP3 audio?',
        a: 'No. This page decodes the audio and encodes it again with LAME, which adds a second loss. At 320 kbps the difference is too small to hear. For a lossless copy of an embedded MP3 stream, use a desktop tool.',
      },
      {
        q: 'Why does my old AVI produce a silent MP3?',
        a: 'Some AVI files from the 2000s use audio codecs that were never standardised: proprietary ACM codecs that no modern decoder includes. If the result is silent, the page tells you.',
      },
      {
        q: 'Can I convert a whole folder of AVI files?',
        a: 'Yes. Drop them all in at once. They convert one after another with a progress row each, and you get one ZIP download at the end.',
      },
      {
        q: 'How large can the AVI be?',
        a: 'Audio extraction is one of the lighter jobs FFmpeg does, so multi-gigabyte AVI files are usually fine on a desktop. The limit is the memory of your device.',
      },
    ],
    related: ['avi-to-mp4', 'mp4-to-mp3', 'mkv-to-mp3', 'audio-converter', 'video-to-mp3'],
    updated: UPDATED,
  },
  {
    slug: 'webm-to-mp3',
    title: 'WebM to MP3',
    h1: 'Convert WebM to MP3',
    description:
      'Convert WebM to MP3 for players and car stereos that do not play WebM. Works with WebM video, .weba audio and browser voice recordings.',
    keywords: [
      'webm to mp3 converter',
      'opus to mp3',
      'webm audio extract',
      'convert webm sound',
      'webm mp3 batch',
    ],
    category: 'media',
    icon: 'Headphones',
    accepts: ['webm', 'weba'],
    faqs: [
      {
        q: 'What is inside a WebM audio track?',
        a: 'Almost always Opus, sometimes Vorbis. Opus is more efficient than MP3 at every bitrate, so you convert only for compatibility. Use 192 kbps or higher so the second compression stays inaudible.',
      },
      {
        q: 'Will this work on a .weba file?',
        a: 'Yes. A .weba file is a WebM container with only an audio stream. The tool handles it the same way, with no video to remove.',
      },
      {
        q: 'Can I convert a browser voice recording?',
        a: 'Yes. Voice notes recorded by a web app are usually WebM/Opus, and many transcription services, DAWs and phones need MP3 or WAV. Mono at 96-128 kbps is enough for speech and halves the file.',
      },
      {
        q: 'Does the length of the file matter?',
        a: 'Only for the time it takes. There is no length limit. A two-hour recording works and takes proportionally longer.',
      },
    ],
    related: ['webm-to-mp4', 'mp4-to-mp3', 'screen-recorder', 'audio-converter', 'trim-audio'],
    updated: UPDATED,
  },

  /* ------------------------------------------------------------------ *
   * Editing
   * ------------------------------------------------------------------ */
  {
    slug: 'crop-video',
    title: 'Crop Video',
    h1: 'Crop a video online',
    description:
      'Crop video by dragging a box over the picture. Presets for 9:16, 1:1 and 4:5, and a button that finds and removes black bars.',
    keywords: [
      'crop video online',
      'crop mp4',
      'video aspect ratio crop',
      'remove black bars video',
      'crop video for instagram',
    ],
    category: 'media',
    icon: 'Crop',
    accepts: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
    faqs: [
      {
        q: 'Does cropping re-encode the video?',
        a: 'Yes. Cropping changes the picture, so every frame is decoded, cut and compressed again as H.264. The quality setting controls how much detail stays. At the default CRF 23 the loss is not visible in normal viewing.',
      },
      {
        q: 'How do I crop for TikTok, Reels or Shorts?',
        a: 'Choose the 9:16 preset. The rectangle locks to that shape, fills as much of the frame as it can and centres itself. Then drag it to frame the subject. The exported MP4 is a vertical video with no black bars.',
      },
      {
        q: 'What does “remove black bars” actually do?',
        a: 'It runs the FFmpeg cropdetect filter on the first few seconds of your clip. The filter measures where the picture stops being black, and the tool sets the rectangle to that area. Check the edges before you export, especially on a clip that starts with a fade from black.',
      },
      {
        q: 'Can I crop without using a mouse?',
        a: 'Yes. The four number fields set the crop in exact source pixels, and the rectangle itself is focusable: arrow keys move it a pixel at a time, Shift plus arrow moves it ten, and Alt plus arrow resizes it.',
      },
      {
        q: 'Why are the width and height rounded to even numbers?',
        a: 'H.264 stores colour at half resolution (4:2:0 chroma subsampling), so an odd width or height cannot be encoded. The tool rounds down by one pixel, so FFmpeg does not fail with an error.',
      },
    ],
    related: ['rotate-video', 'resize-video', 'trim-video', 'merge-videos', 'compress-video'],
    updated: UPDATED,
  },
  {
    slug: 'rotate-video',
    title: 'Rotate Video',
    h1: 'Rotate a video',
    description:
      'Rotate video 90° or 180° to fix sideways phone footage. One method changes the rotation flag in seconds, the other redraws every frame.',
    keywords: [
      'rotate video online',
      'fix sideways video',
      'rotate mp4 90 degrees',
      'turn video upright',
      'rotate iphone video',
    ],
    category: 'media',
    icon: 'RotateCw',
    accepts: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
    faqs: [
      {
        q: 'Why is my video sideways in the first place?',
        a: 'Phones always record landscape frames and add a rotation flag that tells players how to show them. Photo apps use the flag, but many upload forms, editors and TVs ignore it, so your portrait clip shows on its side. The footage itself is correct.',
      },
      {
        q: 'What is the difference between the two methods?',
        a: 'Rewriting the flag copies the audio and video streams unchanged and changes one metadata field. It finishes in seconds, even on a 2 GB file, and loses nothing. Baking it in decodes every frame, turns it and encodes it again. This is slower and slightly lossy, but it works in every player, also old ones.',
      },
      {
        q: 'Which one should I pick?',
        a: 'Start with the flag. If the video is still sideways in the app that had the problem, bake the rotation in. That always works, because there is no flag left to ignore.',
      },
      {
        q: 'Why is the flag option unavailable for my file?',
        a: 'A rotation flag only exists in MP4, MOV and 3GP containers. WebM, MKV and AVI have no equivalent, so those files are always baked and the result comes out as an MP4.',
      },
      {
        q: 'Does rotating change the resolution?',
        a: 'A quarter turn swaps width and height: 1920×1080 becomes 1080×1920. A 180° turn keeps the dimensions. The page shows the exact result before you press the button.',
      },
    ],
    related: ['flip-video', 'crop-video', 'resize-video', 'trim-video', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'flip-video',
    title: 'Flip Video',
    h1: 'Flip or mirror a video',
    description:
      'Flip a video horizontally or vertically, for example to un-mirror a selfie or webcam clip, and export the result as an H.264 MP4.',
    keywords: [
      'flip video online',
      'mirror video',
      'unmirror selfie video',
      'flip video horizontally',
      'reverse mirror webcam',
    ],
    category: 'media',
    icon: 'FlipHorizontal',
    accepts: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
    faqs: [
      {
        q: 'What is the difference between flipping and rotating?',
        a: 'Rotating turns the picture around its centre. Flipping mirrors it, so left becomes right and text in the frame reads backwards. To fix a sideways clip, use rotation.',
      },
      {
        q: 'Why does my webcam video look mirrored?',
        a: 'Video-call apps mirror your own preview so that moving left on screen matches moving left in real life. Some of them record the mirrored preview, so writing in the shot is backwards. A horizontal flip corrects it.',
      },
      {
        q: 'Does flipping lose quality?',
        a: 'A mirror is a lossless operation on the pixels, but it cannot be done without re-encoding, so the H.264 compression runs a second time. At the default quality the difference is not visible. Choose “high quality” if you will edit the clip again.',
      },
      {
        q: 'Can I flip and rotate in one pass?',
        a: 'No. This page does one transform at a time, so the preview shows the exact result. For both, run the file through the rotate tool after. The second pass adds one more re-encode.',
      },
    ],
    related: ['rotate-video', 'crop-video', 'video-speed-changer', 'trim-video', 'mute-video'],
    updated: UPDATED,
  },
  {
    slug: 'video-speed-changer',
    title: 'Video Speed Changer',
    h1: 'Change video speed',
    description:
      'Change video speed from 0.25× to 4× with a live preview. The audio changes tempo but keeps its pitch, so voices stay in tune.',
    keywords: [
      'change video speed',
      'speed up video online',
      'slow motion video',
      'video timelapse converter',
      '2x video speed',
    ],
    category: 'media',
    icon: 'Gauge',
    accepts: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
    faqs: [
      {
        q: 'Does speeding up the audio make everyone sound like a chipmunk?',
        a: 'No. The audio goes through the FFmpeg atempo filter, which changes the tempo and keeps the pitch, as podcast apps do for 1.5× playback. Voices stay in tune and clear.',
      },
      {
        q: 'Why is slow motion stuttery?',
        a: 'Slowing a clip down shows the same frames for a longer time. It cannot add new frames. A 30 fps clip at 0.25× plays at an effective 7.5 fps. For smooth slow motion, record at a high frame rate: 60, 120 or 240 fps.',
      },
      {
        q: 'How is the new length calculated?',
        a: 'New length = original length ÷ speed, and the page shows the calculation with your numbers. At 2× a 6-minute clip becomes 3 minutes. At 0.5× it becomes 12.',
      },
      {
        q: 'Why is 4× two filter stages instead of one?',
        a: 'The atempo filter accepts only factors between 0.5 and 2.0 in one pass, so other factors use a chain: 4× is atempo=2 followed by atempo=2. The page shows the chain for your setting.',
      },
      {
        q: 'Can I make a timelapse from a long video?',
        a: 'Yes. Set 4×, and run it again if you need more. No frames are dropped, so a long clip still takes time to encode.',
      },
    ],
    related: ['trim-video', 'crop-video', 'mute-video', 'compress-video', 'video-to-gif'],
    updated: UPDATED,
  },
  {
    slug: 'merge-videos',
    title: 'Merge Videos',
    h1: 'Merge videos into one file',
    description:
      'Merge videos into one file and drag the clips into order. Clips with the same codec and size join without re-encoding. Others are scaled to match.',
    keywords: [
      'merge videos online',
      'combine mp4 files',
      'join video clips',
      'concatenate video',
      'video merger free',
    ],
    category: 'media',
    icon: 'Combine',
    accepts: ['mp4', 'mov', 'webm', 'mkv', 'avi'],
    faqs: [
      {
        q: 'Why are some merges instant and others slow?',
        a: 'If every clip has the same codec, resolution and audio type, as is normal for clips from one camera or phone, FFmpeg joins the packets without decoding. If you mix a 4K phone clip with a 720p screen recording, all clips must be scaled to one size and encoded again.',
      },
      {
        q: 'What happens to clips of different shapes?',
        a: 'They are scaled to fit the largest frame size in the set and padded with black, so nothing is stretched. The page lists each clip with its codec and resolution before it starts.',
      },
      {
        q: 'One of my clips has no sound. Does that break the merge?',
        a: 'No. The tool adds silence of the same length as that clip, so the audio stays in sync with the picture for all the clips after it. Without this step, the soundtrack would run ahead of the video.',
      },
      {
        q: 'How many videos can I join?',
        a: 'As many as your device can hold in memory at once. There is no file limit and no paid version. For very large sets, merge a few at a time and then merge the results, which uses less memory.',
      },
      {
        q: 'Can I reorder the clips?',
        a: 'Yes. Drag a row into place, or use the arrow buttons on each row to reorder with the keyboard. The final video follows the order of the list, top to bottom.',
      },
    ],
    related: ['trim-video', 'crop-video', 'compress-video', 'video-converter', 'audio-converter'],
    updated: UPDATED,
  },
  {
    slug: 'gif-to-mp4',
    title: 'GIF to MP4',
    h1: 'Convert GIF to MP4',
    description:
      'Convert GIF to MP4 for Discord, WhatsApp and Twitter. The MP4 is often 10 to 50 times smaller, and a silent audio track lets iOS autoplay it.',
    keywords: [
      'gif to mp4 converter',
      'gif to video',
      'compress gif as mp4',
      'discord gif too big',
      'animated gif to mp4',
    ],
    category: 'media',
    icon: 'Repeat',
    accepts: ['gif'],
    faqs: [
      {
        q: 'Why is the MP4 so much smaller than the GIF?',
        a: 'GIF, a format from 1989, stores every frame as a separate 256-colour image with no motion compression. H.264 stores the differences between frames. An MP4 ten to fifty times smaller is normal, and it usually looks better because it is not limited to 256 colours.',
      },
      {
        q: 'What is the silent audio track for?',
        a: 'iOS Safari and some chat clients do not autoplay a video that has no audio stream. A silent AAC track adds a few kilobytes and makes the clip play like the GIF. It is on by default.',
      },
      {
        q: 'Will the MP4 loop like the GIF did?',
        a: 'The player decides, because MP4 has no loop flag. Twitter, Discord and an HTML <video loop> element loop it. Where a platform plays a video only once, use the repeat option to write the animation into the file several times.',
      },
      {
        q: 'Does frame timing survive?',
        a: 'Yes, if you keep the default “source timing”. A GIF stores a delay per frame and FFmpeg honours it, so an animation with deliberate pauses keeps them. Forcing a fixed frame rate resamples the timing and can subtly change the pacing.',
      },
    ],
    related: ['video-to-gif', 'mp4-to-webm', 'compress-video', 'crop-video', 'video-converter'],
    updated: UPDATED,
  },
  {
    slug: 'screen-recorder',
    title: 'Screen Recorder',
    h1: 'Record your screen online',
    description:
      'Screen recorder for a screen, window or tab, with microphone and system audio. Saves WebM or MP4 with no watermark and no time limit.',
    keywords: [
      'screen recorder online',
      'record screen no watermark',
      'browser screen recording',
      'record tab with audio',
      'free screen capture',
    ],
    category: 'media',
    icon: 'ScreenShare',
    popular: true,
    faqs: [
      {
        q: 'Is my screen recording uploaded anywhere?',
        a: 'No. The frames go from the browser capture API into memory in this tab and then into the file you save. No server is involved: open the Network panel of the developer tools while you record and nothing is sent.',
      },
      {
        q: 'Is there a time limit or a watermark?',
        a: 'No. Only the memory of your device limits the recording, because the whole capture is kept there until you save it. Watch the size counter on long sessions. At the balanced quality preset, expect about 30 MB per minute.',
      },
      {
        q: 'How do I record the sound from a tab or from my computer?',
        a: 'In Chrome and Edge, tick “Share tab audio” when you pick a tab, or “Share system audio” when you pick a whole screen on Windows. Firefox and Safari cannot capture system audio. Your microphone works in every browser that supports the recorder.',
      },
      {
        q: 'Why is the file a WebM, and should I convert it?',
        a: 'Browsers record WebM natively. It plays in browsers and VLC, but MediaRecorder leaves the duration out of the header, so scrubbing often does not work, and many editors and iPhones need MP4. The convert button re-encodes to H.264 MP4 with FFmpeg on this page and fixes the header. Recent Chrome versions can record MP4 directly, and then the page offers that option first.',
      },
      {
        q: 'Does it work on a phone?',
        a: 'No. Mobile browsers do not expose the screen-capture API, on iOS or on Android. Use the recorder built into your phone, then bring the file back here to crop, trim, rotate or convert it.',
      },
    ],
    related: ['webm-to-mp4', 'crop-video', 'trim-video', 'compress-video', 'mp4-to-mp3'],
    updated: UPDATED,
  },
]
