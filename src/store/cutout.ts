import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'
import { CUTOUT_MAX_DISPLAY_DIM, DEFAULT_BRUSH_SIZE } from '../constants/cutout'
import { computeDisplayScale, createCanvas } from '../utils/cutout'
import type { GeometricSelection, Point, ToolMode } from '../types/cutout'

/**
 * Ephemeral cutout-editor state - intentionally not persisted to localStorage.
 * The source image and brush mask are full-resolution canvases that can easily
 * be several MB each, far beyond what's safe to keep in localStorage alongside
 * the deck project. State survives tab switches within the session (Pinia store
 * is a singleton) but is lost on page reload.
 */
export const useCutoutStore = defineStore('cutout', () => {
  const sourceCanvas = shallowRef<HTMLCanvasElement | null>(null)
  const naturalWidth = ref(0)
  const naturalHeight = ref(0)
  const sourceFilename = ref('')

  const displayScale = computed(() => computeDisplayScale(naturalWidth.value, naturalHeight.value, CUTOUT_MAX_DISPLAY_DIM))

  const selections = ref<GeometricSelection[]>([])
  const selectedId = ref<string | null>(null)

  const brushMask = shallowRef<HTMLCanvasElement | null>(null)
  // Bumped whenever brushMask's pixels are mutated in-place, since shallowRef won't detect that.
  const brushMaskVersion = ref(0)
  const brushSize = ref(DEFAULT_BRUSH_SIZE)

  const toolMode = ref<ToolMode>('select')
  const draftPolygonPoints = ref<Point[]>([])

  function loadImage(canvas: HTMLCanvasElement, filename: string) {
    sourceCanvas.value = canvas
    naturalWidth.value = canvas.width
    naturalHeight.value = canvas.height
    sourceFilename.value = filename
    selections.value = []
    selectedId.value = null
    draftPolygonPoints.value = []
    brushMask.value = createCanvas(canvas.width, canvas.height)
    brushMaskVersion.value++
  }

  function addSelection(sel: GeometricSelection) {
    selections.value.push(sel)
    selectedId.value = sel.id
  }

  function updateSelection(id: string, next: GeometricSelection) {
    const idx = selections.value.findIndex((s) => s.id === id)
    if (idx !== -1) selections.value[idx] = next
  }

  function removeSelection(id: string) {
    selections.value = selections.value.filter((s) => s.id !== id)
    if (selectedId.value === id) selectedId.value = null
  }

  function selectShape(id: string | null) {
    selectedId.value = id
  }

  function setToolMode(mode: ToolMode) {
    toolMode.value = mode
    draftPolygonPoints.value = []
    if (mode !== 'select') selectedId.value = null
  }

  function clearBrushMask() {
    if (!brushMask.value) return
    const ctx = brushMask.value.getContext('2d')!
    ctx.clearRect(0, 0, brushMask.value.width, brushMask.value.height)
    brushMaskVersion.value++
  }

  function bumpBrushMaskVersion() {
    brushMaskVersion.value++
  }

  function reset() {
    sourceCanvas.value = null
    naturalWidth.value = 0
    naturalHeight.value = 0
    sourceFilename.value = ''
    selections.value = []
    selectedId.value = null
    brushMask.value = null
    brushMaskVersion.value = 0
    draftPolygonPoints.value = []
    toolMode.value = 'select'
  }

  return {
    sourceCanvas,
    naturalWidth,
    naturalHeight,
    sourceFilename,
    displayScale,
    selections,
    selectedId,
    brushMask,
    brushMaskVersion,
    brushSize,
    toolMode,
    draftPolygonPoints,
    loadImage,
    addSelection,
    updateSelection,
    removeSelection,
    selectShape,
    setToolMode,
    clearBrushMask,
    bumpBrushMaskVersion,
    reset,
  }
})
