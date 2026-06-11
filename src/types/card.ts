export type CardType = 'landscape' | 'portrait'

/** Pan/zoom transform for an uploaded image within its slot. */
export interface ImageTransform {
  /** 1.0 = "cover" fit (no extra zoom); clamped to [IMAGE_SCALE_MIN, IMAGE_SCALE_MAX]. */
  scale: number
  /** mm, slot-local space: image center offset from the slot center. */
  offsetX: number
  /** mm, slot-local space: image center offset from the slot center. */
  offsetY: number
}

export function defaultTransform(): ImageTransform {
  return { scale: 1, offsetX: 0, offsetY: 0 }
}

/** One uploaded image and its transform, occupying one slot. */
export interface ImageSlot {
  imageDataUrl: string | null
  naturalWidth: number
  naturalHeight: number
  transform: ImageTransform
}

export function emptySlot(): ImageSlot {
  return {
    imageDataUrl: null,
    naturalWidth: 0,
    naturalHeight: 0,
    transform: defaultTransform(),
  }
}

export interface CircleLabel {
  text: string
}

export interface LandscapeCard {
  id: string
  type: 'landscape'
  name: string
  left: ImageSlot
  right: ImageSlot
  leftLabel: CircleLabel
  rightLabel: CircleLabel
}

export interface PortraitCard {
  id: string
  type: 'portrait'
  name: string
  image: ImageSlot
  leftLabel: CircleLabel
  rightLabel: CircleLabel
}

export type Card = LandscapeCard | PortraitCard

/** A reusable image (e.g. a cutout piece) that can be applied to any card slot. */
export interface ImageAsset {
  id: string
  name: string
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
}

export interface ProjectState {
  version: 1
  cards: Card[]
}

export function createCard(type: CardType, name: string): Card {
  const id = crypto.randomUUID()
  if (type === 'landscape') {
    return {
      id,
      type,
      name,
      left: emptySlot(),
      right: emptySlot(),
      leftLabel: { text: '' },
      rightLabel: { text: '' },
    }
  }
  return {
    id,
    type,
    name,
    image: emptySlot(),
    leftLabel: { text: '中文' },
    rightLabel: { text: 'English' },
  }
}
