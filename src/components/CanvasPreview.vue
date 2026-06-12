<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{
  canvas: HTMLCanvasElement | null
}>()

const container = ref<HTMLDivElement>()

function render() {
  const el = container.value
  if (!el) return
  el.innerHTML = ''
  const canvas = props.canvas
  if (canvas) {
    canvas.style.maxWidth = '100%'
    canvas.style.maxHeight = '100%'
    canvas.style.objectFit = 'contain'
    canvas.style.display = 'block'
    el.appendChild(canvas)
  }
}

onMounted(render)
watch(() => props.canvas, render)
</script>

<template>
  <div ref="container" class="canvas-preview"></div>
</template>

<style scoped>
.canvas-preview {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
</style>
