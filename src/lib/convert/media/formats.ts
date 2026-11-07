/** Audio and video containers, and the format pair pages built from them. */

export type AudioFmt = 'mp3' | 'wav' | 'ogg' | 'opus' | 'm4a' | 'aac' | 'flac' | 'wma' | 'aiff' | 'amr'
export type VideoFmt = 'mp4' | 'mov' | 'mkv' | 'webm' | 'avi' | 'wmv' | 'flv' | '3gp' | 'm4v' | 'mts' | 'm2ts' | 'ts' | 'mpeg' | 'vob' | 'ogv'
export type MediaFmt = AudioFmt | VideoFmt | 'gif'

export interface MediaInfo {
  label: string
  kind: 'audio' | 'video' | 'image'
  ext: string[]
  mime: string
  /** Codecs the container usually holds. */
  codecs: string
  about: string
  plays: string
}

export const MEDIA: Record<MediaFmt, MediaInfo> = {
  mp3: { label: 'MP3', kind: 'audio', ext: ['mp3'], mime: 'audio/mpeg', codecs: 'MPEG-1 Layer III, lossy', about: 'MP3 has been the common format for music files since the late 1990s. At 192 kbps most listeners cannot tell it from a CD.', plays: 'Every phone, computer, car stereo and browser' },
  wav: { label: 'WAV', kind: 'audio', ext: ['wav', 'wave'], mime: 'audio/wav', codecs: 'PCM, uncompressed', about: 'WAV usually stores uncompressed PCM samples, so it is lossless and large: about 10 MB per minute of CD-quality stereo.', plays: 'Every computer, audio editor and browser' },
  ogg: { label: 'OGG', kind: 'audio', ext: ['ogg', 'oga'], mime: 'audio/ogg', codecs: 'Vorbis or Opus, lossy', about: 'Ogg is an open container, usually with Vorbis audio. Games and open-source software use it often.', plays: 'Browsers, Android and most desktop players; not all car stereos' },
  opus: { label: 'Opus', kind: 'audio', ext: ['opus'], mime: 'audio/ogg', codecs: 'Opus, lossy', about: 'Opus is the newest common audio codec. It gives good speech at 24 kbps and good music at 96 to 128 kbps, and voice messages use it.', plays: 'Browsers and Android; some older players cannot' },
  m4a: { label: 'M4A', kind: 'audio', ext: ['m4a', 'm4b'], mime: 'audio/mp4', codecs: 'AAC or ALAC in an MP4 container', about: 'M4A is an MP4 file with only audio, usually AAC. AAC sounds better than MP3 at the same bitrate.', plays: 'Phones, computers and browsers' },
  aac: { label: 'AAC', kind: 'audio', ext: ['aac', 'adts'], mime: 'audio/aac', codecs: 'AAC in a raw ADTS stream', about: 'A .aac file is a raw stream of AAC frames with no container. Radio streams and some recorders use it.', plays: 'Most phones and players; some programs prefer M4A' },
  flac: { label: 'FLAC', kind: 'audio', ext: ['flac'], mime: 'audio/flac', codecs: 'FLAC, lossless', about: 'FLAC compresses audio without losing anything, usually to 50 to 60% of the WAV size. Music archives and high-resolution downloads use it.', plays: 'Phones, computers and browsers; some car stereos cannot' },
  wma: { label: 'WMA', kind: 'audio', ext: ['wma'], mime: 'audio/x-ms-wma', codecs: 'Windows Media Audio, lossy', about: 'WMA is an older lossy audio format from desktop media software. Many phones and browsers no longer play it.', plays: 'Windows players; few phones and no common browser' },
  aiff: { label: 'AIFF', kind: 'audio', ext: ['aiff', 'aif', 'aifc'], mime: 'audio/aiff', codecs: 'PCM, uncompressed (big-endian)', about: 'AIFF stores uncompressed PCM like WAV, with byte order and metadata from desktop music software.', plays: 'Audio editors and desktop players; few browsers' },
  amr: { label: 'AMR', kind: 'audio', ext: ['amr', '3ga'], mime: 'audio/amr', codecs: 'AMR-NB or AMR-WB speech codec', about: 'AMR is a speech codec from mobile phone networks. Call and voice recorders on older phones save AMR files.', plays: 'Some phones; most computers and browsers cannot' },
  mp4: { label: 'MP4', kind: 'video', ext: ['mp4'], mime: 'video/mp4', codecs: 'H.264 or H.265 video, AAC audio', about: 'MP4 is the most common video format. H.264 video with AAC audio in MP4 plays on almost every device.', plays: 'Every phone, computer, TV and browser' },
  mov: { label: 'MOV', kind: 'video', ext: ['mov', 'qt'], mime: 'video/quicktime', codecs: 'H.264, H.265 or ProRes video, AAC audio', about: 'MOV is the QuickTime container. Phones and cameras record it, and it is close to MP4 inside.', plays: 'Phones, computers and video editors; some browsers and TVs cannot' },
  mkv: { label: 'MKV', kind: 'video', ext: ['mkv'], mime: 'video/x-matroska', codecs: 'Any video and audio, subtitles, chapters', about: 'Matroska (MKV) is an open container that holds almost any codec, several audio tracks and subtitles.', plays: 'Media players and some TVs; many phones and editors cannot' },
  webm: { label: 'WebM', kind: 'video', ext: ['webm'], mime: 'video/webm', codecs: 'VP8, VP9 or AV1 video, Opus or Vorbis audio', about: 'WebM is an open web video format based on Matroska, with royalty-free codecs.', plays: 'Browsers and Android; some editors and older devices cannot' },
  avi: { label: 'AVI', kind: 'video', ext: ['avi'], mime: 'video/x-msvideo', codecs: 'MPEG-4 Part 2 (Xvid, DivX) or other, MP3 audio', about: 'AVI is a container from 1992. Old cameras, DVD players and video software still use it.', plays: 'Desktop players, DVD players and old software; not browsers' },
  wmv: { label: 'WMV', kind: 'video', ext: ['wmv', 'asf'], mime: 'video/x-ms-wmv', codecs: 'Windows Media Video, WMA audio', about: 'WMV is an older desktop video format in an ASF container. Old presentations and recordings use it.', plays: 'Windows players; few phones and no common browser' },
  flv: { label: 'FLV', kind: 'video', ext: ['flv', 'f4v'], mime: 'video/x-flv', codecs: 'H.264 or Sorenson video, AAC or MP3 audio', about: 'FLV was the video format of browser plug-ins until the 2010s. Old downloads and live streaming servers still use it.', plays: 'Media players only; browsers no longer play it' },
  '3gp': { label: '3GP', kind: 'video', ext: ['3gp', '3g2'], mime: 'video/3gpp', codecs: 'H.263 or H.264 video, AMR or AAC audio', about: '3GP is a small MP4-like format from early camera phones.', plays: 'Some phones and media players; many browsers cannot' },
  m4v: { label: 'M4V', kind: 'video', ext: ['m4v'], mime: 'video/x-m4v', codecs: 'H.264 video, AAC audio', about: 'M4V is an MP4 file with a different extension, used by some video stores and media software. Files without copy protection convert without re-encoding.', plays: 'Most players; some programs want the .mp4 extension' },
  mts: { label: 'MTS', kind: 'video', ext: ['mts'], mime: 'video/mp2t', codecs: 'H.264 video, AC-3 audio (AVCHD)', about: 'MTS files come from AVCHD camcorders: H.264 video in an MPEG transport stream, often with Dolby Digital sound.', plays: 'Video editors and some players; not phones or browsers' },
  m2ts: { label: 'M2TS', kind: 'video', ext: ['m2ts'], mime: 'video/mp2t', codecs: 'H.264 video, AC-3 or LPCM audio', about: 'M2TS is the transport stream format of Blu-ray discs and AVCHD camcorders.', plays: 'Video editors and some players; not phones or browsers' },
  ts: { label: 'TS', kind: 'video', ext: ['ts'], mime: 'video/mp2t', codecs: 'H.264 or MPEG-2 video, AAC, MP2 or AC-3 audio', about: 'A transport stream (.ts) is what TV broadcasts, recorders and streaming segments use.', plays: 'Media players; most phones and editors want MP4' },
  mpeg: { label: 'MPEG', kind: 'video', ext: ['mpg', 'mpeg', 'mpe'], mime: 'video/mpeg', codecs: 'MPEG-1 or MPEG-2 video, MP2 audio', about: 'MPEG program streams (.mpg) hold MPEG-1 or MPEG-2 video, the formats of Video CDs, DVDs and older cameras.', plays: 'Desktop players and DVD players; not most browsers' },
  vob: { label: 'VOB', kind: 'video', ext: ['vob'], mime: 'video/dvd', codecs: 'MPEG-2 video, AC-3 or MP2 audio', about: 'VOB files hold the video of a DVD. Each is limited to 1 GB, so a film is split into several.', plays: 'DVD software and media players' },
  ogv: { label: 'OGV', kind: 'video', ext: ['ogv'], mime: 'video/ogg', codecs: 'Theora video, Vorbis audio', about: 'OGV is Ogg video with the Theora codec. Wiki media archives and old open-source projects use it.', plays: 'Some browsers and media players' },
  gif: { label: 'GIF', kind: 'image', ext: ['gif'], mime: 'image/gif', codecs: '256-colour frames, no sound', about: 'An animated GIF is a sequence of frames with at most 256 colours each and no sound. It plays everywhere, including chats and email.', plays: 'Everywhere, including email and chat apps' },
}

export interface MediaPairSpec {
  slug: string
  from: MediaFmt
  to: MediaFmt
  keywords: string[]
  note: string
}

const p = (slug: string, from: MediaFmt, to: MediaFmt, keywords: string[], note: string): MediaPairSpec => ({ slug, from, to, keywords, note })

export const MEDIA_PAIRS: MediaPairSpec[] = [
  // audio to audio
  p('mp3-to-ogg', 'mp3', 'ogg', ['mp3 to vorbis'], 'MP3 to OGG re-encodes lossy audio, so choose 160 kbps or more to keep the quality.'),
  p('mp3-to-flac', 'mp3', 'flac', ['mp3 to lossless'], 'FLAC stores the decoded MP3 exactly. The file is larger but does not sound better than the MP3.'),
  p('mp3-to-m4a', 'mp3', 'm4a', ['mp3 to aac m4a', 'mp3 to itunes'], 'AAC in M4A works well for phone ringtones, podcasts and music libraries.'),
  p('mp3-to-aac', 'mp3', 'aac', ['convert mp3 to aac'], 'The result is a raw AAC stream. Choose MP3 to M4A if your player wants a container.'),
  p('mp3-to-opus', 'mp3', 'opus', ['convert mp3 to opus'], 'Opus keeps speech clear at very low bitrates, which suits voice messages and audiobooks.'),
  p('wav-to-flac', 'wav', 'flac', ['compress wav lossless'], 'FLAC is lossless: the samples are identical, at about half the size.'),
  p('flac-to-wav', 'flac', 'wav', ['decode flac', 'flac to pcm'], 'The FLAC is decoded to PCM without loss, for editors and devices that need WAV.'),
  p('wav-to-ogg', 'wav', 'ogg', ['wav to vorbis'], 'Ogg Vorbis makes WAV recordings about 10 times smaller.'),
  p('wav-to-m4a', 'wav', 'm4a', ['wav to aac m4a'], 'AAC at 192 kbps or more keeps music close to the original WAV.'),
  p('wav-to-aac', 'wav', 'aac', ['convert wav to aac'], 'The result is a raw AAC stream, about 7 times smaller than the WAV at 192 kbps.'),
  p('m4a-to-wav', 'm4a', 'wav', ['convert m4a to wav', 'voice memo to wav'], 'The AAC audio is decoded to uncompressed PCM for editors, samplers and transcription.'),
  p('ogg-to-wav', 'ogg', 'wav', ['oga to wav', 'vorbis to wav'], 'The Vorbis or Opus audio is decoded to uncompressed PCM.'),
  p('aac-to-wav', 'aac', 'wav', ['adts to wav'], 'The AAC stream is decoded to uncompressed PCM.'),
  p('wma-to-mp3', 'wma', 'mp3', ['convert wma', 'windows media audio to mp3'], 'MP3 plays on devices that have dropped WMA support.'),
  p('wma-to-wav', 'wma', 'wav', ['convert wma to wav'], 'The WMA is decoded to uncompressed PCM, which every editor opens.'),
  p('aiff-to-mp3', 'aiff', 'mp3', ['aif to mp3'], 'MP3 makes studio AIFF files about 7 times smaller at 192 kbps.'),
  p('aiff-to-wav', 'aiff', 'wav', ['aif to wav'], 'Both are uncompressed PCM, so the samples carry over exactly.'),
  p('wav-to-aiff', 'wav', 'aiff', ['wav to aif'], 'Both are uncompressed PCM, so the samples carry over exactly.'),
  p('m4a-to-flac', 'm4a', 'flac', ['alac to flac', 'm4a to lossless'], 'An ALAC M4A converts to FLAC without loss. An AAC M4A is stored exactly as decoded.'),
  p('flac-to-m4a', 'flac', 'm4a', ['flac to aac', 'flac to alac'], 'AAC at 256 kbps is a good size for phones while keeping the sound close to the FLAC.'),
  p('opus-to-wav', 'opus', 'wav', ['voice message to wav'], 'Opus voice notes become WAV files that any editor or transcription tool opens.'),
  p('amr-to-wav', 'amr', 'wav', ['3ga to wav', 'call recording to wav'], 'AMR speech is decoded to WAV at its original 8 or 16 kHz rate.'),
  p('m4a-to-ogg', 'm4a', 'ogg', ['convert m4a to ogg'], 'Ogg Vorbis suits games and open-source software that do not read AAC.'),
  p('webm-to-wav', 'webm', 'wav', ['webm audio to wav'], 'The sound track of the WebM file is decoded to uncompressed WAV.'),
  // video to audio
  p('mov-to-mp3', 'mov', 'mp3', ['mov audio to mp3', 'extract audio from mov'], 'Only the sound track is converted. The video is not decoded, so this is fast.'),
  p('wmv-to-mp3', 'wmv', 'mp3', ['extract audio from wmv'], 'The WMA sound of the WMV file becomes an MP3.'),
  p('flv-to-mp3', 'flv', 'mp3', ['extract audio from flv'], 'The sound track of the FLV file becomes an MP3.'),
  p('3gp-to-mp3', '3gp', 'mp3', ['extract audio from 3gp'], 'The AMR or AAC sound of the 3GP file becomes an MP3.'),
  p('m4v-to-mp3', 'm4v', 'mp3', ['extract audio from m4v'], 'The sound track of the M4V file becomes an MP3.'),
  p('mp4-to-wav', 'mp4', 'wav', ['extract wav from mp4', 'mp4 audio to wav'], 'The sound track becomes uncompressed WAV for editing or transcription.'),
  p('mov-to-wav', 'mov', 'wav', ['extract wav from mov'], 'The sound track becomes uncompressed WAV for editing or transcription.'),
  p('mp4-to-m4a', 'mp4', 'm4a', ['mp4 to aac audio', 'extract m4a'], 'When the MP4 has AAC sound, it is copied into the M4A without re-encoding.'),
  // video to video
  p('mov-to-gif', 'mov', 'gif', ['quicktime to gif', 'iphone video to gif'], 'A two-pass palette keeps colours accurate in the GIF.'),
  p('webm-to-gif', 'webm', 'gif', ['convert webm to gif'], 'A two-pass palette keeps colours accurate in the GIF.'),
  p('mkv-to-webm', 'mkv', 'webm', ['matroska to webm'], 'VP8, VP9 and Opus tracks are copied without re-encoding; other codecs are converted.'),
  p('wmv-to-mp4', 'wmv', 'mp4', ['convert wmv', 'windows media video to mp4'], 'Old WMV recordings become H.264 MP4 files that play on phones and in browsers.'),
  p('flv-to-mp4', 'flv', 'mp4', ['convert flv'], 'H.264 video in an FLV is copied into MP4 without re-encoding.'),
  p('3gp-to-mp4', '3gp', 'mp4', ['convert 3gp'], 'Old camera phone clips become MP4 files that play everywhere.'),
  p('m4v-to-mp4', 'm4v', 'mp4', ['convert m4v'], 'The streams are copied into an MP4 without re-encoding, which takes seconds.'),
  p('mts-to-mp4', 'mts', 'mp4', ['avchd to mp4', 'camcorder mts to mp4'], 'The H.264 video is copied; the AC-3 sound is converted to AAC for wider support.'),
  p('m2ts-to-mp4', 'm2ts', 'mp4', ['blu-ray m2ts to mp4'], 'The H.264 video is copied when possible; the sound is converted to AAC.'),
  p('ts-to-mp4', 'ts', 'mp4', ['transport stream to mp4', 'convert ts file'], 'H.264 and AAC streams are copied into MP4 without re-encoding.'),
  p('mpeg-to-mp4', 'mpeg', 'mp4', ['mpg to mp4', 'mpeg2 to mp4'], 'MPEG-1 and MPEG-2 video is re-encoded to H.264, usually much smaller.'),
  p('vob-to-mp4', 'vob', 'mp4', ['dvd vob to mp4', 'convert vob'], 'The MPEG-2 video of a DVD file is re-encoded to H.264 MP4.'),
  p('ogv-to-mp4', 'ogv', 'mp4', ['theora to mp4', 'convert ogv'], 'Theora video is re-encoded to H.264 MP4.'),
  p('mp4-to-avi', 'mp4', 'avi', ['convert mp4 to avi'], 'The AVI uses MPEG-4 Part 2 video and MP3 sound, which old players and DVD players read.'),
  p('mov-to-avi', 'mov', 'avi', ['quicktime to avi'], 'The AVI uses MPEG-4 Part 2 video and MP3 sound for old software.'),
  p('mp4-to-mkv', 'mp4', 'mkv', ['convert mp4 to mkv'], 'Matroska holds the same streams, so they are copied without re-encoding.'),
  p('mov-to-webm', 'mov', 'webm', ['quicktime to webm'], 'WebM with VP8 or VP9 and Opus suits web pages.'),
  p('webm-to-mov', 'webm', 'mov', ['convert webm to mov'], 'The MOV uses H.264 and AAC, which video editors import.'),
  p('mkv-to-mov', 'mkv', 'mov', ['matroska to quicktime'], 'H.264 tracks are copied into the MOV; other codecs are converted.'),
  p('mp4-to-wmv', 'mp4', 'wmv', ['convert mp4 to wmv'], 'The WMV uses Windows Media Video 8 and WMA, for old presentation software.'),
  p('mp4-to-flv', 'mp4', 'flv', ['convert mp4 to flv'], 'H.264 and AAC streams are copied into FLV for streaming servers that need it.'),
  p('mp4-to-3gp', 'mp4', '3gp', ['convert mp4 to 3gp'], 'The 3GP uses H.264 Baseline at a small size for basic phones.'),
  p('mp4-to-mpeg', 'mp4', 'mpeg', ['mp4 to mpg', 'mp4 to mpeg2'], 'The MPEG file uses MPEG-2 video and MP2 sound for DVD tools and old players.'),
  p('avi-to-webm', 'avi', 'webm', ['convert avi to webm'], 'WebM with VP8 and Opus plays in every browser.'),
  p('wmv-to-avi', 'wmv', 'avi', ['convert wmv to avi'], 'The AVI uses MPEG-4 Part 2 video and MP3 sound.'),
]

export const MEDIA_PAIR_BY_SLUG: Map<string, MediaPairSpec> = new Map(MEDIA_PAIRS.map((x) => [x.slug, x]))

export function mediaAccept(fmt: MediaFmt): string {
  const info = MEDIA[fmt]
  return [...info.ext.map((e) => `.${e}`), info.mime].join(',')
}
