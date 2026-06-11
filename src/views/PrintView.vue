<script setup lang="ts">
import { computed } from 'vue'
import { useDeckStore } from '../store/deck'
import A4PrintView from '../components/A4PrintView.vue'

const store = useDeckStore()

const selectedCards = computed(() => store.cards.filter((c) => store.selectedForPrint.has(c.id)))

function setAll(checked: boolean) {
  for (const card of store.cards) {
    const has = store.selectedForPrint.has(card.id)
    if (checked && !has) store.togglePrintSelection(card.id)
    if (!checked && has) store.togglePrintSelection(card.id)
  }
}
</script>

<template>
  <div class="print-page">
    <aside class="selection no-print">
      <h3>選擇要列印的卡片</h3>
      <div class="select-actions">
        <button type="button" @click="setAll(true)">全選</button>
        <button type="button" @click="setAll(false)">取消全選</button>
      </div>
      <label v-for="card in store.cards" :key="card.id" class="select-item">
        <input
          type="checkbox"
          :checked="store.selectedForPrint.has(card.id)"
          @change="store.togglePrintSelection(card.id)"
        />
        {{ card.name }}（{{ card.type === 'landscape' ? '橫式' : '直式' }}）
      </label>
      <p v-if="store.cards.length === 0" class="empty">尚未建立任何卡片</p>
    </aside>
    <div class="preview">
      <A4PrintView :cards="selectedCards" />
    </div>
  </div>
</template>

<style scoped>
.print-page {
  display: flex;
  height: 100%;
  min-height: 0;
}

.selection {
  width: 240px;
  flex: none;
  padding: 12px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selection h3 {
  margin: 0;
  font-size: 14px;
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

.select-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.empty {
  font-size: 13px;
  color: #9ca3af;
}

.preview {
  flex: 1;
  overflow: auto;
  padding: 24px;
}
</style>
