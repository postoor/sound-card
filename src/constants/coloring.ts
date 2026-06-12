/** Max dimension (px) for the live preview; full-resolution is used for the final PNG export. */
export const COLORING_PREVIEW_MAX_DIM = 1024

/** Cache API store name for the downloaded ONNX model. */
export const MODEL_CACHE_NAME = 'coloring-models'

export type MlPreset = 'informative-drawings' | 'anime2sketch'

/** Pick the preprocessing/postprocessing preset matching the model placed in public/models/. */
export const ML_PRESET: MlPreset = 'anime2sketch'

/** Model path relative to import.meta.env.BASE_URL. Place the file at public/models/lineart.onnx. */
export const ML_MODEL_FILE = 'models/lineart.onnx'

/** Square input/output size expected by the line-art model. */
export const ML_INPUT_SIZE = 512

export const EDGE_SIGMA_MIN = 0.5
export const EDGE_SIGMA_MAX = 5
export const EDGE_SIGMA_DEFAULT = 1.4

export const EDGE_STRENGTH_MIN = 0
export const EDGE_STRENGTH_MAX = 100
export const EDGE_STRENGTH_DEFAULT = 20

export const THRESHOLD_LEVEL_MIN = 0
export const THRESHOLD_LEVEL_MAX = 255
export const THRESHOLD_LEVEL_DEFAULT = 128

/** Safety margin (mm) when fitting the printed coloring page onto an A4 sheet. */
export const COLORING_PRINT_MARGIN_MM = 10
