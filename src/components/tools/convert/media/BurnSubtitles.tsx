/**
 * Burns an SRT, VTT or ASS subtitle file into a video with FFmpeg's subtitle renderer.
 * The renderer needs a font file in its virtual file system: the page ships one (Liberation
 * Sans Bold, SIL Open Font License) and writes it next to the subtitles.
 */
import { useState } from 'react'
import { Captions } from 'lucide-react'
import fontUrl from 'pdfjs-dist/standard_fonts/LiberationSans-Bold.ttf?url'
import { Button } from '@/components/ui/button'
import { FileDropzone } from '@/components/shared/FileDropzone'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { stripExtension } from '@/lib/utils'
import { getEngine, inputName } from '@/components/tools/media/_ffmpeg'
import { EngineNotice, JobError, JobStatus, ResultPanel, SelectField, SourceSummary, useMediaJob, useSourceFile } from '@/components/tools/media/_shared'
import { VIDEO_ACCEPT } from '@/components/tools/media/video-shared'

const SIZES = [
  { value: '16', label: 'Small' },
  { value: '22', label: 'Medium' },
  { value: '30', label: 'Large' },
]
const POSITIONS = [
  { value: '2', label: 'Bottom' },
  { value: '8', label: 'Top' },
]

/** The ASS style override, quoted so the commas inside stay part of one filter option. */
export function subtitleFilter(subs: string, size: number, alignment: number, box: boolean): string {
  const style = [
    'FontName=Liberation Sans',
    'Bold=1',
    `FontSize=${size}`,
    `Alignment=${alignment}`,
    'MarginV=20',
    'PrimaryColour=&H00FFFFFF',
    'OutlineColour=&H00000000',
    box ? 'BorderStyle=3,Outline=1,BackColour=&H80000000' : 'BorderStyle=1,Outline=2',
    'Shadow=0',
  ].join(',')
  return `subtitles=${subs}:fontsdir=fonts:force_style='${style}'`
}

export default function BurnSubtitles() {
  const video = useSourceFile('video')
  const job = useMediaJob()
  const [subs, setSubs] = useState<File | null>(null)
  const [size, setSize] = useState('22')
  const [position, setPosition] = useState('2')
  const [box, setBox] = useState('outline')

  const file = video.file
  const start = () => {
    if (!file || !subs) return
    const input = inputName(file)
    const subExt = (subs.name.split('.').pop() ?? 'srt').toLowerCase().replace(/[^a-z]/g, '') || 'srt'
    const subName = `subs.${subExt}`
    void job.run(async () => {
      const ffmpeg = await getEngine()
      try {
        await ffmpeg.createDir('fonts')
      } catch {
        /* already there */
      }
      const font = await (await fetch(fontUrl)).blob()
      return {
        inputs: [
          { name: input, data: file },
          { name: subName, data: subs },
          { name: 'fonts/LiberationSans-Bold.ttf', data: font },
        ],
        commands: [
          [
            '-i',
            input,
            '-vf',
            subtitleFilter(subName, Number(size), Number(position), box === 'box'),
            '-c:v',
            'libx264',
            '-preset',
            'veryfast',
            '-crf',
            '22',
            '-pix_fmt',
            'yuv420p',
            '-c:a',
            'aac',
            '-b:a',
            '160k',
            '-movflags',
            '+faststart',
            'output.mp4',
          ],
        ],
        output: 'output.mp4',
        mime: 'video/mp4',
        filename: `${stripExtension(file.name)}-subtitled.mp4`,
        durationSec: video.info?.duration || undefined,
        inputBytes: file.size + subs.size,
      }
    })
  }

  const reset = () => {
    job.reset()
    video.clear()
    setSubs(null)
  }

  return (
    <div className="space-y-4">
      {file ? (
        <SourceSummary file={file} duration={video.info?.duration} width={video.info?.width} height={video.info?.height} onClear={reset} />
      ) : (
        <FileDropzone accept={VIDEO_ACCEPT} onFiles={video.select} maxSizeMb={2048} title="1. Drop the video" hint="MP4, MOV, MKV, WebM and more" />
      )}
      {subs ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-card p-3">
          <p className="min-w-0 truncate text-sm font-medium">{subs.name}</p>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSubs(null)}>
            Choose other subtitles
          </Button>
        </div>
      ) : (
        <FileDropzone accept=".srt,.vtt,.ass,.ssa" onFiles={(f) => setSubs(f[0] ?? null)} title="2. Drop the subtitle file" hint="SRT, VTT or ASS" />
      )}

      <ToolPanel
        title="Style"
        footer={
          <Button type="button" onClick={start} disabled={!file || !subs || job.busy} className="w-full sm:w-auto">
            <Captions className="size-4" aria-hidden="true" />
            {job.busy ? 'Burning in…' : 'Burn in the subtitles'}
          </Button>
        }
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField label="Text size" value={size} onChange={setSize} options={SIZES} />
          <SelectField label="Position" value={position} onChange={setPosition} options={POSITIONS} />
          <SelectField
            label="Background"
            value={box}
            onChange={setBox}
            options={[
              { value: 'outline', label: 'Black outline' },
              { value: 'box', label: 'Dark box' },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground">ASS files keep their own styles. Sizes are relative to a 288-pixel-high frame, so they scale with the video.</p>
      </ToolPanel>

      <JobStatus job={job} label="Burning in subtitles" />
      <JobError job={job} onRetry={start} />
      {job.result ? <ResultPanel result={job.result} kind="video" downloadLabel="Download MP4" resetLabel="Start again" onReset={reset} /> : <EngineNotice />}
    </div>
  )
}
