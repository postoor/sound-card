import * as ort from 'onnxruntime-web/webgpu'
import wasmUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url'
import mjsUrl from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url'
import { ML_INPUT_SIZE, ML_MODEL_FILE, ML_PRESET, MODEL_CACHE_NAME } from '../../constants/coloring'

// GitHub Pages can't set COOP/COEP, so the page is never crossOriginIsolated -
// run the wasm runtime single-threaded (still SIMD-accelerated).
ort.env.wasm.wasmPaths = { wasm: wasmUrl, mjs: mjsUrl }
ort.env.wasm.numThreads = 1

interface LoadedModel {
  session: ort.InferenceSession
  ep: string
}

let modelCache: LoadedModel | null = null
let loadPromise: Promise<LoadedModel> | null = null

async function fetchModelBuffer(onProgress?: (ratio: number) => void): Promise<ArrayBuffer> {
  const url = `${import.meta.env.BASE_URL}${ML_MODEL_FILE}`
  const cache = await caches.open(MODEL_CACHE_NAME)
  const cached = await cache.match(url)
  if (cached) return cached.arrayBuffer()

  const response = await fetch(url)
  if (!response.ok) throw new Error(`模型下載失敗（HTTP ${response.status}），請確認 ${ML_MODEL_FILE} 已放置`)

  const total = Number(response.headers.get('content-length') ?? '0')
  if (!response.body || total === 0) {
    const buffer = await response.arrayBuffer()
    await cache.put(url, new Response(buffer.slice(0), { headers: response.headers }))
    return buffer
  }

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let received = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.length
    onProgress?.(received / total)
  }
  const merged = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  await cache.put(url, new Response(merged.slice(0), { headers: response.headers }))
  return merged.buffer
}

/** Downloads (or reads from Cache API) and initializes the line-art ONNX model.
 *  Returns the execution provider actually used ('webgpu' or 'wasm'). Cached after first call. */
export async function ensureModel(onProgress?: (ratio: number) => void): Promise<string> {
  if (modelCache) return modelCache.ep
  if (!loadPromise) {
    loadPromise = (async () => {
      const buffer = await fetchModelBuffer(onProgress)
      const preferWebGpu = 'gpu' in navigator
      try {
        const providers = preferWebGpu ? ['webgpu', 'wasm'] : ['wasm']
        const session = await ort.InferenceSession.create(buffer, { executionProviders: providers })
        const loaded = { session, ep: preferWebGpu ? 'webgpu' : 'wasm' }
        modelCache = loaded
        return loaded
      } catch {
        const session = await ort.InferenceSession.create(buffer, { executionProviders: ['wasm'] })
        const loaded = { session, ep: 'wasm' }
        modelCache = loaded
        return loaded
      }
    })()
  }
  const loaded = await loadPromise
  return loaded.ep
}

/** Runs the line-art model on `source`, returning a 512x512 white-background/black-line ImageData. */
export async function runLineart(source: HTMLCanvasElement): Promise<ImageData> {
  if (!modelCache) throw new Error('模型尚未載入')
  const { session } = modelCache
  const size = ML_INPUT_SIZE

  const resized = document.createElement('canvas')
  resized.width = size
  resized.height = size
  const ctx = resized.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, size, size)
  const { data } = ctx.getImageData(0, 0, size, size)

  const useHalfRange = ML_PRESET === 'anime2sketch'
  const pixelCount = size * size
  const tensorData = new Float32Array(3 * pixelCount)
  for (let p = 0; p < pixelCount; p++) {
    for (let c = 0; c < 3; c++) {
      let v = data[p * 4 + c] / 255
      if (useHalfRange) v = (v - 0.5) / 0.5
      tensorData[c * pixelCount + p] = v
    }
  }

  const inputTensor = new ort.Tensor('float32', tensorData, [1, 3, size, size])
  const inputName = session.inputNames[0]
  const outputs = await session.run({ [inputName]: inputTensor })
  const outputTensor = outputs[session.outputNames[0]]
  const outData = outputTensor.data as Float32Array
  const channels = outputTensor.dims.length >= 3 ? outputTensor.dims[outputTensor.dims.length - 3] : 1

  const out = new ImageData(size, size)
  for (let p = 0; p < pixelCount; p++) {
    let v: number
    if (channels <= 1) {
      v = outData[p]
    } else {
      let sum = 0
      for (let c = 0; c < channels; c++) sum += outData[c * pixelCount + p]
      v = sum / channels
    }
    if (useHalfRange) v = v * 0.5 + 0.5
    const gray = Math.round(Math.min(1, Math.max(0, v)) * 255)
    const idx = p * 4
    out.data[idx] = gray
    out.data[idx + 1] = gray
    out.data[idx + 2] = gray
    out.data[idx + 3] = 255
  }
  return out
}
