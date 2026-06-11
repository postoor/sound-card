<script setup lang="ts">
import { computed } from 'vue'
import { useDeckStore } from '../store/deck'
import DeckList from '../components/DeckList.vue'
import CardEditor from '../components/CardEditor.vue'
import ToolbarExport from '../components/ToolbarExport.vue'

const store = useDeckStore()

const activeCard = computed(() => store.cards.find((c) => c.id === store.activeCardId) ?? null)
</script>

<template>
  <div class="editor-view">
    <ToolbarExport />
    <div class="body">
      <aside class="sidebar">
        <DeckList />
      </aside>
      <main class="main">
        <CardEditor v-if="activeCard" :card="activeCard" :key="activeCard.id" />
        <p v-else class="empty">請先在左側新增一張卡片</p>
      </main>
    </div>
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
