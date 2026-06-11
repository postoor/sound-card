<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useCutoutStore } from '../store/cutout'
import { POLYGON_CLOSE_THRESHOLD_DISPLAY_PX } from '../constants/cutout'
import {
  findSelectionAt,
  getScratchCtx,
  isNearPoint,
  paintBrushSegment,
  selectionToPath,
  tintMask,
  translateSelection,
} from '../utils/cutout'
import type { GeometricSelection, Point } from '../types/cutout'

const store = useCutoutStore()

const canvasRef = ref<HTMLCanvasElement>()

const displayWidth = computed(() => Math.max(1, Math.round(store.naturalWidth * store.displayScale)))
const displayHeight = computed(() => Math.max(1, Math.round(store.naturalHeight * store.displayScale)))
const canvasClass = computed(() => `cursor-${store.toolMode}`)

// Drag state for rect/ellipse creation.
const dragStart = ref<Point | null>(null)
const draftShape = ref<GeometricSelection | null>(null)

// Drag state for moving an existing selection.
const draggingSelectionId = ref<string | null>(null)
const lastDragPoint = ref<Point | null>(null)

// Brush painting state.
const isPainting = ref(false)
let brushPoints: Point[] = []
let rafPending = false

function eventToDisplayCoords(e: PointerEvent): Point {
  const canvas = canvasRef.value!
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function displayToNatural(p: Point): Point {
  return { x: p.x / store.displayScale, y: p.y / store.displayScale }
}

function naturalToDisplay(p: Point): Point {
  return { x: p.x * store.displayScale, y: p.y * store.displayScale }
}

function redraw() {
  const canvas = canvasRef.value
  const source = store.sourceCanvas
  if (!canvas || !source) return

  if (canvas.width !== displayWidth.value) canvas.width = displayWidth.value
  if (canvas.height !== displayHeight.value) canvas.height = displayHeight.value

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, canvas.width, canvas.height)

  if (store.brushMask) {
    const tinted = tintMask(store.brushMask, 'rgba(168, 85, 247, 0.45)')
    ctx.drawImage(tinted, 0, 0, tinted.width, tinted.height, 0, 0, canvas.width, canvas.height)
  }

  for (const sel of store.selections) {
    drawSelectionOverlay(ctx, sel, sel.id === store.selectedId)
  }

  if (draftShape.value) {
    drawSelectionOverlay(ctx, draftShape.value, true)
  }

  if (store.draftPolygonPoints.length > 0) {
    drawDraftPolygon(ctx, store.draftPolygonPoints)
  }
}

function drawSelectionOverlay(ctx: CanvasRenderingContext2D, sel: GeometricSelection, active: boolean) {
  const scale = store.displayScale
  const path = selectionToPath(sel)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.fillStyle = active ? 'rgba(37, 99, 235, 0.25)' : 'rgba(59, 130, 246, 0.18)'
  ctx.fill(path)
  ctx.lineWidth = (active ? 2 : 1.5) / scale
  ctx.setLineDash([6 / scale, 4 / scale])
  ctx.strokeStyle = active ? '#2563eb' : '#3b82f6'
  ctx.stroke(path)
  ctx.restore()
}

function drawDraftPolygon(ctx: CanvasRenderingContext2D, points: Point[]) {
  ctx.save()
  ctx.strokeStyle = '#3b82f6'
  ctx.fillStyle = '#3b82f6'
  ctx.lineWidth = 1.5
  ctx.setLineDash([6, 4])
  ctx.beginPath()
  points.forEach((p, i) => {
    const d = naturalToDisplay(p)
    if (i === 0) ctx.moveTo(d.x, d.y)
    else ctx.lineTo(d.x, d.y)
  })
  ctx.stroke()
  const first = naturalToDisplay(points[0])
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.arc(first.x, first.y, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function computeDraftShape(tool: 'rect' | 'ellipse', start: Point, current: Point): GeometricSelection {
  const x = Math.min(start.x, current.x)
  const y = Math.min(start.y, current.y)
  const width = Math.abs(current.x - start.x)
  const height = Math.abs(current.y - start.y)
  if (tool === 'rect') {
    return { id: crypto.randomUUID(), type: 'rect', x, y, width, height }
  }
  return {
    id: crypto.randomUUID(),
    type: 'ellipse',
    cx: x + width / 2,
    cy: y + height / 2,
    rx: width / 2,
    ry: height / 2,
  }
}

function handlePolygonClick(natural: Point) {
  const points = store.draftPolygonPoints
  if (points.length >= 3) {
    const thresholdNatural = POLYGON_CLOSE_THRESHOLD_DISPLAY_PX / store.displayScale
    if (isNearPoint(natural, points[0], thresholdNatural)) {
      finalizePolygon()
      return
    }
  }
  store.draftPolygonPoints.push(natural)
}

function finalizePolygon() {
  if (store.draftPolygonPoints.length < 3) return
  store.addSelection({
    id: crypto.randomUUID(),
    type: 'polygon',
    points: [...store.draftPolygonPoints],
  })
  store.draftPolygonPoints = []
}

function onDblClick() {
  if (store.toolMode === 'polygon') finalizePolygon()
}

function paintAt(point: Point) {
  const mask = store.brushMask
  if (!mask) return
  brushPoints.push(point)
  if (brushPoints.length > 3) brushPoints.shift()

  const [p0, p1, p2] =
    brushPoints.length >= 3
      ? (brushPoints as [Point, Point, Point])
      : brushPoints.length === 2
        ? ([brushPoints[0], brushPoints[0], brushPoints[1]] as [Point, Point, Point])
        : ([brushPoints[0], brushPoints[0], brushPoints[0]] as [Point, Point, Point])

  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
  const maskCtx = mask.getContext('2d')!
  paintBrushSegment(maskCtx, p0, p1, mid, store.brushSize / 2, store.toolMode === 'eraser')

  scheduleOverlayRedraw()
}

function scheduleOverlayRedraw() {
  if (rafPending) return
  rafPending = true
  requestAnimationFrame(() => {
    rafPending = false
    store.bumpBrushMaskVersion()
  })
}

function onPointerDown(e: PointerEvent) {
  if (!store.sourceCanvas) return
  const natural = displayToNatural(eventToDisplayCoords(e))
  canvasRef.value!.setPointerCapture(e.pointerId)

  switch (store.toolMode) {
    case 'select': {
      const hit = findSelectionAt(store.selections, natural.x, natural.y, getScratchCtx())
      if (hit) {
        store.selectShape(hit.id)
        draggingSelectionId.value = hit.id
        lastDragPoint.value = natural
      } else {
        store.selectShape(null)
      }
      break
    }
    case 'rect':
    case 'ellipse':
      dragStart.value = natural
      draftShape.value = null
      break
    case 'polygon':
      handlePolygonClick(natural)
      break
    case 'brush':
    case 'eraser':
      isPainting.value = true
      brushPoints = []
      paintAt(natural)
      break
  }
  redraw()
}

function onPointerMove(e: PointerEvent) {
  if (!store.sourceCanvas) return
  const natural = displayToNatural(eventToDisplayCoords(e))

  if ((store.toolMode === 'rect' || store.toolMode === 'ellipse') && dragStart.value) {
    draftShape.value = computeDraftShape(store.toolMode, dragStart.value, natural)
    redraw()
  } else if (store.toolMode === 'select' && draggingSelectionId.value && lastDragPoint.value) {
    const dx = natural.x - lastDragPoint.value.x
    const dy = natural.y - lastDragPoint.value.y
    const sel = store.selections.find((s) => s.id === draggingSelectionId.value)
    if (sel) store.updateSelection(sel.id, translateSelection(sel, dx, dy))
    lastDragPoint.value = natural
    redraw()
  } else if ((store.toolMode === 'brush' || store.toolMode === 'eraser') && isPainting.value) {
    paintAt(natural)
  }
}

function onPointerUp(e: PointerEvent) {
  const draft = draftShape.value
  if ((store.toolMode === 'rect' || store.toolMode === 'ellipse') && dragStart.value && draft) {
    let bbox: { width: number; height: number } | null = null
    if (draft.type === 'rect') bbox = { width: draft.width, height: draft.height }
    else if (draft.type === 'ellipse') bbox = { width: draft.rx * 2, height: draft.ry * 2 }
    if (bbox && bbox.width > 2 && bbox.height > 2) store.addSelection(draft)
  }
  dragStart.value = null
  draftShape.value = null
  draggingSelectionId.value = null
  lastDragPoint.value = null
  isPainting.value = false
  brushPoints = []

  const canvas = canvasRef.value
  if (canvas?.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
  redraw()
}

function onKeyDown(e: KeyboardEvent) {
  if ((e.key === 'Delete' || e.key === 'Backspace') && store.toolMode === 'select' && store.selectedId) {
    const target = e.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    store.removeSelection(store.selectedId)
    e.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))

watch(
  () => [
    store.sourceCanvas,
    store.selections,
    store.brushMaskVersion,
    store.selectedId,
    store.draftPolygonPoints,
    draftShape.value,
  ],
  () => redraw(),
  { deep: true, immediate: true, flush: 'post' },
)
</script>

<template>
  <div class="cutout-canvas-wrap">
    <canvas
      v-if="store.sourceCanvas"
      ref="canvasRef"
      class="cutout-canvas"
      :class="canvasClass"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @dblclick="onDblClick"
    />
    <p v-else class="empty">請先上傳圖片</p>
  </div>
</template>

<style scoped>
.cutout-canvas-wrap {
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.cutout-canvas {
  display: block;
  max-width: 100%;
  height: auto;
  background: #e5e7eb;
  touch-action: none;
  cursor: crosshair;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.cutout-canvas.cursor-select {
  cursor: default;
}

.cutout-canvas.cursor-brush,
.cutout-canvas.cursor-eraser {
  cursor: cell;
}

.empty {
  color: #9ca3af;
  font-size: 14px;
}
</style>
