import { createCanvas, computeDisplayScale } from '../cutout'
import type { EdgeParams } from './edge'
import type { ThresholdParams } from './threshold'
import type { LineartWorkerRequest, LineartWorkerResponse } from './worker'

export type LineartEngine = 'ml' | 'edge' | 'threshold'

export interface LineartParams {
  edge: EdgeParams
  threshold: ThresholdParams
}

export type { EdgeParams } from './edge'
export type { ThresholdParams } from './threshold'

/** onnxruntime-web and the wasm/model assets are only fetched once ML mode is actually used. */
export async function ensureModel(onProgress?: (ratio: number) => void): Promise<string> {
  const { ensureModel: load } = await import('./ml')
  return load(onProgress)
}

let worker: Worker | null = null
let nextRequestId = 0
const pending = new Map<number, (imageData: ImageData) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<LineartWorkerResponse>) => {
      const resolve = pending.get(event.data.id)
      if (resolve) {
        pending.delete(event.data.id)
        resolve(event.data.imageData)
      }
    }
  }
  return worker
}

function runInWorker(engine: 'edge' | 'threshold', imageData: ImageData, params: EdgeParams | ThresholdParams): Promise<ImageData> {
  const id = nextRequestId++
  return new Promise((resolve) => {
    pending.set(id, resolve)
    // Spread into a plain object: params from a Pinia store is a reactive Proxy, which
    // structured clone (used by postMessage) cannot clone.
    const request: LineartWorkerRequest = { id, engine, imageData, params: { ...params } }
    getWorker().postMessage(request, [imageData.data.buffer])
  })
}

function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = createCanvas(imageData.width, imageData.height)
  canvas.getContext('2d')!.putImageData(imageData, 0, 0)
  return canvas
}

/** Downscales for preview; returns `source` unchanged if it already fits within `maxDim`. */
function downscale(source: HTMLCanvasElement, maxDim: number): HTMLCanvasElement {
  const scale = computeDisplayScale(source.width, source.height, maxDim)
  if (scale >= 1) return source
  const width = Math.max(1, Math.round(source.width * scale))
  const height = Math.max(1, Math.round(source.height * scale))
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

/** Smoothly scales `source` to exactly `width`x`height`. */
function resizeTo(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  if (source.width === width && source.height === height) return source
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

/** Converts `source` into a white-background/black-line coloring page using the given engine.
 *  When `maxDim` is set, `source` is downscaled first (for fast previews); the result is
 *  scaled back to match `source`'s dimensions. */
export async function generateLineart(
  source: HTMLCanvasElement,
  engine: LineartEngine,
  params: LineartParams,
  maxDim?: number,
): Promise<HTMLCanvasElement> {
  const target = maxDim ? downscale(source, maxDim) : source

  if (engine === 'ml') {
    const { runLineart } = await import('./ml')
    const imageData = await runLineart(target)
    return resizeTo(imageDataToCanvas(imageData), target.width, target.height)
  }

  const imageData = canvasToImageData(target)
  const params2 = engine === 'edge' ? params.edge : params.threshold
  const result = await runInWorker(engine, imageData, params2)
  return imageDataToCanvas(result)
}
