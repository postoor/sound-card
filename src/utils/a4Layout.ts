import { A4, CARD_DIMENSIONS, PRINT_GAP_MM } from '../constants/layout'
import type { Card } from '../types/card'

export interface PlacedCard {
  card: Card
  xMm: number
  yMm: number
}

export interface PageLayout {
  cards: PlacedCard[]
}

/**
 * Arrange selected cards onto A4 sheets with PRINT_GAP_MM between cells for
 * cutting. Landscape and portrait cards are paginated separately (simple
 * grid packing, no mixed-orientation bin packing).
 */
export function layoutCardsOnA4(cards: Card[]): PageLayout[] {
  const landscapeCards = cards.filter((c) => c.type === 'landscape')
  const portraitCards = cards.filter((c) => c.type === 'portrait')
  const pages: PageLayout[] = []
  if (landscapeCards.length) {
    pages.push(...gridPaginate(landscapeCards, CARD_DIMENSIONS.landscape.width, CARD_DIMENSIONS.landscape.height))
  }
  if (portraitCards.length) {
    pages.push(...gridPaginate(portraitCards, CARD_DIMENSIONS.portrait.width, CARD_DIMENSIONS.portrait.height))
  }
  return pages
}

function gridPaginate(cards: Card[], cardW: number, cardH: number): PageLayout[] {
  const cellW = cardW + PRINT_GAP_MM
  const cellH = cardH + PRINT_GAP_MM
  const cols = Math.max(1, Math.floor(A4.width / cellW))
  const rows = Math.max(1, Math.floor(A4.height / cellH))
  const perPage = cols * rows
  const usedW = cols * cellW
  const usedH = rows * cellH
  const marginX = (A4.width - usedW) / 2
  const marginY = (A4.height - usedH) / 2

  const pages: PageLayout[] = []
  for (let i = 0; i < cards.length; i += perPage) {
    const pageCards = cards.slice(i, i + perPage)
    const placed = pageCards.map((card, idx) => {
      const col = idx % cols
      const row = Math.floor(idx / cols)
      return {
        card,
        xMm: marginX + col * cellW,
        yMm: marginY + row * cellH,
      }
    })
    pages.push({ cards: placed })
  }
  return pages
}
