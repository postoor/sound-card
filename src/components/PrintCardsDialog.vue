<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useDeckStore } from '../store/deck'
import { CARD_DIMENSIONS, EXPORT_PX_PER_MM } from '../constants/layout'
import { layoutCardsOnA4 } from '../utils/a4Layout'
import { renderCardToCanvas } from '../utils/canvasRender'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
}>()

const store = useDeckStore()

const selectedCards = computed(() => store.cards.filter((c) => store.selectedForPrint.has(c.id)))

function close() {
  emit('update:modelValue', false)
}

function setAll(checked: boolean) {
  for (const card of store.cards) {
    const has = store.selectedForPrint.has(card.id)
    if (checked && !has) store.togglePrintSelection(card.id)
    if (!checked && has) store.togglePrintSelection(card.id)
  }
}

interface PrintPlacement {
  dataUrl: string
  xMm: number
  yMm: number
  widthMm: number
  heightMm: number
}
const printPages = ref<PrintPlacement[][]>([])
const isBusy = ref(false)
const printReady = ref(false)

async function printSelected() {
  if (selectedCards.value.length === 0) return
  isBusy.value = true
  printReady.value = false
  try {
    const pages = layoutCardsOnA4(selectedCards.value)
    const result: PrintPlacement[][] = []
    for (const page of pages) {
      const placements: PrintPlacement[] = []
      for (const placed of page.cards) {
        const canvas = await renderCardToCanvas(placed.card, EXPORT_PX_PER_MM)
        const dims = CARD_DIMENSIONS[placed.card.type]
        placements.push({
          dataUrl: canvas.toDataURL('image/png'),
          xMm: placed.xMm,
          yMm: placed.yMm,
          widthMm: dims.width,
          heightMm: dims.height,
        })
      }
      result.push(placements)
    }
    printPages.value = result
    await nextTick()
    const imgs = document.querySelectorAll<HTMLImageElement>('.print-pages img')
    await Promise.all(Array.from(imgs).map((img) => img.decode().catch(() => {})))
    printReady.value = true
  } finally {
    isBusy.value = false
  }
}

function startPrint() {
  window.addEventListener('afterprint', () => {
    printPages.value = []
    printReady.value = false
  }, { once: true })
  window.print()
}
</script>

<template>
  <div v-if="modelValue" class="overlay" @click.self="close">
    <div class="dialog">
      <header class="dialog-header">
        <h3>列印卡片</h3>
        <button type="button" class="close-btn" @click="close">關閉</button>
      </header>
      <div class="select-actions">
        <button type="button" @click="setAll(true)">全選</button>
        <button type="button" @click="setAll(false)">取消全選</button>
      </div>
      <div class="card-list">
        <label v-for="card in store.cards" :key="card.id" class="select-item">
          <input
            type="checkbox"
            :checked="store.selectedForPrint.has(card.id)"
            @change="store.togglePrintSelection(card.id)"
          />
          {{ card.name }}（{{ card.type === 'landscape' ? '橫式' : '直式' }}）
        </label>
        <p v-if="store.cards.length === 0" class="empty">尚未建立任何卡片</p>
      </div>
      <footer class="dialog-footer">
        <button
          v-if="printReady"
          type="button"
          class="print-btn ready"
          @click="startPrint"
        >
          開始列印
        </button>
        <button
          v-else
          type="button"
          class="print-btn"
          :disabled="selectedCards.length === 0 || isBusy"
          @click="printSelected"
        >
          {{ isBusy ? '準備中…' : `列印（${selectedCards.length} 張）` }}
        </button>
      </footer>
    </div>
  </div>

  <Teleport to="body">
    <div v-if="printPages.length" class="print-pages print-root">
      <div v-for="(page, i) in printPages" :key="i" class="a4-page">
        <img
          v-for="(p, j) in page"
          :key="j"
          :src="p.dataUrl"
          class="placed-card"
          :style="{ left: `${p.xMm}mm`, top: `${p.yMm}mm`, width: `${p.widthMm}mm`, height: `${p.heightMm}mm` }"
        />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  width: min(420px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.dialog-header h3 {
  margin: 0;
  font-size: 15px;
}

.close-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.close-btn:hover {
  background: #f1f5f9;
}

.select-actions {
  display: flex;
  gap: 8px;
}

.select-actions button {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}

.select-actions button:hover {
  background: #f1f5f9;
}

.card-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.select-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.empty {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
}

.print-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.print-btn:hover:not(:disabled) {
  background: #f1f5f9;
}

.print-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.print-btn.ready {
  background: #1d4ed8;
  color: #fff;
  border-color: #1d4ed8;
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

.placed-card {
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
