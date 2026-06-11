/** Max dimension (px) for the on-screen cutout editor canvas. Larger source images are
 *  downsampled for display only - selections and exports use full natural-pixel coordinates. */
export const CUTOUT_MAX_DISPLAY_DIM = 1200

/** Default brush diameter, in natural image px. */
export const DEFAULT_BRUSH_SIZE = 40

/** Display-px radius within which clicking the polygon's first point closes it. */
export const POLYGON_CLOSE_THRESHOLD_DISPLAY_PX = 10

/** Safety margin (mm) when fitting the hollowed main image onto an A4 page. */
export const CUTOUT_PRINT_MARGIN_MM = 10
