<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { A4, CARD_DIMENSIONS, EXPORT_PX_PER_MM } from '../constants/layout'
import { layoutCardsOnA4 } from '../utils/a4Layout'
import { renderCardToCanvas } from '../utils/canvasRender'
import { createStorageAdapter } from '../utils/fileStorage'
import type { Card } from '../types/card'

const props = defineProps<{
  cards: Card[]
}>()

const pages = computed(() => layoutCardsOnA4(props.cards))

interface RenderedPlacement {
  card: Card
  xMm: number
  yMm: number
  dataUrl: string
}
interface RenderedPage {
  cards: RenderedPlacement[]
}

const renderedPages = ref<RenderedPage[]>([])
const status = ref('')
const adapter = createStorageAdapter()

async function renderAll() {
  const result: RenderedPage[] = []
  for (const page of pages.value) {
    const placements: RenderedPlacement[] = []
    for (const placed of page.cards) {
      const canvas = await renderCardToCanvas(placed.card, EXPORT_PX_PER_MM)
      placements.push({
        card: placed.card,
        xMm: placed.xMm,
        yMm: placed.yMm,
        dataUrl: canvas.toDataURL('image/png'),
      })
    }
    result.push({ cards: placements })
  }
  renderedPages.value = result
}

watch(() => props.cards, renderAll, { immediate: true, deep: true })

function placementStyle(p: RenderedPlacement) {
  const dims = CARD_DIMENSIONS[p.card.type]
  return {
    left: `${p.xMm}mm`,
    top: `${p.yMm}mm`,
    width: `${dims.width}mm`,
    height: `${dims.height}mm`,
  }
}

function print() {
  window.print()
}

function loadDataUrlImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

async function exportPages() {
  if (renderedPages.value.length === 0) return
  status.value = '匯出中...'
  const pageWidthPx = Math.round(A4.width * EXPORT_PX_PER_MM)
  const pageHeightPx = Math.round(A4.height * EXPORT_PX_PER_MM)
  let i = 0
  for (const page of renderedPages.value) {
    i++
    const canvas = document.createElement('canvas')
    canvas.width = pageWidthPx
    canvas.height = pageHeightPx
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    for (const placement of page.cards) {
      const img = await loadDataUrlImage(placement.dataUrl)
      ctx.drawImage(img, Math.round(placement.xMm * EXPORT_PX_PER_MM), Math.round(placement.yMm * EXPORT_PX_PER_MM))
    }
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'),
    )
    await adapter.saveFile(`a4-page-${i}.png`, blob)
  }
  status.value = `已匯出 ${renderedPages.value.length} 頁`
}
</script>

<template>
  <div class="a4-print-view">
    <div class="controls no-print">
      <button type="button" :disabled="renderedPages.length === 0" @click="print">列印</button>
      <button type="button" :disabled="renderedPages.length === 0" @click="exportPages">匯出 PNG</button>
      <span v-if="status" class="status">{{ status }}</span>
    </div>
    <p v-if="pages.length === 0" class="empty no-print">請先選取要列印的卡片</p>
    <div v-for="(page, i) in renderedPages" :key="i" class="a4-page">
      <img v-for="(p, j) in page.cards" :key="j" :src="p.dataUrl" class="placed-card" :style="placementStyle(p)" />
    </div>
  </div>
</template>

<style scoped>
.a4-print-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.controls {
  display: flex;
  gap: 8px;
  align-items: center;
}

.controls button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.controls button:hover:not(:disabled) {
  background: #f1f5f9;
}

.controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.status {
  font-size: 12px;
  color: #6b7280;
}

.empty {
  font-size: 13px;
  color: #9ca3af;
}

.a4-page {
  position: relative;
  width: 210mm;
  height: 297mm;
  background: #fff;
  box-shadow: 0 0 6px rgba(0, 0, 0, 0.2);
  flex: none;
}

.placed-card {
  position: absolute;
  display: block;
}
</style>

<style>
@media print {
  @page {
    size: A4;
    margin: 0;
  }
  body * {
    visibility: hidden;
  }
  .a4-page,
  .a4-page * {
    visibility: visible;
  }
  .a4-page {
    position: absolute;
    top: 0;
    left: 0;
    box-shadow: none;
    page-break-after: always;
  }
  .no-print {
    display: none !important;
  }
}
</style>
