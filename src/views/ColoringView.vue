<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'
import { useColoringStore } from '../store/coloring'
import {
  COLORING_PREVIEW_MAX_DIM,
  COLORING_PRINT_MARGIN_MM,
  EDGE_SIGMA_MAX,
  EDGE_SIGMA_MIN,
  EDGE_STRENGTH_MAX,
  EDGE_STRENGTH_MIN,
  THRESHOLD_LEVEL_MAX,
  THRESHOLD_LEVEL_MIN,
} from '../constants/coloring'
import { A4 } from '../constants/layout'
import { createStorageAdapter } from '../utils/fileStorage'
import { buildDisplayCanvas, canvasToPngBlob, computeDisplayScale, createCanvas, loadImageElement, readFileAsDataUrl } from '../utils/cutout'
import { ensureModel, generateLineart, type LineartEngine } from '../utils/lineart'
import CanvasPreview from '../components/CanvasPreview.vue'

const store = useColoringStore()
const adapter = createStorageAdapter()

const ENGINES: LineartEngine[] = ['ml', 'edge', 'threshold']
const ENGINE_LABELS: Record<LineartEngine, string> = {
  ml: 'ML 線稿',
  edge: '邊緣偵測',
  threshold: '亮度閾值',
}

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const status = ref('')
const isExporting = ref(false)
const isPrinting = ref(false)

interface PrintPlacement {
  dataUrl: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}
const printPages = ref<PrintPlacement[][]>([])

const hasDirectory = ref(adapter.hasDirectory())
const directoryName = ref(adapter.getDirectoryName())

const originalPreview = computed(() => {
  const canvas = store.sourceCanvas
  if (!canvas) return null
  const scale = computeDisplayScale(canvas.width, canvas.height, COLORING_PREVIEW_MAX_DIM)
  return buildDisplayCanvas(canvas, scale)
})

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'image'
}

function triggerUpload() {
  fileInput.value?.click()
}

async function loadFile(file: File) {
  if (!file.type.startsWith('image/')) return
  const dataUrl = await readFileAsDataUrl(file)
  const img = await loadImageElement(dataUrl)
  const canvas = createCanvas(img.naturalWidth, img.naturalHeight)
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  store.loadImage(canvas, file.name.replace(/\.[^.]+$/, ''))
  status.value = ''
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) loadFile(file)
  input.value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) loadFile(file)
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragging.value = true
}

function onDragLeave() {
  isDragging.value = false
}

async function pickDirectory() {
  try {
    await adapter.pickDirectory()
    hasDirectory.value = adapter.hasDirectory()
    directoryName.value = adapter.getDirectoryName()
    status.value = directoryName.value ? `已選擇資料夾：${directoryName.value}` : '已選擇資料夾'
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') status.value = '選擇資料夾失敗'
  }
}

async function loadMlModel() {
  if (store.mlState === 'loading' || store.mlState === 'ready') return
  store.mlState = 'loading'
  store.mlProgress = 0
  store.mlError = ''
  try {
    store.mlEp = await ensureModel((ratio) => {
      store.mlProgress = ratio
    })
    store.mlState = 'ready'
  } catch (err) {
    store.mlState = 'failed'
    store.mlError = err instanceof Error ? err.message : 'ML 模型載入失敗'
    if (store.engine === 'ml') store.engine = 'edge'
  }
}

function selectEngine(next: LineartEngine) {
  if (next === 'ml') {
    store.engine = 'ml'
    if (store.mlState === 'unloaded' || store.mlState === 'failed') {
      loadMlModel()
    }
    return
  }
  store.engine = next
}

let processingId = 0

function regenerate() {
  if (debounceTimer !== undefined) {
    clearTimeout(debounceTimer)
    debounceTimer = undefined
  }
  recompute()
}

async function recompute() {
  const canvas = store.sourceCanvas
  if (!canvas) {
    store.previewCanvas = null
    return
  }

  if (store.engine === 'ml') {
    if (store.mlState === 'unloaded') {
      loadMlModel()
      return
    }
    if (store.mlState !== 'ready') return
  }

  const id = ++processingId
  store.isProcessing = true
  try {
    const result = await generateLineart(
      canvas,
      store.engine,
      { edge: store.edgeParams, threshold: store.thresholdParams },
      COLORING_PREVIEW_MAX_DIM,
    )
    if (id === processingId) store.previewCanvas = result
  } catch (err) {
    status.value = `處理失敗：${err instanceof Error ? err.message : String(err)}`
  } finally {
    if (id === processingId) store.isProcessing = false
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | undefined

watch(
  () => [
    store.sourceCanvas,
    store.engine,
    store.mlState,
    store.edgeParams.sigma,
    store.edgeParams.strength,
    store.thresholdParams.level,
  ],
  () => {
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(recompute, 200)
  },
  { immediate: true },
)

onUnmounted(() => {
  if (debounceTimer !== undefined) clearTimeout(debounceTimer)
})

async function exportPng() {
  if (!store.sourceCanvas || !hasDirectory.value) {
    if (!hasDirectory.value) status.value = '請先選擇資料夾'
    return
  }
  isExporting.value = true
  try {
    status.value = '輸出中...'
    const result = await generateLineart(store.sourceCanvas, store.engine, {
      edge: store.edgeParams,
      threshold: store.thresholdParams,
    })
    const blob = await canvasToPngBlob(result)
    const base = sanitizeFilename(store.sourceFilename || 'image')
    await adapter.saveFile(`${base}_coloring.png`, blob, 'coloring')
    status.value = `完成：已輸出 ${base}_coloring.png`
  } finally {
    isExporting.value = false
  }
}

/** mm per natural px: largest scale that fits the result inside the A4 safety area. */
function printScale(canvas: HTMLCanvasElement): number {
  const availW = A4.width - 2 * COLORING_PRINT_MARGIN_MM
  const availH = A4.height - 2 * COLORING_PRINT_MARGIN_MM
  return Math.min(availW / canvas.width, availH / canvas.height)
}

async function showPrintPages(pages: PrintPlacement[][]) {
  printPages.value = pages
  await nextTick()
  window.print()
  printPages.value = []
}

async function printResult() {
  if (!store.sourceCanvas) return
  isPrinting.value = true
  try {
    const result = await generateLineart(store.sourceCanvas, store.engine, {
      edge: store.edgeParams,
      threshold: store.thresholdParams,
    })
    const scale = printScale(result)
    const widthMm = result.width * scale
    const heightMm = result.height * scale
    await showPrintPages([
      [
        {
          dataUrl: result.toDataURL('image/png'),
          xMm: (A4.width - widthMm) / 2,
          yMm: (A4.height - heightMm) / 2,
          widthMm,
          heightMm,
        },
      ],
    ])
  } finally {
    isPrinting.value = false
  }
}
</script>

<template>
  <div class="coloring-view">
    <div class="body">
      <aside class="sidebar">
        <section class="section">
          <h3>圖片</h3>
          <button type="button" @click="triggerUpload">上傳圖片</button>
          <input ref="fileInput" class="hidden-input" type="file" accept="image/*" @change="onFileChange" />
          <p v-if="store.sourceFilename" class="filename">{{ store.sourceFilename }}</p>
        </section>

        <section class="section">
          <h3>引擎</h3>
          <div class="tool-grid">
            <button
              v-for="key in ENGINES"
              :key="key"
              type="button"
              :class="{ active: store.engine === key }"
              @click="selectEngine(key)"
            >
              {{ ENGINE_LABELS[key] }}
            </button>
          </div>
          <button type="button" :disabled="!store.sourceCanvas || store.isProcessing" @click="regenerate">重新產生</button>
          <div v-if="store.engine === 'ml'" class="ml-status">
            <p v-if="store.mlState === 'loading'" class="note">下載模型中...{{ Math.round(store.mlProgress * 100) }}%</p>
            <p v-else-if="store.mlState === 'ready'" class="note">
              使用中：{{ store.mlEp === 'webgpu' ? 'WebGPU' : 'WASM' }}
            </p>
          </div>
          <p v-if="store.mlState === 'failed'" class="note error">
            ML 線稿載入失敗：{{ store.mlError }}（已自動切換為邊緣偵測）
          </p>
        </section>

        <section v-if="store.engine === 'edge'" class="section">
          <h3>參數</h3>
          <label>模糊半徑：{{ store.edgeParams.sigma.toFixed(1) }}</label>
          <input v-model.number="store.edgeParams.sigma" type="range" :min="EDGE_SIGMA_MIN" :max="EDGE_SIGMA_MAX" step="0.1" />
          <label>強度：{{ store.edgeParams.strength }}</label>
          <input v-model.number="store.edgeParams.strength" type="range" :min="EDGE_STRENGTH_MIN" :max="EDGE_STRENGTH_MAX" step="1" />
        </section>

        <section v-else-if="store.engine === 'threshold'" class="section">
          <h3>參數</h3>
          <label>亮度閾值：{{ store.thresholdParams.level }}</label>
          <input v-model.number="store.thresholdParams.level" type="range" :min="THRESHOLD_LEVEL_MIN" :max="THRESHOLD_LEVEL_MAX" step="1" />
        </section>

        <section class="section">
          <h3>輸出</h3>
          <button v-if="adapter.supportsDirectoryPicker" type="button" :disabled="isExporting" @click="pickDirectory">選擇資料夾</button>
          <span v-if="directoryName" class="dir-name">資料夾：{{ directoryName }}</span>
          <p v-if="!adapter.supportsDirectoryPicker" class="note">
            您的瀏覽器不支援直接存取資料夾，檔案將個別下載到瀏覽器下載資料夾。
          </p>
          <button type="button" class="export-btn" :disabled="!store.sourceCanvas || isExporting || isPrinting" @click="exportPng">輸出 PNG</button>
          <p v-if="status" class="status" :class="{ busy: isExporting }">{{ status }}</p>
        </section>

        <section class="section">
          <h3>列印</h3>
          <button type="button" :disabled="!store.sourceCanvas || isExporting || isPrinting" @click="printResult">列印</button>
          <p class="note">以原圖解析度重新產生著色稿，置中列印於 A4。</p>
        </section>
      </aside>

      <main class="main" :class="{ dragging: isDragging }" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
        <div v-if="!store.sourceCanvas" class="dropzone" @click="triggerUpload">
          <p>拖放圖片至此，或點擊上傳</p>
        </div>
        <div v-else class="preview-grid">
          <div class="preview-pane">
            <h4>原圖</h4>
            <CanvasPreview :canvas="originalPreview" />
          </div>
          <div class="preview-pane">
            <h4>著色稿{{ store.isProcessing ? '（處理中...）' : '' }}</h4>
            <CanvasPreview v-if="store.previewCanvas" :canvas="store.previewCanvas" />
            <div v-else class="placeholder">處理中...</div>
          </div>
        </div>
      </main>
    </div>

    <div v-if="printPages.length" class="print-pages print-root">
      <div v-for="(page, i) in printPages" :key="i" class="a4-page">
        <img
          v-for="(p, j) in page"
          :key="j"
          :src="p.dataUrl"
          class="placed-piece"
          :style="{ left: `${p.xMm}mm`, top: `${p.yMm}mm`, width: `${p.widthMm}mm`, height: `${p.heightMm}mm` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.coloring-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

.sidebar {
  width: 260px;
  flex: none;
  padding: 12px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section h3 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #475569;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.section button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.section button:hover:not(:disabled) {
  background: #f1f5f9;
}

.section button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hidden-input {
  display: none;
}

.filename {
  margin: 0;
  font-size: 12px;
  color: #475569;
  word-break: break-all;
}

.tool-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.tool-grid button.active {
  background: #1e293b;
  color: #fff;
  border-color: #1e293b;
}

.section label {
  font-size: 12px;
  color: #475569;
}

.export-btn {
  font-weight: 600;
}

.dir-name,
.note,
.status {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.note.error {
  color: #dc2626;
}

.status.busy {
  color: #2563eb;
}

.main {
  flex: 1;
  padding: 24px;
  overflow: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.main.dragging {
  background: #eff6ff;
}

.dropzone {
  width: 100%;
  height: 100%;
  min-height: 240px;
  border: 2px dashed #9ca3af;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  font-size: 14px;
  cursor: pointer;
}

.dropzone:hover {
  background: #f8fafc;
}

.preview-grid {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.preview-pane {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.preview-pane h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #475569;
  text-align: center;
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  font-size: 13px;
  border: 1px dashed #e2e8f0;
  border-radius: 8px;
}

/* Rendered off-screen (not display:none) so images are decoded before printing. */
.print-pages {
  position: fixed;
  top: 0;
  left: -10000px;
}

.print-pages .a4-page {
  position: relative;
  width: 210mm;
  height: 297mm;
  background: #fff;
}

.placed-piece {
  position: absolute;
  display: block;
}

@media print {
  .print-pages {
    position: absolute;
    top: 0;
    left: 0;
  }
}
</style>
