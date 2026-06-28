<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useCutoutStore } from '../store/cutout'
import { useDeckStore } from '../store/deck'
import { CUTOUT_PRINT_MARGIN_MM } from '../constants/cutout'
import { A4 } from '../constants/layout'
import { layoutItemsOnA4 } from '../utils/a4Layout'
import { createStorageAdapter } from '../utils/fileStorage'
import { buildExportResult, canvasToPngBlob, createCanvas, loadImageElement, readFileAsDataUrl } from '../utils/cutout'
import CutoutCanvas from '../components/CutoutCanvas.vue'
import type { CutoutExportResult, ToolMode } from '../types/cutout'

const store = useCutoutStore()
const deckStore = useDeckStore()
const adapter = createStorageAdapter()

const TOOL_MODES: ToolMode[] = ['select', 'rect', 'ellipse', 'polygon', 'brush', 'eraser']
const TOOL_LABELS: Record<ToolMode, string> = {
  select: '選取/移動',
  rect: '矩形',
  ellipse: '橢圓',
  polygon: '多邊形',
  brush: '筆刷',
  eraser: '橡皮擦',
}
const SHAPE_LABELS: Record<'rect' | 'ellipse' | 'polygon', string> = {
  rect: '矩形',
  ellipse: '橢圓',
  polygon: '多邊形',
}

const fileInput = ref<HTMLInputElement>()
const isDragging = ref(false)
const saveToDirectory = ref(true)
const addToMaterials = ref(true)
const status = ref('')
const isBusy = ref(false)

const hasDirectory = ref(adapter.hasDirectory())
const directoryName = ref(adapter.getDirectoryName())

interface PrintPlacement {
  dataUrl: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}
const printPages = ref<PrintPlacement[][]>([])

const selectionItems = computed(() => {
  const counts: Record<string, number> = {}
  return store.selections.map((sel) => {
    counts[sel.type] = (counts[sel.type] ?? 0) + 1
    return { id: sel.id, label: `${SHAPE_LABELS[sel.type]} ${counts[sel.type]}` }
  })
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

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) { input.value = ''; return }
  try {
    await loadFile(file)
  } finally {
    await nextTick()
    input.value = ''
  }
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

function selectShape(id: string) {
  store.setToolMode('select')
  store.selectShape(id)
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

async function handleExport() {
  if (!store.sourceCanvas) return
  if (!saveToDirectory.value && !addToMaterials.value) {
    status.value = '請至少選擇一個輸出去向'
    return
  }
  if (saveToDirectory.value && !hasDirectory.value) {
    status.value = '請先選擇資料夾'
    return
  }

  isBusy.value = true
  try {
    status.value = '處理中...'
    const result = buildExportResult(store.sourceCanvas, store.selections, store.brushMask)
    const base = sanitizeFilename(store.sourceFilename || 'image')
    const hollowedBlob = await canvasToPngBlob(result.hollowed)
    const pieceBlobs = await Promise.all(result.pieces.map((p) => canvasToPngBlob(p.canvas)))

    if (saveToDirectory.value) {
      await adapter.saveFile(`${base}_hollowed.png`, hollowedBlob, 'cutouts')
      for (let i = 0; i < pieceBlobs.length; i++) {
        await adapter.saveFile(`${base}_piece_${i + 1}.png`, pieceBlobs[i], 'cutouts')
      }
    }

    if (addToMaterials.value) {
      deckStore.addMaterial({
        name: `${base}_hollowed`,
        dataUrl: result.hollowed.toDataURL('image/png'),
        naturalWidth: result.hollowed.width,
        naturalHeight: result.hollowed.height,
      })
      result.pieces.forEach((p, i) => {
        deckStore.addMaterial({
          name: `${base}_piece_${i + 1}`,
          dataUrl: p.canvas.toDataURL('image/png'),
          naturalWidth: p.canvas.width,
          naturalHeight: p.canvas.height,
        })
      })
    }

    status.value = `完成：已輸出挖空圖與 ${result.pieces.length} 個挖出件`
  } finally {
    isBusy.value = false
  }
}

/** mm per natural px: largest scale that fits the main image inside the A4 safety area. */
function mainPrintScale(hollowed: HTMLCanvasElement): number {
  const availW = A4.width - 2 * CUTOUT_PRINT_MARGIN_MM
  const availH = A4.height - 2 * CUTOUT_PRINT_MARGIN_MM
  return Math.min(availW / hollowed.width, availH / hollowed.height)
}

async function showPrintPages(pages: PrintPlacement[][]) {
  printPages.value = pages
  await nextTick()
  const imgs = document.querySelectorAll<HTMLImageElement>('.print-pages img')
  await Promise.all(Array.from(imgs).map((img) => img.decode().catch(() => {})))
  window.addEventListener('afterprint', () => { printPages.value = [] }, { once: true })
  window.print()
}

function buildMainPage(result: CutoutExportResult): PrintPlacement[] {
  const scale = mainPrintScale(result.hollowed)
  const widthMm = result.hollowed.width * scale
  const heightMm = result.hollowed.height * scale
  return [
    {
      dataUrl: result.hollowed.toDataURL('image/png'),
      xMm: (A4.width - widthMm) / 2,
      yMm: (A4.height - heightMm) / 2,
      widthMm,
      heightMm,
    },
  ]
}

/** Pieces are laid out at the same physical scale as the printed main image
 *  so they fit back into its holes. */
function buildPiecePages(result: CutoutExportResult): PrintPlacement[][] {
  const scale = mainPrintScale(result.hollowed)
  const items = result.pieces.map((p, i) => ({
    id: String(i),
    widthMm: p.canvas.width * scale,
    heightMm: p.canvas.height * scale,
  }))
  const dataUrls = result.pieces.map((p) => p.canvas.toDataURL('image/png'))
  return layoutItemsOnA4(items).map((page) =>
    page.map((placed) => {
      const index = Number(placed.id)
      return {
        dataUrl: dataUrls[index],
        xMm: placed.xMm,
        yMm: placed.yMm,
        widthMm: items[index].widthMm,
        heightMm: items[index].heightMm,
      }
    }),
  )
}

async function printMain() {
  if (!store.sourceCanvas) return
  const result = buildExportResult(store.sourceCanvas, store.selections, store.brushMask)
  await showPrintPages([buildMainPage(result)])
}

async function printPieces() {
  if (!store.sourceCanvas) return
  const result = buildExportResult(store.sourceCanvas, store.selections, store.brushMask)
  if (result.pieces.length === 0) {
    status.value = '尚無零件可列印'
    return
  }
  await showPrintPages(buildPiecePages(result))
}

async function printAll() {
  if (!store.sourceCanvas) return
  const result = buildExportResult(store.sourceCanvas, store.selections, store.brushMask)
  await showPrintPages([buildMainPage(result), ...buildPiecePages(result)])
}
</script>

<template>
  <div class="cutout-view">
    <div class="body">
      <aside class="sidebar">
        <section class="section">
          <h3>圖片</h3>
          <button type="button" @click="triggerUpload">上傳圖片</button>
          <input ref="fileInput" class="hidden-input" type="file" accept="image/*" @change="onFileChange" />
          <p v-if="store.sourceFilename" class="filename">{{ store.sourceFilename }}</p>
        </section>

        <section class="section">
          <h3>工具</h3>
          <div class="tool-grid">
            <button
              v-for="mode in TOOL_MODES"
              :key="mode"
              type="button"
              :class="{ active: store.toolMode === mode }"
              @click="store.setToolMode(mode)"
            >
              {{ TOOL_LABELS[mode] }}
            </button>
          </div>
          <div v-if="store.toolMode === 'brush' || store.toolMode === 'eraser'" class="brush-controls">
            <label>筆刷大小：{{ store.brushSize }}px</label>
            <input v-model.number="store.brushSize" type="range" min="4" max="200" step="1" />
          </div>
          <button type="button" class="secondary" @click="store.clearBrushMask()">清除筆刷遮罩</button>
        </section>

        <section class="section">
          <h3>選區列表</h3>
          <p v-if="selectionItems.length === 0" class="empty">尚無選區</p>
          <ul v-else class="selection-list">
            <li
              v-for="item in selectionItems"
              :key="item.id"
              :class="{ active: item.id === store.selectedId }"
              @click="selectShape(item.id)"
            >
              <span>{{ item.label }}</span>
              <button type="button" @click.stop="store.removeSelection(item.id)">刪除</button>
            </li>
          </ul>
        </section>

        <section class="section">
          <h3>輸出</h3>
          <label class="checkbox">
            <input v-model="saveToDirectory" type="checkbox" />
            存入目錄（cutouts/）
          </label>
          <label class="checkbox">
            <input v-model="addToMaterials" type="checkbox" />
            加入卡片素材
          </label>
          <button v-if="adapter.supportsDirectoryPicker" type="button" :disabled="isBusy" @click="pickDirectory">選擇資料夾</button>
          <span v-if="directoryName" class="dir-name">資料夾：{{ directoryName }}</span>
          <p v-if="!adapter.supportsDirectoryPicker" class="note">
            您的瀏覽器不支援直接存取資料夾，檔案將個別下載到瀏覽器下載資料夾。
          </p>
          <button type="button" class="export-btn" :disabled="!store.sourceCanvas || isBusy" @click="handleExport">
            一鍵輸出
          </button>
          <p v-if="status" class="status" :class="{ busy: isBusy }">{{ status }}</p>
        </section>

        <section class="section">
          <h3>列印</h3>
          <button type="button" :disabled="!store.sourceCanvas || isBusy" @click="printMain">列印主圖</button>
          <button type="button" :disabled="!store.sourceCanvas || isBusy" @click="printPieces">列印零件</button>
          <button type="button" :disabled="!store.sourceCanvas || isBusy" @click="printAll">列印主圖＋零件</button>
          <p class="note">零件以與主圖相同比例排版，剪下後可對回主圖洞口。</p>
        </section>
      </aside>

      <main class="main" :class="{ dragging: isDragging }" @dragover="onDragOver" @dragleave="onDragLeave" @drop="onDrop">
        <CutoutCanvas v-if="store.sourceCanvas" />
        <div v-else class="dropzone" @click="triggerUpload">
          <p>拖放圖片至此，或點擊上傳</p>
        </div>
      </main>
    </div>
  </div>
  <Teleport to="body">
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
  </Teleport>
</template>

<style scoped>
.cutout-view {
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

.section button.secondary {
  color: #64748b;
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

.brush-controls {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #475569;
}

.selection-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.selection-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
  font-size: 12px;
  cursor: pointer;
}

.selection-list li.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.selection-list li button {
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
}

.checkbox {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.export-btn {
  font-weight: 600;
}


.dir-name,
.note,
.status,
.empty {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}

.status.busy {
  color: #2563eb;
}

.main {
  flex: 1;
  padding: 24px;
  overflow: auto;
  display: flex;
  align-items: flex-start;
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

/* Rendered off-screen (not display:none) so images are decoded before printing. */
.print-pages {
  position: fixed;
  top: 0;
  left: 0;
  transform: translateX(-10000px);
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
    transform: none;
  }
}
</style>
