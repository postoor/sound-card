<script setup lang="ts">
import { useDeckStore } from '../store/deck'
import type { ImageAsset } from '../types/card'

defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [boolean]
  select: [ImageAsset]
}>()

const store = useDeckStore()

function close() {
  emit('update:modelValue', false)
}

function pick(asset: ImageAsset) {
  emit('select', asset)
  close()
}
</script>

<template>
  <div v-if="modelValue" class="overlay" @click.self="close">
    <div class="picker">
      <header class="picker-header">
        <h3>從素材庫選擇</h3>
        <button type="button" class="close-btn" @click="close">關閉</button>
      </header>
      <p v-if="store.materials.length === 0" class="empty">
        尚無素材，請至「圖片挖空」分頁產生並加入素材庫。
      </p>
      <div v-else class="grid">
        <div v-for="asset in store.materials" :key="asset.id" class="item">
          <button type="button" class="thumb-btn" @click="pick(asset)">
            <img :src="asset.dataUrl" :alt="asset.name" class="thumb" />
          </button>
          <div class="item-footer">
            <span class="name" :title="asset.name">{{ asset.name }}</span>
            <button type="button" class="remove-btn" @click="store.removeMaterial(asset.id)">刪除</button>
          </div>
        </div>
      </div>
    </div>
  </div>
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

.picker {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  width: min(640px, 90vw);
  max-height: 80vh;
  overflow-y: auto;
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.picker-header h3 {
  margin: 0;
  font-size: 15px;
}

.close-btn,
.remove-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}

.close-btn:hover,
.remove-btn:hover {
  background: #f1f5f9;
}

.empty {
  color: #9ca3af;
  font-size: 13px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.thumb-btn {
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: repeating-conic-gradient(#f1f5f9 0% 25%, #fff 0% 50%) 50% / 16px 16px;
  padding: 0;
  cursor: pointer;
  aspect-ratio: 1 / 1;
  overflow: hidden;
}

.thumb-btn:hover {
  outline: 2px solid #3b82f6;
}

.thumb {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.name {
  font-size: 11px;
  color: #475569;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
