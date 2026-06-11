import { EXPORT_PX_PER_MM } from '../constants/layout'
import { renderCardToCanvas } from './canvasRender'
import type { Card } from '../types/card'

export async function exportCardToPngBlob(card: Card): Promise<Blob> {
  const canvas = await renderCardToCanvas(card, EXPORT_PX_PER_MM)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Failed to encode canvas to PNG'))
    }, 'image/png')
  })
}
