<script setup lang="ts">
import { ref } from 'vue'
import { useDeckStore } from '../store/deck'
import { createStorageAdapter } from '../utils/fileStorage'
import { exportCardToPngBlob } from '../utils/exportCard'
import type { ProjectState } from '../types/card'

const store = useDeckStore()
const adapter = createStorageAdapter()
const hasDirectory = ref(adapter.hasDirectory())
const status = ref('')
const importInput = ref<HTMLInputElement>()

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[\\/:*?"<>|]+/g, '_') || 'card'
}

async function pickDirectory() {
  try {
    await adapter.pickDirectory()
    hasDirectory.value = adapter.hasDirectory()
    status.value = '已選擇資料夾'
  } catch (err) {
    if ((err as Error)?.name !== 'AbortError') {
      status.value = '選擇資料夾失敗'
    }
  }
}

async function exportActiveCard() {
  const card = store.cards.find((c) => c.id === store.activeCardId)
  if (!card) return
  status.value = '匯出中...'
  const blob = await exportCardToPngBlob(card)
  await adapter.saveFile(`${sanitizeFilename(card.name)}.png`, blob)
  status.value = `已匯出 ${card.name}.png`
}

async function saveAll() {
  if (store.cards.length === 0) {
    status.value = '尚無卡片可匯出'
    return
  }
  status.value = '匯出中...'
  for (const card of store.cards) {
    const blob = await exportCardToPngBlob(card)
    await adapter.saveFile(`${sanitizeFilename(card.name)}.png`, blob)
  }
  await adapter.saveJson('project.json', store.toProjectState())
  status.value = `已儲存 ${store.cards.length} 張卡片與 project.json`
}

function triggerImport() {
  importInput.value?.click()
}

function onImportFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string) as ProjectState
      if (data.version !== 1 || !Array.isArray(data.cards)) throw new Error('格式不符')
      store.loadProject(data)
      status.value = '已匯入專案'
    } catch {
      status.value = '匯入失敗：檔案格式錯誤'
    }
  }
  reader.readAsText(file)
  input.value = ''
}
</script>

<template>
  <div class="toolbar">
    <div class="group">
      <button v-if="adapter.supportsDirectoryPicker" type="button" @click="pickDirectory">選擇資料夾</button>
      <button type="button" :disabled="!hasDirectory" @click="saveAll">
        {{ adapter.supportsDirectoryPicker ? '儲存全部到資料夾' : '下載全部' }}
      </button>
      <button type="button" :disabled="!store.activeCardId" @click="exportActiveCard">
        {{ adapter.supportsDirectoryPicker ? '儲存目前卡片' : '下載目前卡片' }}
      </button>
      <button type="button" @click="triggerImport">匯入專案</button>
      <input ref="importInput" class="hidden-input" type="file" accept="application/json" @change="onImportFile" />
    </div>
    <p v-if="!adapter.supportsDirectoryPicker" class="note">
      您的瀏覽器不支援直接存取資料夾，檔案將個別下載到瀏覽器下載資料夾。
    </p>
    <p v-if="status" class="status">{{ status }}</p>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  background: #fff;
}

.group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.group button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.group button:hover:not(:disabled) {
  background: #f1f5f9;
}

.group button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.hidden-input {
  display: none;
}

.note,
.status {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
</style>
