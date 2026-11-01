import ImageConverter from './_Converter'

export default function PngToWebp() {
  return (
    <ImageConverter
      accept=".png,image/png"
      fixedTarget="webp"
      defaultQuality={80}
      dropTitle="Drop PNG files here"
      dropHint="or click to browse. Transparency is kept in the WebP output."
      zipName="png-to-webp"
    />
  )
}
