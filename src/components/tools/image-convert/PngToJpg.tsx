import ImageConverter from './_Converter'

export default function PngToJpg() {
  return (
    <ImageConverter
      accept=".png,image/png"
      fixedTarget="jpeg"
      defaultQuality={85}
      dropTitle="Drop PNG files here"
      dropHint="or click to browse. Each PNG is decoded and encoded again as JPG."
      zipName="png-to-jpg"
    />
  )
}
