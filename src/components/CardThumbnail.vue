<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Card } from '../types/card'
import { renderCardToCanvas } from '../utils/canvasRender'

const props = defineProps<{
  card: Card
}>()

const canvasRef = ref<HTMLCanvasElement>()
const THUMB_PX_PER_MM = 2

let debounceTimer: ReturnType<typeof setTimeout> | undefined

async function render() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rendered = await renderCardToCanvas(props.card, THUMB_PX_PER_MM)
  canvas.width = rendered.width
  canvas.height = rendered.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(rendered, 0, 0)
}

function scheduleRender() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(render, 200)
}

onMounted(render)
watch(() => props.card, scheduleRender, { deep: true })
</script>

<template>
  <canvas ref="canvasRef" class="thumb"></canvas>
</template>

<style scoped>
.thumb {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 4px;
  background: #e5e7eb;
}
</style>
