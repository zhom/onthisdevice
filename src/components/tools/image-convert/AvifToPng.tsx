import ImageConverter from './_Converter'

export default function AvifToPng() {
  return (
    <ImageConverter
      accept=".avif,image/avif"
      fixedTarget="png"
      dropTitle="Drop AVIF files here"
      dropHint="or click to browse. You get a lossless PNG that any program can open."
      zipName="avif-to-png"
    />
  )
}
