import ImageConverter from './_Converter'

export default function AvifToJpg() {
  return (
    <ImageConverter
      accept=".avif,image/avif"
      fixedTarget="jpeg"
      defaultQuality={88}
      dropTitle="Drop AVIF files here"
      dropHint="or click to browse. The files are decoded even if your browser cannot display AVIF."
      zipName="avif-to-jpg"
    />
  )
}
