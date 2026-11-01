import { useMemo, useState } from 'react'
import { VolumeX } from 'lucide-react'

import { FileDropzone } from '@/components/shared/FileDropzone'
import { ResultStat } from '@/components/shared/ResultStat'
import { ToolPanel } from '@/components/shared/ToolPanel'
import { Button } from '@/components/ui/button'
import { fileExtension, stripExtension } from '@/lib/utils'

import { inputName } from './_ffmpeg'
import {
  EngineNotice,
  JobError,
  JobStatus,
  MediaPreview,
  ResultPanel,
  SourceSummary,
  SwitchField,
  useMediaJob,
  useSourceFile,
} from './_shared'

const ACCEPT = '.mp4,.webm,.mkv,.mov,.avi,.m4v,.mpg,.mpeg,.3gp,.ogv,video/*'

const COPY_CONTAINERS = new Set(['mp4', 'm4v', 'mov', 'mkv', 'webm', 'avi'])

const MIME_BY_EXT: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
}

export default function MuteVideo() {
  const source = useSourceFile('video')
  const job = useMediaJob()
  const [stripMetadata, setStripMetadata] = useState(false)
  const [forceEncode, setForceEncode] = useState(false)

  const file = source.file
  const duration = source.info?.duration ?? 0
  const ext = file ? fileExtension(file.name) : ''
  const canCopy = COPY_CONTAINERS.has(ext) && !forceEncode
  const outExt = canCopy ? ext : 'mp4'

  const outputName = useMemo(
    () => (file ? `${stripExtension(file.name)}-muted.${outExt}` : `muted.${outExt}`),
    [file, outExt],
  )

  const startJob = (encode = forceEncode) => {
    if (!file) return
    const useCopy = COPY_CONTAINERS.has(ext) && !encode
    const targetExt = useCopy ? ext : 'mp4'
    const input = inputName(file)
    const output = `output.${targetExt}`
    const args = ['-i', input, '-an']

    if (useCopy) args.push('-c:v', 'copy')
    else
      args.push(
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '20',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
      )

    if (stripMetadata) args.push('-map_metadata', '-1')
    args.push(output)

    job.run({
      inputs: [{ name: input, data: file }],
      commands: [args],
      output,
      mime: MIME_BY_EXT[targetExt] ?? 'video/mp4',
      filename: file ? `${stripExtension(file.name)}-muted.${targetExt}` : `muted.${targetExt}`,
      durationSec: duration,
      inputBytes: file.size,
    })
  }

  if (!file) {
    return (
      <div className="space-y-4">
        <FileDropzone
          accept={ACCEPT}
          onFiles={source.select}
          maxSizeMb={1024}
          title="Drop a video to remove its sound"
          hint="The picture is copied without re-encoding, so there is no quality loss"
        />
        <EngineNotice />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SourceSummary
        file={file}
        duration={source.info?.duration}
        width={source.info?.width}
        height={source.info?.height}
        onClear={() => {
          job.reset()
          source.clear()
        }}
      />

      {source.info?.playable ? <MediaPreview source={file} kind="video" /> : null}

      <ToolPanel
        title="Remove the audio track"
        description={
          canCopy
            ? 'The video stream is copied bit for bit and only the audio track is dropped, so this finishes in seconds and the picture is identical to the original.'
            : 'This container cannot be rewritten without re-encoding, so the video is re-encoded to MP4 (H.264, CRF 20).'
        }
        footer={
          <Button
            type="button"
            onClick={() => startJob()}
            disabled={job.busy}
            className="w-full sm:w-auto"
          >
            <VolumeX className="size-4" aria-hidden="true" />
            {job.busy ? 'Working…' : 'Remove audio'}
          </Button>
        }
      >
        <div className="grid gap-4">
          <SwitchField
            label="Also strip metadata"
            checked={stripMetadata}
            onChange={setStripMetadata}
            hint="Drops titles, comments, creation dates and any location tags the camera wrote."
          />
          <SwitchField
            label="Re-encode instead of copying"
            checked={forceEncode}
            onChange={setForceEncode}
            hint="Only needed if the copied file will not play in your target app. Slower, and the picture is re-compressed."
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Output: <span className="font-mono text-foreground">{outputName}</span>
        </p>
      </ToolPanel>

      <JobStatus job={job} label={canCopy ? 'Rewriting the container' : 'Re-encoding video'} />
      <JobError job={job} onRetry={() => startJob(true)} />
      {job.phase === 'error' && canCopy ? (
        <p className="text-sm text-muted-foreground">
          Retrying will re-encode the video to MP4, which works even when the original container
          refuses a plain stream copy.
        </p>
      ) : null}

      {job.result ? (
        <ResultPanel
          result={job.result}
          kind="video"
          downloadLabel="Download silent video"
          resetLabel="Mute another video"
          onReset={() => {
            job.reset()
            source.clear()
          }}
          stats={
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultStat
                label="Method"
                value={canCopy ? 'Stream copy (no quality loss)' : 'Re-encoded H.264'}
              />
              <ResultStat label="Metadata" value={stripMetadata ? 'Removed' : 'Preserved'} />
            </div>
          }
        />
      ) : null}

      <EngineNotice />
    </div>
  )
}
