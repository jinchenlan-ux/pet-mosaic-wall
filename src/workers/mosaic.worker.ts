export interface TileColorResult {
  index: number
  avgColor: [number, number, number]
}

export interface GridCell {
  x: number
  y: number
  avgColor: [number, number, number]
}

export type WorkerMessage =
  | { type: 'computeTileColors'; tiles: { index: number; data: number[]; width: number; height: number }[] }
  | { type: 'computeGridColors'; cells: { x: number; y: number; data: number[]; width: number; height: number }[] }
  | { type: 'matchTiles'; gridCells: GridCell[]; tileColors: TileColorResult[]; randomness: boolean }

function computeAverageColor(data: number[] | Uint8ClampedArray): [number, number, number] {
  let r = 0, g = 0, b = 0
  const pixelCount = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return [
    Math.round(r / pixelCount),
    Math.round(g / pixelCount),
    Math.round(b / pixelCount),
  ]
}

function euclideanColorDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0]
  const dg = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data

  if (msg.type === 'computeTileColors') {
    const results: TileColorResult[] = msg.tiles.map((tile) => ({
      index: tile.index,
      avgColor: computeAverageColor(tile.data),
    }))
    self.postMessage({ type: 'tileColorsResult', results })
  }

  if (msg.type === 'computeGridColors') {
    const results: GridCell[] = msg.cells.map((cell) => ({
      x: cell.x,
      y: cell.y,
      avgColor: computeAverageColor(cell.data),
    }))
    self.postMessage({ type: 'gridColorsResult', results })
  }

  if (msg.type === 'matchTiles') {
    const { gridCells, tileColors, randomness } = msg
    const TOP_N = 3

    const matches = gridCells.map((cell) => {
      const distances = tileColors.map((tile) => ({
        index: tile.index,
        distance: euclideanColorDistance(cell.avgColor, tile.avgColor),
      }))
      distances.sort((a, b) => a.distance - b.distance)

      let chosen: number
      if (randomness && distances.length >= TOP_N) {
        chosen = distances[Math.floor(Math.random() * TOP_N)].index
      } else {
        chosen = distances[0].index
      }

      return {
        x: cell.x,
        y: cell.y,
        tileIndex: chosen,
        targetColor: cell.avgColor,
      }
    })

    self.postMessage({ type: 'matchResult', matches })
  }
}
