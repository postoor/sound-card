import { applyEdge, type EdgeParams } from './edge'
import { applyThreshold, type ThresholdParams } from './threshold'

export interface LineartWorkerRequest {
  id: number
  engine: 'edge' | 'threshold'
  imageData: ImageData
  params: EdgeParams | ThresholdParams
}

export interface LineartWorkerResponse {
  id: number
  imageData: ImageData
}

interface WorkerLike {
  onmessage: ((event: MessageEvent<LineartWorkerRequest>) => void) | null
  postMessage(message: LineartWorkerResponse, transfer: Transferable[]): void
}

const ctx = self as unknown as WorkerLike

ctx.onmessage = (event: MessageEvent<LineartWorkerRequest>) => {
  const { id, engine, imageData, params } = event.data
  const result =
    engine === 'edge'
      ? applyEdge(imageData, params as EdgeParams)
      : applyThreshold(imageData, params as ThresholdParams)
  ctx.postMessage({ id, imageData: result }, [result.data.buffer])
}
