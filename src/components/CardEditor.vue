<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  CARD_DIMENSIONS,
  CIRCLE_RADIUS_MM,
  EDITOR_PX_PER_MM,
  HALF_DIMENSIONS,
  LANDSCAPE_BOX,
  LANDSCAPE_CIRCLE_CENTER,
  PORTRAIT_BOX,
  PORTRAIT_CIRCLE_CENTERS,
} from '../constants/layout'
import type { Card, LandscapeCard, PortraitCard } from '../types/card'
import ImageCropEditor from './ImageCropEditor.vue'
import FrameOverlay from './FrameOverlay.vue'

const props = defineProps<{
  card: Card
}>()

const lCard = computed(() => props.card as LandscapeCard)
const pCard = computed(() => props.card as PortraitCard)

const dims = computed(() => CARD_DIMENSIONS[props.card.type])
const cardWidthPx = computed(() => dims.value.width * EDITOR_PX_PER_MM)
const cardHeightPx = computed(() => dims.value.height * EDITOR_PX_PER_MM)

const landscapeCircles = [{ center: LANDSCAPE_CIRCLE_CENTER, radiusMm: CIRCLE_RADIUS_MM }]
const portraitCircles = [
  { center: PORTRAIT_CIRCLE_CENTERS.left, radiusMm: CIRCLE_RADIUS_MM },
  { center: PORTRAIT_CIRCLE_CENTERS.right, radiusMm: CIRCLE_RADIUS_MM },
]

function updateLeftLabel(next: string[]) {
  lCard.value.leftLabel.text = next[0]
}
function updateRightLabel(next: string[]) {
  lCard.value.rightLabel.text = next[0]
}
function updatePortraitLabels(next: string[]) {
  pCard.value.leftLabel.text = next[0]
  pCard.value.rightLabel.text = next[1]
}

const containerRef = ref<HTMLElement>()
const scale = ref(1)
let observer: ResizeObserver | undefined

function recalcScale() {
  const el = containerRef.value
  if (!el) return
  const available = el.clientWidth
  scale.value = Math.min(1, available / cardWidthPx.value)
}

onMounted(() => {
  observer = new ResizeObserver(recalcScale)
  if (containerRef.value) observer.observe(containerRef.value)
  recalcScale()
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>

<template>
  <div ref="containerRef" class="card-editor-container">
    <div
      class="scaler"
      :style="{ width: `${cardWidthPx * scale}px`, height: `${cardHeightPx * scale}px` }"
    >
      <div
        class="card-editor"
        :class="card.type"
        :style="{ width: `${cardWidthPx}px`, height: `${cardHeightPx}px`, transform: `scale(${scale})` }"
      >
        <template v-if="card.type === 'landscape'">
          <div class="half left-half">
            <ImageCropEditor
              v-model="lCard.left"
              :width-mm="HALF_DIMENSIONS.width"
              :height-mm="HALF_DIMENSIONS.height"
              :px-per-mm="EDITOR_PX_PER_MM"
            />
            <FrameOverlay
              :box="LANDSCAPE_BOX"
              :circles="landscapeCircles"
              :px-per-mm="EDITOR_PX_PER_MM"
              :labels="[lCard.leftLabel.text]"
              @update:labels="updateLeftLabel"
            />
          </div>
          <div class="half right-half">
            <ImageCropEditor
              v-model="lCard.right"
              :width-mm="HALF_DIMENSIONS.width"
              :height-mm="HALF_DIMENSIONS.height"
              :px-per-mm="EDITOR_PX_PER_MM"
            />
            <FrameOverlay
              :box="LANDSCAPE_BOX"
              :circles="landscapeCircles"
              :px-per-mm="EDITOR_PX_PER_MM"
              :labels="[lCard.rightLabel.text]"
              @update:labels="updateRightLabel"
            />
          </div>
        </template>
        <template v-else>
          <div class="full">
            <ImageCropEditor
              v-model="pCard.image"
              :width-mm="dims.width"
              :height-mm="dims.height"
              :px-per-mm="EDITOR_PX_PER_MM"
            />
            <FrameOverlay
              :box="PORTRAIT_BOX"
              :circles="portraitCircles"
              :px-per-mm="EDITOR_PX_PER_MM"
              :labels="[pCard.leftLabel.text, pCard.rightLabel.text]"
              @update:labels="updatePortraitLabels"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-editor-container {
  width: 100%;
}

.scaler {
  overflow: hidden;
}

.card-editor {
  display: flex;
  transform-origin: top left;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

.card-editor.portrait {
  display: block;
}

.half {
  position: relative;
  flex: none;
}

.left-half {
  border-right: 1px dashed rgba(0, 0, 0, 0.3);
  box-sizing: border-box;
}

.full {
  position: relative;
}
</style>
