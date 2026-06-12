export interface EdgeParams {
  /** Gaussian blur radius (px) for the smaller of the two blurs used in the difference of Gaussians. */
  sigma: number
  /** 0-100: how sensitive edge detection is. Higher values pick up fainter edges. */
  strength: number
}

/** Max difference-of-Gaussians magnitude mapped by `strength` to a detection threshold. */
const DOG_RANGE = 15

function toGrayscale(data: Uint8ClampedArray, width: number, height: number): Float32Array {
  const gray = new Float32Array(width * height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
  }
  return gray
}

function gaussianKernel1D(sigma: number): Float32Array {
  const radius = Math.max(1, Math.ceil(sigma * 3))
  const size = radius * 2 + 1
  const kernel = new Float32Array(size)
  let sum = 0
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + radius] = v
    sum += v
  }
  for (let i = 0; i < size; i++) kernel[i] /= sum
  return kernel
}

/** Separable Gaussian blur (horizontal pass then vertical pass) with edge-clamped sampling. */
function gaussianBlur(src: Float32Array, width: number, height: number, sigma: number): Float32Array {
  const kernel = gaussianKernel1D(sigma)
  const radius = (kernel.length - 1) / 2
  const tmp = new Float32Array(width * height)
  const out = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k))
        sum += src[row + xx] * kernel[k + radius]
      }
      tmp[row + x] = sum
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k))
        sum += tmp[yy * width + x] * kernel[k + radius]
      }
      out[y * width + x] = sum
    }
  }

  return out
}

/** Difference-of-Gaussians edge detection. Output is opaque white/black (white background, black lines). */
export function applyEdge(input: ImageData, params: EdgeParams): ImageData {
  const { width, height, data } = input
  const gray = toGrayscale(data, width, height)
  const narrow = gaussianBlur(gray, width, height, params.sigma)
  const wide = gaussianBlur(gray, width, height, params.sigma * 1.6)
  const threshold = ((100 - params.strength) / 100) * DOG_RANGE

  const out = new ImageData(width, height)
  const outData = out.data
  for (let p = 0; p < gray.length; p++) {
    const dog = Math.abs(narrow[p] - wide[p])
    const v = dog > threshold ? 0 : 255
    const idx = p * 4
    outData[idx] = v
    outData[idx + 1] = v
    outData[idx + 2] = v
    outData[idx + 3] = 255
  }
  return out
}
