<script setup lang="ts">
import { computed } from 'vue'
import { FRAME_BOX_FILL, FRAME_BOX_RADIUS_MM, LABEL_FONT_SIZE_MM } from '../constants/layout'

interface CircleDef {
  center: { x: number; y: number }
  radiusMm: number
}

const props = defineProps<{
  box: { x: number; y: number; w: number; h: number }
  circles: CircleDef[]
  pxPerMm: number
  labels?: string[]
}>()

const emit = defineEmits<{
  'update:labels': [string[]]
}>()

const boxStyle = computed(() => ({
  left: `${props.box.x * props.pxPerMm}px`,
  top: `${props.box.y * props.pxPerMm}px`,
  width: `${props.box.w * props.pxPerMm}px`,
  height: `${props.box.h * props.pxPerMm}px`,
  borderRadius: `${FRAME_BOX_RADIUS_MM * props.pxPerMm}px`,
  background: FRAME_BOX_FILL,
}))

function circleStyle(circle: CircleDef) {
  const d = circle.radiusMm * 2 * props.pxPerMm
  return {
    left: `${(circle.center.x - circle.radiusMm) * props.pxPerMm}px`,
    top: `${(circle.center.y - circle.radiusMm) * props.pxPerMm}px`,
    width: `${d}px`,
    height: `${d}px`,
  }
}

function labelStyle(circle: CircleDef) {
  return {
    left: `${(circle.center.x - circle.radiusMm) * props.pxPerMm}px`,
    top: `${(circle.center.y + circle.radiusMm) * props.pxPerMm}px`,
    width: `${circle.radiusMm * 2 * props.pxPerMm}px`,
    fontSize: `${LABEL_FONT_SIZE_MM * props.pxPerMm}px`,
  }
}

function onLabelInput(index: number, e: Event) {
  if (!props.labels) return
  const value = (e.target as HTMLInputElement).value
  const next = [...props.labels]
  next[index] = value
  emit('update:labels', next)
}
</script>

<template>
  <div class="frame-overlay">
    <div class="frame-box" :style="boxStyle"></div>
    <div v-for="(circle, i) in circles" :key="`circle-${i}`" class="circle-guide" :style="circleStyle(circle)"></div>
    <template v-if="labels">
      <input
        v-for="(circle, i) in circles"
        :key="`label-${i}`"
        class="circle-label"
        type="text"
        :value="labels[i]"
        :style="labelStyle(circle)"
        @input="onLabelInput(i, $event)"
        @pointerdown.stop
      />
    </template>
  </div>
</template>

<style scoped>
.frame-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.frame-box {
  position: absolute;
  pointer-events: none;
}

.circle-guide {
  position: absolute;
  border-radius: 50%;
  border: 1px dashed #999;
  box-sizing: border-box;
  pointer-events: none;
}

.circle-label {
  position: absolute;
  pointer-events: auto;
  text-align: center;
  border: 1px solid transparent;
  background: transparent;
  font-family: sans-serif;
  color: #333;
  padding: 0;
}

.circle-label:hover,
.circle-label:focus {
  border-color: #999;
  background: rgba(255, 255, 255, 0.6);
  outline: none;
}
</style>
