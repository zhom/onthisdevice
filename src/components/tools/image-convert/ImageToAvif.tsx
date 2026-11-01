import ImageConverter from './_Converter'

export default function ImageToAvif() {
  return (
    <ImageConverter
      accept=".jpg,.jpeg,.png,.webp,.gif,.bmp,image/jpeg,image/png,image/webp,image/gif,image/bmp"
      fixedTarget="avif"
      defaultQuality={55}
      avifControls
      dropTitle="Drop JPG, PNG or WebP files here"
      dropHint="or click to browse. libavif, compiled to WebAssembly, encodes them."
      zipName="avif-images"
    />
  )
}
