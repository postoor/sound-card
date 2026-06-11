import type { CutoutExportResult, CutoutPiece, GeometricSelection, Point } from '../types/cutout'

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(src.width, src.height)
  out.getContext('2d')!.drawImage(src, 0, 0)
  return out
}

/** Traces the given selection's outline as a Path2D in natural-pixel coords. */
export function selectionToPath(sel: GeometricSelection): Path2D {
  const path = new Path2D()
  if (sel.type === 'rect') {
    path.rect(sel.x, sel.y, sel.width, sel.height)
  } else if (sel.type === 'ellipse') {
    path.ellipse(sel.cx, sel.cy, sel.rx, sel.ry, 0, 0, Math.PI * 2)
  } else {
    const [first, ...rest] = sel.points
    if (!first) return path
    path.moveTo(first.x, first.y)
    for (const p of rest) path.lineTo(p.x, p.y)
    path.closePath()
  }
  return path
}

export function selectionBBox(sel: GeometricSelection): { x: number; y: number; width: number; height: number } {
  switch (sel.type) {
    case 'rect':
      return { x: sel.x, y: sel.y, width: sel.width, height: sel.height }
    case 'ellipse':
      return { x: sel.cx - sel.rx, y: sel.cy - sel.ry, width: sel.rx * 2, height: sel.ry * 2 }
    case 'polygon': {
      const xs = sel.points.map((p) => p.x)
      const ys = sel.points.map((p) => p.y)
      const minX = Math.min(...xs)
      const maxX = Math.max(...xs)
      const minY = Math.min(...ys)
      const maxY = Math.max(...ys)
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }
  }
}

/** Bounding box of non-transparent pixels in a mask canvas. Returns null if fully empty. */
export function alphaMaskBBox(canvas: HTMLCanvasElement): { x: number; y: number; width: number; height: number } | null {
  const ctx = canvas.getContext('2d')!
  const { width, height } = canvas
  if (width === 0 || height === 0) return null
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3]
      if (alpha > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < minX || maxY < minY) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

/** Scratch context for path hit-testing in natural-pixel space, decoupled from any display transform. */
let scratchCtx: CanvasRenderingContext2D | null = null
export function getScratchCtx(): CanvasRenderingContext2D {
  if (!scratchCtx) scratchCtx = createCanvas(1, 1).getContext('2d')!
  return scratchCtx
}

export function hitTestSelection(sel: GeometricSelection, x: number, y: number, ctx: CanvasRenderingContext2D): boolean {
  return ctx.isPointInPath(selectionToPath(sel), x, y)
}

/** Finds the topmost selection (last in array = drawn last = on top) containing the point. */
export function findSelectionAt(
  selections: GeometricSelection[],
  x: number,
  y: number,
  ctx: CanvasRenderingContext2D,
): GeometricSelection | null {
  for (let i = selections.length - 1; i >= 0; i--) {
    if (hitTestSelection(selections[i], x, y, ctx)) return selections[i]
  }
  return null
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/** True if `a` is within `thresholdNaturalPx` of `b` (natural-pixel units). */
export function isNearPoint(a: Point, b: Point, thresholdNaturalPx: number): boolean {
  return distance(a, b) <= thresholdNaturalPx
}

/** Returns a new selection translated by (dx, dy) in natural-pixel coords. Does not mutate input. */
export function translateSelection(sel: GeometricSelection, dx: number, dy: number): GeometricSelection {
  switch (sel.type) {
    case 'rect':
      return { ...sel, x: sel.x + dx, y: sel.y + dy }
    case 'ellipse':
      return { ...sel, cx: sel.cx + dx, cy: sel.cy + dy }
    case 'polygon':
      return { ...sel, points: sel.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) }
  }
}

/**
 * Produces a new canvas: a copy of `source` with all `selections` paths and the
 * `brushMask` (if any) cut out (made transparent) via destination-out compositing.
 */
export function buildHollowedCanvas(
  source: HTMLCanvasElement,
  selections: GeometricSelection[],
  brushMask: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const out = cloneCanvas(source)
  const ctx = out.getContext('2d')!

  ctx.save()
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  for (const sel of selections) {
    ctx.fill(selectionToPath(sel))
  }
  if (brushMask) {
    ctx.drawImage(brushMask, 0, 0)
  }
  ctx.restore()

  return out
}

/**
 * Extracts the selection's content from `source` as a new canvas sized to the
 * selection's bounding box (clamped to source bounds), with everything outside
 * the selection's path made transparent.
 */
export function extractSelectionPiece(source: HTMLCanvasElement, sel: GeometricSelection): CutoutPiece {
  const raw = selectionBBox(sel)
  const x = Math.max(0, Math.floor(raw.x))
  const y = Math.max(0, Math.floor(raw.y))
  const x2 = Math.min(source.width, Math.ceil(raw.x + raw.width))
  const y2 = Math.min(source.height, Math.ceil(raw.y + raw.height))
  const width = Math.max(1, x2 - x)
  const height = Math.max(1, y2 - y)

  const piece = createCanvas(width, height)
  const ctx = piece.getContext('2d')!

  ctx.save()
  ctx.translate(-x, -y)
  ctx.clip(selectionToPath(sel))
  ctx.drawImage(source, 0, 0)
  ctx.restore()

  return { sourceId: sel.id, canvas: piece, bbox: { x, y, width, height } }
}

/**
 * Extracts the painted region of `brushMask` from `source` as a new canvas cropped
 * to the mask's bounding box. Returns null if the mask is empty.
 */
export function extractBrushPiece(source: HTMLCanvasElement, brushMask: HTMLCanvasElement): CutoutPiece | null {
  const bbox = alphaMaskBBox(brushMask)
  if (!bbox) return null

  const piece = createCanvas(bbox.width, bbox.height)
  const ctx = piece.getContext('2d')!

  ctx.drawImage(source, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(brushMask, bbox.x, bbox.y, bbox.width, bbox.height, 0, 0, bbox.width, bbox.height)
  ctx.globalCompositeOperation = 'source-over'

  return { sourceId: 'brush', canvas: piece, bbox }
}

/** Builds the hollowed image plus one piece per geometric selection and (if non-empty) one brush piece. */
export function buildExportResult(
  source: HTMLCanvasElement,
  selections: GeometricSelection[],
  brushMask: HTMLCanvasElement | null,
): CutoutExportResult {
  const hollowed = buildHollowedCanvas(source, selections, brushMask)
  const pieces = selections.map((sel) => extractSelectionPiece(source, sel))
  if (brushMask) {
    const brushPiece = extractBrushPiece(source, brushMask)
    if (brushPiece) pieces.push(brushPiece)
  }
  return { hollowed, pieces }
}

/**
 * Computes the uniform scale factor to fit an image of (naturalW, naturalH) within
 * a max display dimension without upscaling. Returns 1 if already small enough.
 */
export function computeDisplayScale(naturalWidth: number, naturalHeight: number, maxDisplayDim: number): number {
  const maxSide = Math.max(naturalWidth, naturalHeight)
  if (maxSide <= maxDisplayDim || maxSide === 0) return 1
  return maxDisplayDim / maxSide
}

/** Builds a downsampled canvas for display purposes. */
export function buildDisplayCanvas(source: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale === 1) return source
  const w = Math.max(1, Math.round(source.width * scale))
  const h = Math.max(1, Math.round(source.height * scale))
  const out = createCanvas(w, h)
  out.getContext('2d')!.drawImage(source, 0, 0, w, h)
  return out
}

/**
 * Draws a smooth segment from `from` through control point `mid` to `to` on the brush
 * mask context, with the given brush radius (natural px). `erase` switches to
 * destination-out (removes from mask) instead of source-over (adds to mask).
 */
export function paintBrushSegment(
  maskCtx: CanvasRenderingContext2D,
  from: Point,
  mid: Point,
  to: Point,
  radiusNaturalPx: number,
  erase: boolean,
): void {
  maskCtx.save()
  maskCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over'
  maskCtx.lineCap = 'round'
  maskCtx.lineJoin = 'round'
  maskCtx.strokeStyle = '#fff'
  maskCtx.fillStyle = '#fff'
  maskCtx.lineWidth = radiusNaturalPx * 2
  maskCtx.beginPath()
  maskCtx.moveTo(from.x, from.y)
  maskCtx.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
  maskCtx.stroke()
  // Also stamp a dot at the start so single clicks (no movement) still paint.
  maskCtx.beginPath()
  maskCtx.arc(from.x, from.y, radiusNaturalPx, 0, Math.PI * 2)
  maskCtx.fill()
  maskCtx.restore()
}

/** Returns a canvas with `mask`'s alpha channel recolored to `color`, for overlay display. */
export function tintMask(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = createCanvas(mask.width, mask.height)
  const ctx = out.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, mask.width, mask.height)
  ctx.globalCompositeOperation = 'source-in'
  ctx.drawImage(mask, 0, 0)
  return out
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode canvas to PNG'))
    }, 'image/png')
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}
