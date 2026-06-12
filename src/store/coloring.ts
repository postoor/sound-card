import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import {
  EDGE_SIGMA_DEFAULT,
  EDGE_STRENGTH_DEFAULT,
  THRESHOLD_LEVEL_DEFAULT,
} from '../constants/coloring'
import type { LineartEngine } from '../utils/lineart'

export type MlState = 'unloaded' | 'loading' | 'ready' | 'failed'

/**
 * Ephemeral coloring-page editor state - intentionally not persisted to localStorage,
 * matching the cutout store. The source image is a full-resolution canvas.
 */
export const useColoringStore = defineStore('coloring', () => {
  const sourceCanvas = shallowRef<HTMLCanvasElement | null>(null)
  const sourceFilename = ref('')
  const naturalWidth = ref(0)
  const naturalHeight = ref(0)

  const engine = ref<LineartEngine>('ml')
  const edgeParams = ref({ sigma: EDGE_SIGMA_DEFAULT, strength: EDGE_STRENGTH_DEFAULT })
  const thresholdParams = ref({ level: THRESHOLD_LEVEL_DEFAULT })

  const mlState = ref<MlState>('unloaded')
  const mlProgress = ref(0)
  const mlError = ref('')
  const mlEp = ref('')

  const previewCanvas = shallowRef<HTMLCanvasElement | null>(null)
  const isProcessing = ref(false)

  function loadImage(canvas: HTMLCanvasElement, filename: string) {
    sourceCanvas.value = canvas
    naturalWidth.value = canvas.width
    naturalHeight.value = canvas.height
    sourceFilename.value = filename
    previewCanvas.value = null
  }

  function setEngine(next: LineartEngine) {
    engine.value = next
  }

  return {
    sourceCanvas,
    sourceFilename,
    naturalWidth,
    naturalHeight,
    engine,
    edgeParams,
    thresholdParams,
    mlState,
    mlProgress,
    mlError,
    mlEp,
    previewCanvas,
    isProcessing,
    loadImage,
    setEngine,
  }
})
