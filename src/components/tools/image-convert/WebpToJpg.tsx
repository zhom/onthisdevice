import ImageConverter from './_Converter'

export default function WebpToJpg() {
  return (
    <ImageConverter
      accept=".webp,image/webp"
      fixedTarget="jpeg"
      defaultQuality={85}
      dropTitle="Drop WebP files here"
      dropHint="or click to browse. Transparent areas get the background colour you pick."
      zipName="webp-to-jpg"
    />
  )
}
