<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { ImageAsset, ImageSlot, ImageTransform } from '../types/card'
import { defaultTransform } from '../types/card'
import { clampTransform, coverScaleMmPerPx } from '../utils/geometry'
import MaterialPicker from './MaterialPicker.vue'

const props = defineProps<{
  modelValue: ImageSlot
  widthMm: number
  heightMm: number
  pxPerMm: number
}>()

const emit = defineEmits<{
  'update:modelValue': [ImageSlot]
}>()

const fileInput = ref<HTMLInputElement>()
const dragging = ref(false)
const showMaterialPicker = ref(false)

const widthPx = computed(() => props.widthMm * props.pxPerMm)
const heightPx = computed(() => props.heightMm * props.pxPerMm)

const imageStyle = computed(() => {
  const slot = props.modelValue
  if (!slot.imageDataUrl) return {}
  const cover = coverScaleMmPerPx(props.widthMm, props.heightMm, slot.naturalWidth, slot.naturalHeight)
  const renderWmm = slot.naturalWidth * cover * slot.transform.scale
  const renderHmm = slot.naturalHeight * cover * slot.transform.scale
  const centerXmm = props.widthMm / 2 + slot.transform.offsetX
  const centerYmm = props.heightMm / 2 + slot.transform.offsetY
  const left = (centerXmm - renderWmm / 2) * props.pxPerMm
  const top = (centerYmm - renderHmm / 2) * props.pxPerMm
  return {
    width: `${renderWmm * props.pxPerMm}px`,
    height: `${renderHmm * props.pxPerMm}px`,
    left: `${left}px`,
    top: `${top}px`,
  }
})

function triggerUpload() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const objectUrl = URL.createObjectURL(file)
  const img = new Image()
  img.onload = async () => {
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    URL.revokeObjectURL(objectUrl)
    emit('update:modelValue', {
      imageDataUrl: canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.92),
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      transform: { scale: 1, offsetX: 0, offsetY: 0 },
    })
    await nextTick()
    input.value = ''
  }
  img.onerror = () => {
    URL.revokeObjectURL(objectUrl)
    input.value = ''
  }
  img.src = objectUrl
}

function onMaterialSelect(asset: ImageAsset) {
  emit('update:modelValue', {
    imageDataUrl: asset.dataUrl,
    naturalWidth: asset.naturalWidth,
    naturalHeight: asset.naturalHeight,
    transform: defaultTransform(),
  })
  showMaterialPicker.value = false
}

function updateTransform(transform: ImageTransform) {
  const slot = props.modelValue
  const clamped = clampTransform(
    transform,
    props.widthMm,
    props.heightMm,
    slot.naturalWidth,
    slot.naturalHeight,
  )
  emit('update:modelValue', { ...slot, transform: clamped })
}

let lastX = 0
let lastY = 0

function onPointerDown(e: PointerEvent) {
  if (!props.modelValue.imageDataUrl) return
  dragging.value = true
  lastX = e.clientX
  lastY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const dxMm = (e.clientX - lastX) / props.pxPerMm
  const dyMm = (e.clientY - lastY) / props.pxPerMm
  lastX = e.clientX
  lastY = e.clientY
  const t = props.modelValue.transform
  updateTransform({ scale: t.scale, offsetX: t.offsetX + dxMm, offsetY: t.offsetY + dyMm })
}

function onPointerUp(e: PointerEvent) {
  dragging.value = false
  const el = e.currentTarget as HTMLElement
  if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
}

function onWheel(e: WheelEvent) {
  if (!props.modelValue.imageDataUrl) return
  e.preventDefault()
  const factor = Math.exp(-e.deltaY * 0.001)
  const t = props.modelValue.transform
  updateTransform({ ...t, scale: t.scale * factor })
}

function onZoomInput(e: Event) {
  const value = parseFloat((e.target as HTMLInputElement).value)
  updateTransform({ ...props.modelValue.transform, scale: value })
}
</script>

<template>
  <div class="crop-editor" :style="{ width: `${widthPx}px`, height: `${heightPx}px` }" @wheel="onWheel">
    <template v-if="modelValue.imageDataUrl">
      <img
        :src="modelValue.imageDataUrl"
        class="crop-image"
        :class="{ dragging }"
        :style="imageStyle"
        draggable="false"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      />
      <input
        class="zoom-slider"
        type="range"
        min="1"
        max="4"
        step="0.01"
        :value="modelValue.transform.scale"
        @input="onZoomInput"
        @pointerdown.stop
      />
      <div class="actions">
        <button class="replace-btn" type="button" @click="triggerUpload">更換圖片</button>
        <button class="replace-btn" type="button" @click="showMaterialPicker = true">從素材庫選擇</button>
      </div>
    </template>
    <div v-else class="upload-placeholder">
      <button class="placeholder-btn" type="button" @click="triggerUpload">點擊上傳圖片</button>
      <button class="placeholder-btn" type="button" @click="showMaterialPicker = true">從素材庫選擇</button>
    </div>
    <input ref="fileInput" class="hidden-input" type="file" accept="image/*" @change="onFileChange" />
    <MaterialPicker v-model="showMaterialPicker" @select="onMaterialSelect" />
  </div>
</template>

<style scoped>
.crop-editor {
  position: relative;
  overflow: hidden;
  background: #e5e7eb;
  touch-action: none;
}

.crop-image {
  position: absolute;
  cursor: grab;
  user-select: none;
  -webkit-user-drag: none;
}

.crop-image.dragging {
  cursor: grabbing;
}

.upload-placeholder {
  width: 100%;
  height: 100%;
  border: 2px dashed #9ca3af;
  background: transparent;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.upload-placeholder:hover {
  background: #eef2f7;
}

.placeholder-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
}

.placeholder-btn:hover {
  background: #f1f5f9;
}

.hidden-input {
  display: none;
}

.actions {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 4px;
}

.replace-btn {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;
}

.zoom-slider {
  position: absolute;
  left: 4px;
  right: 4px;
  bottom: 4px;
  width: calc(100% - 8px);
}
</style>
