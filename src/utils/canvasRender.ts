import {
  CARD_DIMENSIONS,
  CIRCLE_FILL,
  CIRCLE_RADIUS_MM,
  CIRCLE_STROKE,
  FRAME_BOX_FILL,
  FRAME_BOX_RADIUS_MM,
  HALF_DIMENSIONS,
  LABEL_FONT_SIZE_MM,
  LABEL_TEXT_COLOR,
  LANDSCAPE_BOX,
  LANDSCAPE_CIRCLE_CENTER,
  PORTRAIT_BOX,
  PORTRAIT_CIRCLE_CENTERS,
} from '../constants/layout'
import { coverScaleMmPerPx } from './geometry'
import type { Card, ImageSlot } from '../types/card'

const imageCache = new Map<string, HTMLImageElement>()

export function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(dataUrl)
  if (cached) return Promise.resolve(cached)
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(dataUrl, img)
      resolve(img)
    }
    img.onerror = reject
    img.src = dataUrl
  })
}

interface CircleDef {
  center: { x: number; y: number }
  label?: string
}

async function drawImageSlot(
  ctx: CanvasRenderingContext2D,
  slot: ImageSlot,
  originXmm: number,
  originYmm: number,
  slotWmm: number,
  slotHmm: number,
  pxPerMm: number,
) {
  const x = originXmm * pxPerMm
  const y = originYmm * pxPerMm
  const w = slotWmm * pxPerMm
  const h = slotHmm * pxPerMm

  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()

  if (!slot.imageDataUrl) {
    ctx.fillStyle = '#e5e7eb'
    ctx.fillRect(x, y, w, h)
    ctx.restore()
    return
  }

  const img = await loadImage(slot.imageDataUrl)
  const cover = coverScaleMmPerPx(slotWmm, slotHmm, slot.naturalWidth, slot.naturalHeight)
  const renderWmm = slot.naturalWidth * cover * slot.transform.scale
  const renderHmm = slot.naturalHeight * cover * slot.transform.scale

  const centerXmm = originXmm + slotWmm / 2 + slot.transform.offsetX
  const centerYmm = originYmm + slotHmm / 2 + slot.transform.offsetY

  const drawX = (centerXmm - renderWmm / 2) * pxPerMm
  const drawY = (centerYmm - renderHmm / 2) * pxPerMm
  const drawW = renderWmm * pxPerMm
  const drawH = renderHmm * pxPerMm

  ctx.drawImage(img, drawX, drawY, drawW, drawH)
  ctx.restore()
}

function drawFrameAndCircles(
  ctx: CanvasRenderingContext2D,
  originXmm: number,
  originYmm: number,
  box: { x: number; y: number; w: number; h: number },
  circles: CircleDef[],
  pxPerMm: number,
) {
  ctx.save()
  ctx.fillStyle = FRAME_BOX_FILL
  ctx.beginPath()
  ctx.roundRect(
    (originXmm + box.x) * pxPerMm,
    (originYmm + box.y) * pxPerMm,
    box.w * pxPerMm,
    box.h * pxPerMm,
    FRAME_BOX_RADIUS_MM * pxPerMm,
  )
  ctx.fill()

  for (const circle of circles) {
    const cx = (originXmm + circle.center.x) * pxPerMm
    const cy = (originYmm + circle.center.y) * pxPerMm
    const r = CIRCLE_RADIUS_MM * pxPerMm

    ctx.fillStyle = CIRCLE_FILL
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = CIRCLE_STROKE
    ctx.lineWidth = Math.max(1, 0.2 * pxPerMm)
    ctx.stroke()

    if (circle.label) {
      ctx.fillStyle = LABEL_TEXT_COLOR
      ctx.font = `${LABEL_FONT_SIZE_MM * pxPerMm}px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(circle.label, cx, cy + r + LABEL_FONT_SIZE_MM * pxPerMm * 0.9)
    }
  }
  ctx.restore()
}

export async function renderCardToCanvas(card: Card, pxPerMm: number): Promise<HTMLCanvasElement> {
  const dims = CARD_DIMENSIONS[card.type]
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(dims.width * pxPerMm)
  canvas.height = Math.round(dims.height * pxPerMm)
  const ctx = canvas.getContext('2d')!

  if (card.type === 'landscape') {
    await drawImageSlot(ctx, card.left, 0, 0, HALF_DIMENSIONS.width, HALF_DIMENSIONS.height, pxPerMm)
    await drawImageSlot(
      ctx,
      card.right,
      HALF_DIMENSIONS.width,
      0,
      HALF_DIMENSIONS.width,
      HALF_DIMENSIONS.height,
      pxPerMm,
    )
    drawFrameAndCircles(
      ctx,
      0,
      0,
      LANDSCAPE_BOX,
      [{ center: LANDSCAPE_CIRCLE_CENTER, label: card.leftLabel.text || undefined }],
      pxPerMm,
    )
    drawFrameAndCircles(
      ctx,
      HALF_DIMENSIONS.width,
      0,
      LANDSCAPE_BOX,
      [{ center: LANDSCAPE_CIRCLE_CENTER, label: card.rightLabel.text || undefined }],
      pxPerMm,
    )
  } else {
    await drawImageSlot(ctx, card.image, 0, 0, dims.width, dims.height, pxPerMm)
    drawFrameAndCircles(
      ctx,
      0,
      0,
      PORTRAIT_BOX,
      [
        { center: PORTRAIT_CIRCLE_CENTERS.left, label: card.leftLabel.text || undefined },
        { center: PORTRAIT_CIRCLE_CENTERS.right, label: card.rightLabel.text || undefined },
      ],
      pxPerMm,
    )
  }

  return canvas
}
