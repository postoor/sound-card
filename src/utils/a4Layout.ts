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

interface RowItem {
  card: Card
  cellW: number
  cellH: number
}

interface Row {
  items: RowItem[]
  width: number
  height: number
}

/**
 * Pack cards onto A4 sheets shelf-style (left-to-right, then wrap to a new
 * row, then a new page) with PRINT_GAP_MM between cells for cutting.
 * Landscape and portrait cards can share the same row/page. Each page's
 * rows are centered vertically as a block, and each row is centered
 * horizontally; cards are also centered vertically within their row.
 */
export function layoutCardsOnA4(cards: Card[]): PageLayout[] {
  const rows = buildRows(cards)
  const pages = groupRowsIntoPages(rows)
  return pages.map((pageRows) => {
    const contentHeight = pageRows.reduce((sum, row) => sum + row.height, 0) - PRINT_GAP_MM
    const marginY = Math.max(0, (A4.height - contentHeight) / 2)

    const placed: PlacedCard[] = []
    let y = marginY
    for (const row of pageRows) {
      const marginX = Math.max(0, (A4.width - row.width) / 2)
      let x = marginX
      for (const item of row.items) {
        placed.push({
          card: item.card,
          xMm: x,
          yMm: y + (row.height - item.cellH) / 2,
        })
        x += item.cellW
      }
      y += row.height
    }
    return { cards: placed }
  })
}

function buildRows(cards: Card[]): Row[] {
  const rows: Row[] = []
  let items: RowItem[] = []
  let width = 0
  let height = 0

  for (const card of cards) {
    const dims = CARD_DIMENSIONS[card.type]
    const cellW = dims.width + PRINT_GAP_MM
    const cellH = dims.height + PRINT_GAP_MM

    if (items.length && width + cellW > A4.width) {
      rows.push({ items, width: width - PRINT_GAP_MM, height })
      items = []
      width = 0
      height = 0
    }

    items.push({ card, cellW, cellH })
    width += cellW
    height = Math.max(height, cellH)
  }

  if (items.length) rows.push({ items, width: width - PRINT_GAP_MM, height })
  return rows
}

function groupRowsIntoPages(rows: Row[]): Row[][] {
  const pages: Row[][] = []
  let pageRows: Row[] = []
  let height = 0

  for (const row of rows) {
    if (pageRows.length && height + row.height > A4.height) {
      pages.push(pageRows)
      pageRows = []
      height = 0
    }
    pageRows.push(row)
    height += row.height
  }

  if (pageRows.length) pages.push(pageRows)
  return pages
}
