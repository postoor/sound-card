export interface ThresholdParams {
  level: number
}

/** Per-pixel luminance threshold. Output is opaque white/black (white background, black lines). */
export function applyThreshold(input: ImageData, params: ThresholdParams): ImageData {
  const { data, width, height } = input
  const out = new ImageData(width, height)
  const outData = out.data
  for (let i = 0; i < data.length; i += 4) {
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    const v = lum >= params.level ? 255 : 0
    outData[i] = v
    outData[i + 1] = v
    outData[i + 2] = v
    outData[i + 3] = 255
  }
  return out
}
