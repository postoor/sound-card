import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { createCard, type Card, type CardType, type ImageAsset, type ProjectState } from '../types/card'

const STORAGE_KEY = 'soundcard-project-v1'

export const useDeckStore = defineStore('deck', () => {
  const cards = ref<Card[]>([])
  const activeCardId = ref<string | null>(null)
  const selectedForPrint = ref<Set<string>>(new Set())
  // Session-only material library (e.g. cutout pieces); not persisted to localStorage.
  const materials = ref<ImageAsset[]>([])

  function addCard(type: CardType): Card {
    const count = cards.value.filter((c) => c.type === type).length + 1
    const name = type === 'landscape' ? `橫式卡片 ${count}` : `直式卡片 ${count}`
    const card = createCard(type, name)
    cards.value.push(card)
    activeCardId.value = card.id
    return card
  }

  function removeCard(id: string) {
    const idx = cards.value.findIndex((c) => c.id === id)
    if (idx !== -1) cards.value.splice(idx, 1)
    selectedForPrint.value.delete(id)
    if (activeCardId.value === id) {
      activeCardId.value = cards.value[0]?.id ?? null
    }
  }

  function setActiveCard(id: string | null) {
    activeCardId.value = id
  }

  function togglePrintSelection(id: string) {
    if (selectedForPrint.value.has(id)) selectedForPrint.value.delete(id)
    else selectedForPrint.value.add(id)
  }

  function addMaterial(asset: Omit<ImageAsset, 'id'>): ImageAsset {
    const material: ImageAsset = { id: crypto.randomUUID(), ...asset }
    materials.value.push(material)
    return material
  }

  function removeMaterial(id: string) {
    materials.value = materials.value.filter((m) => m.id !== id)
  }

  function toProjectState(): ProjectState {
    return { version: 1, cards: JSON.parse(JSON.stringify(cards.value)) }
  }

  function loadProject(data: ProjectState) {
    cards.value = data.cards
    activeCardId.value = cards.value[0]?.id ?? null
    selectedForPrint.value = new Set()
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toProjectState()))
    } catch (err) {
      console.warn('無法儲存到 localStorage（容量可能已滿）', err)
    }
  }

  function restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as ProjectState
      if (data.version === 1 && Array.isArray(data.cards)) {
        cards.value = data.cards
        activeCardId.value = cards.value[0]?.id ?? null
      }
    } catch (err) {
      console.warn('無法從 localStorage 還原專案', err)
    }
  }

  restore()

  let persistTimer: ReturnType<typeof setTimeout> | undefined
  watch(
    cards,
    () => {
      if (persistTimer) clearTimeout(persistTimer)
      persistTimer = setTimeout(persist, 500)
    },
    { deep: true },
  )

  return {
    cards,
    activeCardId,
    selectedForPrint,
    materials,
    addCard,
    removeCard,
    setActiveCard,
    togglePrintSelection,
    addMaterial,
    removeMaterial,
    toProjectState,
    loadProject,
  }
})
