// All measurements in millimeters unless noted otherwise.
// This file is the single source of truth for card geometry, shared by the
// editor (screen preview), thumbnails, PNG export, and A4 print layout.

export const MM_PER_INCH = 25.4
export const EXPORT_DPI = 300
export const EXPORT_PX_PER_MM = EXPORT_DPI / MM_PER_INCH // ≈ 11.811

// Fixed internal editor scale. Responsive sizing is done via an outer CSS
// `transform: scale()` wrapper so this constant never needs to change.
export const EDITOR_PX_PER_MM = 4

export const CARD_DIMENSIONS = {
  landscape: { width: 90, height: 54 },
  portrait: { width: 54, height: 90 },
} as const

// Landscape card is split into a left and right half, each its own image slot.
export const HALF_DIMENSIONS = { width: 45, height: 54 }

export const CIRCLE_DIAMETER_MM = 15
export const CIRCLE_RADIUS_MM = CIRCLE_DIAMETER_MM / 2

// Frame box for each landscape half: bottom-right corner, 1mm margin from edges.
export const LANDSCAPE_BOX = { x: 15, y: 30, w: 29, h: 23 }
export const LANDSCAPE_CIRCLE_CENTER = { x: 29.5, y: 41.5 }

// Frame box for the portrait card: spans most of the bottom edge, two circles
// side by side.
export const PORTRAIT_BOX = { x: 1, y: 66, w: 52, h: 23 }
export const PORTRAIT_CIRCLE_CENTERS = {
  left: { x: 14.5, y: 77.5 },
  right: { x: 39.5, y: 77.5 },
}

export const FRAME_BOX_RADIUS_MM = 2
export const FRAME_BOX_FILL = 'rgba(255, 255, 255, 0.55)'
export const CIRCLE_FILL = '#dddddd'
export const CIRCLE_STROKE = '#999999'
export const LABEL_TEXT_COLOR = '#333333'
export const LABEL_FONT_SIZE_MM = 3

export const A4 = { width: 210, height: 297 }
export const PRINT_GAP_MM = 1

export const IMAGE_SCALE_MIN = 1
export const IMAGE_SCALE_MAX = 4
