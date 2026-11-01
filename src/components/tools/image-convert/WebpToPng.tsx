import ImageConverter from './_Converter'

export default function WebpToPng() {
  return (
    <ImageConverter
      accept=".webp,image/webp"
      fixedTarget="png"
      dropTitle="Drop WebP files here"
      dropHint="or click to browse. The alpha channel is kept in the PNG."
      zipName="webp-to-png"
    />
  )
}
