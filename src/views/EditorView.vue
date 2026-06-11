<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDeckStore } from '../store/deck'
import DeckList from '../components/DeckList.vue'
import CardEditor from '../components/CardEditor.vue'
import PrintCardsDialog from '../components/PrintCardsDialog.vue'
import ToolbarExport from '../components/ToolbarExport.vue'

const store = useDeckStore()

const activeCard = computed(() => store.cards.find((c) => c.id === store.activeCardId) ?? null)
const showPrintDialog = ref(false)
</script>

<template>
  <div class="editor-view">
    <ToolbarExport />
    <div class="body">
      <aside class="sidebar">
        <button type="button" class="print-cards-btn" @click="showPrintDialog = true">列印卡片</button>
        <DeckList />
      </aside>
      <main class="main">
        <CardEditor v-if="activeCard" :card="activeCard" :key="activeCard.id" />
        <p v-else class="empty">請先在左側新增一張卡片</p>
      </main>
    </div>
    <PrintCardsDialog v-model="showPrintDialog" />
  </div>
</template>

<style scoped>
.editor-view {
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
  width: 240px;
  flex: none;
  padding: 12px;
  border-right: 1px solid #e2e8f0;
  background: #f8fafc;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.print-cards-btn {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.print-cards-btn:hover {
  background: #f1f5f9;
}

.main {
  flex: 1;
  padding: 24px;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
}

.empty {
  color: #9ca3af;
  font-size: 14px;
}
</style>
