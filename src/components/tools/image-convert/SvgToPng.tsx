import ImageConverter from './_Converter'

export default function SvgToPng() {
  return (
    <ImageConverter
      accept=".svg,image/svg+xml"
      fixedTarget="png"
      svgControls
      dropTitle="Drop SVG files here"
      dropHint="or click to browse. Pick a scale or an exact width below, then download the PNG."
      zipName="svg-to-png"
    />
  )
}
