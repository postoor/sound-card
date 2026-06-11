<script setup lang="ts">
import { ref } from 'vue'
import EditorView from './views/EditorView.vue'
import PrintView from './views/PrintView.vue'

const tab = ref<'editor' | 'print'>('editor')
</script>

<template>
  <div class="app">
    <header class="app-header no-print">
      <h1>點讀卡製作器</h1>
      <nav class="tabs">
        <button type="button" :class="{ active: tab === 'editor' }" @click="tab = 'editor'">編輯卡片</button>
        <button type="button" :class="{ active: tab === 'print' }" @click="tab = 'print'">列印排版</button>
      </nav>
    </header>
    <div class="app-body">
      <EditorView v-if="tab === 'editor'" />
      <PrintView v-else />
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: #1e293b;
  color: #fff;
}

.app-header h1 {
  font-size: 16px;
  margin: 0;
}

.tabs {
  display: flex;
  gap: 8px;
}

.tabs button {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid transparent;
  background: transparent;
  color: #cbd5e1;
  cursor: pointer;
  font-size: 13px;
}

.tabs button:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tabs button.active {
  background: #fff;
  color: #1e293b;
  font-weight: 600;
}

.app-body {
  flex: 1;
  min-height: 0;
}
</style>
