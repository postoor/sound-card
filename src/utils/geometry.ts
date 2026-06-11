import { IMAGE_SCALE_MAX, IMAGE_SCALE_MIN } from '../constants/layout'
import type { ImageTransform } from '../types/card'

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * "Cover" scale factor (mm per natural image pixel) so the image fully
 * covers a slotWmm x slotHmm area. Independent of any px-per-mm constant,
 * which keeps editor/thumbnail/export math identical at every scale.
 */
export function coverScaleMmPerPx(
  slotWmm: number,
  slotHmm: number,
  naturalWidth: number,
  naturalHeight: number,
): number {
  if (naturalWidth <= 0 || naturalHeight <= 0) return 0
  return Math.max(slotWmm / naturalWidth, slotHmm / naturalHeight)
}

export function renderedSizeMm(
  transform: ImageTransform,
  slotWmm: number,
  slotHmm: number,
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  const cover = coverScaleMmPerPx(slotWmm, slotHmm, naturalWidth, naturalHeight)
  return {
    width: naturalWidth * cover * transform.scale,
    height: naturalHeight * cover * transform.scale,
  }
}

/**
 * Clamp a transform so the image always fully covers its slot (no gaps),
 * regardless of zoom/pan. Shared by the editor (live drag/zoom) and as the
 * single definition of "valid" transform that export relies on.
 */
export function clampTransform(
  transform: ImageTransform,
  slotWmm: number,
  slotHmm: number,
  naturalWidth: number,
  naturalHeight: number,
): ImageTransform {
  const scale = clamp(transform.scale, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX)
  const { width, height } = renderedSizeMm(
    { ...transform, scale },
    slotWmm,
    slotHmm,
    naturalWidth,
    naturalHeight,
  )
  const maxOffsetX = Math.max(0, (width - slotWmm) / 2)
  const maxOffsetY = Math.max(0, (height - slotHmm) / 2)
  return {
    scale,
    offsetX: clamp(transform.offsetX, -maxOffsetX, maxOffsetX),
    offsetY: clamp(transform.offsetY, -maxOffsetY, maxOffsetY),
  }
}
