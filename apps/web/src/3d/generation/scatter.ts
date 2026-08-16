import { isPointInHull } from '@/3d/geometry/pointInHull.ts'
import type { Pt2 } from '@/3d/geometry/hull.ts'

const CANDIDATES_PER_ACTIVE_POINT = 30
const CELL_NEIGHBOR_RADIUS = 2

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function gridKey(x: number, y: number): string {
  return `${x},${y}`
}

function gridCoordinate(value: number, cellSize: number): number {
  return Math.floor(value / cellSize)
}

function centroid(hull: readonly Pt2[]): Pt2 {
  let x = 0
  let y = 0
  for (const point of hull) {
    x += point.x
    y += point.y
  }
  return { x: x / hull.length, y: y / hull.length }
}

/** Bridson Poisson-disk sampling restricted to a convex UV hull. */
export function poissonDiskInHull(
  hull: readonly Pt2[],
  options: { radius: number; maxPoints: number; seed: number; vRange?: [number, number] },
): Pt2[] {
  const radius = options.radius
  const maxPoints = Math.floor(options.maxPoints)
  if (hull.length < 3 || !Number.isFinite(radius) || radius <= 0 || !Number.isFinite(maxPoints) || maxPoints <= 0) return []

  const points: Pt2[] = []
  const active: number[] = []
  const cellSize = radius / Math.SQRT2
  const grid = new Map<string, number>()
  const random = mulberry32(options.seed)
  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let hullMinY = Number.POSITIVE_INFINITY
  let hullMaxY = Number.NEGATIVE_INFINITY
  for (const point of hull) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    hullMinY = Math.min(hullMinY, point.y)
    hullMaxY = Math.max(hullMaxY, point.y)
  }
  const requestedMinY = options.vRange?.[0] ?? hullMinY
  const requestedMaxY = options.vRange?.[1] ?? hullMaxY
  const minY = Math.max(hullMinY, Math.min(requestedMinY, requestedMaxY))
  const maxY = Math.min(hullMaxY, Math.max(requestedMinY, requestedMaxY))
  if (minY > maxY) return []

  const isValid = (point: Pt2): boolean => {
    if (point.y < minY || point.y > maxY || !isPointInHull(hull, point)) return false
    const cellX = gridCoordinate(point.x, cellSize)
    const cellY = gridCoordinate(point.y, cellSize)
    for (let y = cellY - CELL_NEIGHBOR_RADIUS; y <= cellY + CELL_NEIGHBOR_RADIUS; y += 1) {
      for (let x = cellX - CELL_NEIGHBOR_RADIUS; x <= cellX + CELL_NEIGHBOR_RADIUS; x += 1) {
        const index = grid.get(gridKey(x, y))
        if (index === undefined) continue
        const other = points[index]!
        if ((other.x - point.x) ** 2 + (other.y - point.y) ** 2 < radius ** 2) return false
      }
    }
    return true
  }

  const add = (point: Pt2): void => {
    const index = points.length
    points.push(point)
    active.push(index)
    grid.set(gridKey(gridCoordinate(point.x, cellSize), gridCoordinate(point.y, cellSize)), index)
  }

  const attempts = Math.max(64, hull.length * 64)
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const point = {
      x: minX + random() * (maxX - minX),
      y: minY + random() * (maxY - minY),
    }
    if (isValid(point)) {
      add(point)
      break
    }
  }
  if (points.length === 0) {
    const center = centroid(hull)
    if (isValid(center)) add(center)
  }
  if (points.length === 0) return points

  while (active.length > 0 && points.length < maxPoints) {
    const activePosition = Math.floor(random() * active.length)
    const source = points[active[activePosition]!]!
    let accepted = false
    for (let attempt = 0; attempt < CANDIDATES_PER_ACTIVE_POINT; attempt += 1) {
      const angle = random() * Math.PI * 2
      const distance = radius * (1 + random())
      const candidate = {
        x: source.x + Math.cos(angle) * distance,
        y: source.y + Math.sin(angle) * distance,
      }
      if (!isValid(candidate)) continue
      add(candidate)
      accepted = true
      if (points.length >= maxPoints) break
    }
    if (!accepted || points.length >= maxPoints) {
      const last = active.pop()!
      if (activePosition < active.length) active[activePosition] = last
    }
  }

  return points
}
