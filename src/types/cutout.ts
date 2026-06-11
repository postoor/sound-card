/** A point in natural (original, full-resolution) image pixel coordinates. */
export interface Point {
  x: number
  y: number
}

export type SelectionTool = 'rect' | 'ellipse' | 'polygon' | 'brush'
export type ToolMode = SelectionTool | 'select' | 'eraser'

interface BaseSelection {
  id: string
}

export interface RectSelection extends BaseSelection {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
}

export interface EllipseSelection extends BaseSelection {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

/** Freeform selection; `points` has at least 3 entries once finalized. */
export interface PolygonSelection extends BaseSelection {
  type: 'polygon'
  points: Point[]
}

export type GeometricSelection = RectSelection | EllipseSelection | PolygonSelection

/** One exported PNG: either a geometric selection's crop or the brush mask's crop. */
export interface CutoutPiece {
  /** Source selection id, or 'brush' for the brush mask piece. */
  sourceId: string
  canvas: HTMLCanvasElement
  bbox: { x: number; y: number; width: number; height: number }
}

export interface CutoutExportResult {
  /** Copy of the source image with all selections and the brush mask cut out (alpha = 0). */
  hollowed: HTMLCanvasElement
  pieces: CutoutPiece[]
}
