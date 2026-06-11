<script setup lang="ts">
import { useDeckStore } from '../store/deck'
import CardThumbnail from './CardThumbnail.vue'

const store = useDeckStore()

function selectCard(id: string) {
  store.setActiveCard(id)
}

function removeCard(id: string, e: Event) {
  e.stopPropagation()
  if (confirm('確定要刪除這張卡片嗎？')) {
    store.removeCard(id)
  }
}
</script>

<template>
  <div class="deck-list">
    <div class="add-buttons">
      <button type="button" @click="store.addCard('landscape')">+ 新增橫式卡片</button>
      <button type="button" @click="store.addCard('portrait')">+ 新增直式卡片</button>
    </div>
    <div class="cards">
      <div
        v-for="card in store.cards"
        :key="card.id"
        class="card-item"
        :class="{ active: card.id === store.activeCardId }"
        @click="selectCard(card.id)"
      >
        <div class="thumb-wrap" :class="card.type">
          <CardThumbnail :card="card" />
        </div>
        <div class="card-info">
          <input class="card-name" type="text" v-model="card.name" @click.stop />
          <span class="card-type">{{ card.type === 'landscape' ? '橫式' : '直式' }}</span>
        </div>
        <button class="delete-btn" type="button" @click="removeCard(card.id, $event)">刪除</button>
      </div>
      <p v-if="store.cards.length === 0" class="empty">尚未建立任何卡片</p>
    </div>
  </div>
</template>

<style scoped>
.deck-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.add-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-buttons button {
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.add-buttons button:hover {
  background: #f1f5f9;
}

.cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
}

.card-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
}

.card-item:hover {
  background: #f1f5f9;
}

.card-item.active {
  border-color: #3b82f6;
  background: #eff6ff;
}

.thumb-wrap {
  flex: none;
  overflow: hidden;
  border-radius: 4px;
}

.thumb-wrap.landscape {
  width: 64px;
}

.thumb-wrap.portrait {
  width: 38px;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.card-name {
  border: none;
  background: transparent;
  font-size: 13px;
  padding: 2px;
  width: 100%;
  border-radius: 4px;
}

.card-name:hover,
.card-name:focus {
  background: #fff;
  outline: 1px solid #cbd5e1;
}

.card-type {
  font-size: 11px;
  color: #6b7280;
}

.delete-btn {
  flex: none;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid #fecaca;
  background: #fff5f5;
  color: #dc2626;
  cursor: pointer;
}

.delete-btn:hover {
  background: #fee2e2;
}

.empty {
  font-size: 13px;
  color: #9ca3af;
  text-align: center;
  padding: 16px 0;
}
</style>
