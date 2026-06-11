import { A4, CARD_DIMENSIONS, PRINT_GAP_MM } from '../constants/layout'
import type { Card } from '../types/card'

export interface SizedItem {
  id: string
  widthMm: number
  heightMm: number
}

export interface PlacedItem {
  id: string
  xMm: number
  yMm: number
}

export interface PlacedCard {
  card: Card
  xMm: number
  yMm: number
}

export interface PageLayout {
  cards: PlacedCard[]
}

interface RowItem {
  item: SizedItem
  cellW: number
  cellH: number
}

interface Row {
  items: RowItem[]
  width: number
  height: number
}

/**
 * Pack arbitrary mm-sized items onto A4 sheets shelf-style (left-to-right,
 * then wrap to a new row, then a new page) with PRINT_GAP_MM between cells
 * for cutting. Each page's rows are centered vertically as a block, and each
 * row is centered horizontally; items are also centered vertically within
 * their row.
 */
export function layoutItemsOnA4(items: SizedItem[]): PlacedItem[][] {
  const rows = buildRows(items)
  const pages = groupRowsIntoPages(rows)
  return pages.map((pageRows) => {
    const contentHeight = pageRows.reduce((sum, row) => sum + row.height, 0) - PRINT_GAP_MM
    const marginY = Math.max(0, (A4.height - contentHeight) / 2)

    const placed: PlacedItem[] = []
    let y = marginY
    for (const row of pageRows) {
      const marginX = Math.max(0, (A4.width - row.width) / 2)
      let x = marginX
      for (const rowItem of row.items) {
        placed.push({
          id: rowItem.item.id,
          xMm: x,
          yMm: y + (row.height - rowItem.cellH) / 2,
        })
        x += rowItem.cellW
      }
      y += row.height
    }
    return placed
  })
}

/** Pack cards onto A4 sheets using their fixed physical dimensions. */
export function layoutCardsOnA4(cards: Card[]): PageLayout[] {
  const byId = new Map(cards.map((card) => [card.id, card]))
  const items: SizedItem[] = cards.map((card) => {
    const dims = CARD_DIMENSIONS[card.type]
    return { id: card.id, widthMm: dims.width, heightMm: dims.height }
  })
  return layoutItemsOnA4(items).map((page) => ({
    cards: page.map((p) => ({ card: byId.get(p.id)!, xMm: p.xMm, yMm: p.yMm })),
  }))
}

function buildRows(sizedItems: SizedItem[]): Row[] {
  const rows: Row[] = []
  let items: RowItem[] = []
  let width = 0
  let height = 0

  for (const item of sizedItems) {
    const cellW = item.widthMm + PRINT_GAP_MM
    const cellH = item.heightMm + PRINT_GAP_MM

    if (items.length && width + cellW > A4.width) {
      rows.push({ items, width: width - PRINT_GAP_MM, height })
      items = []
      width = 0
      height = 0
    }

    items.push({ item, cellW, cellH })
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
