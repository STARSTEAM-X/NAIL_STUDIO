import { BufferGeometry, Float32BufferAttribute, Uint16BufferAttribute, Vector3, type Mesh } from 'three'
import type { StudioNail } from './sceneSchema.ts'

export interface NailFrame {
  origin: Vector3; across: Vector3; along: Vector3; normal: Vector3
  width: number; bedLength: number; arch: number; joint: number
  bed?: { rows: number; columns: number; points: number[] }
}

/** Capture once from the reusable nail bed in mesh-local bind coordinates. */
export function captureNailFrame(mesh: Mesh, direction: Vector3, dorsal: Vector3): NailFrame {
  const position = mesh.geometry.getAttribute('position')
  const authoredVector = (value: unknown): Vector3 | null => Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number' && Number.isFinite(v))
    && Math.hypot(...value) > .9 ? new Vector3(...value as [number, number, number]).normalize() : null
  const along = authoredVector(mesh.userData.bedAlong) ?? direction.clone().normalize()
  const normal = authoredVector(mesh.userData.bedNormal) ?? dorsal.clone().normalize()
  normal.addScaledVector(along, -normal.dot(along)).normalize()
  const across = new Vector3().crossVectors(along, normal).normalize()
  const point = new Vector3()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, maxZ = -Infinity
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index)
    const x = point.dot(across), y = point.dot(along), z = point.dot(normal)
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y); maxZ = Math.max(maxZ, z)
  }
  const width = maxX - minX
  const arch = width * 0.11
  const frame: NailFrame = {
    origin: across.clone().multiplyScalar((minX + maxX) / 2).addScaledVector(along, minY).addScaledVector(normal, maxZ - arch),
    across, along, normal, width, bedLength: maxY - minY, arch,
    joint: mesh.geometry.getAttribute('skinIndex')?.getX(0) ?? 0,
  }
  const { bedRows, bedColumns, bedSamples } = mesh.userData
  if (Number.isInteger(bedRows) && Number.isInteger(bedColumns) && bedRows > 0 && bedRows <= 128 && bedColumns > 0 && bedColumns <= 128 && Array.isArray(bedSamples)
    && bedSamples.length === (bedRows + 1) * (bedColumns + 1) * 3 && bedSamples.every((value) => typeof value === 'number' && Number.isFinite(value))) {
    // The keratin plate bridges tiny skin folds. Smooth only dorsal height;
    // retain the measured footprint and root position rather than copying
    // every sculpted skin ridge into glossy nail reflections. Fixed passes O(n).
    let points: number[] = [...bedSamples]
    for (let pass = 0; pass < 8; pass += 1) {
      const next = [...points]
      for (let row = 0; row <= bedRows; row += 1) for (let column = 0; column <= bedColumns; column += 1) {
        const offset = (row * (bedColumns + 1) + column) * 3
        const here = new Vector3(points[offset], points[offset + 1], points[offset + 2])
        let height = here.dot(normal) * 4, count = 4
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const r = row + dr!, c = column + dc!
          if (r < 0 || r > bedRows || c < 0 || c > bedColumns) continue
          const index = (r * (bedColumns + 1) + c) * 3
          height += points[index]! * normal.x + points[index + 1]! * normal.y + points[index + 2]! * normal.z
          count += 1
        }
        here.addScaledVector(normal, height / count - here.dot(normal))
        next[offset] = here.x; next[offset + 1] = here.y; next[offset + 2] = here.z
      }
      points = next
    }
    frame.bed = { rows: bedRows, columns: bedColumns, points }
  }
  return frame
}

function smooth(value: number): number { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t) }

function widthAt(nail: StudioNail, t: number): number {
  const root = 0.72 + 0.28 * smooth(t / 0.18)
  const start = nail.shape === 'stiletto' ? .43 : nail.shape === 'almond' ? .55 : .66
  const tip = smooth((t - start) / (1 - start))
  const end = {
    round: 1, oval: .94, almond: .13, square: 1,
    squoval: 1, coffin: nail.tipWidth, stiletto: .025,
  }[nail.shape]
  const curve = nail.shape === 'almond' ? tip ** .8 : tip
  const taper = nail.shape === 'round' || nail.shape === 'oval' ? 1 : 1 - nail.taper * .16 * tip
  return root * (1 - curve * (1 - end)) * taper
}

function sampleBed(frame: NailFrame, u: number, v: number): Vector3 {
  const { rows, columns, points } = frame.bed!
  const x = Math.max(0, Math.min(1, u)) * columns, y = Math.max(0, Math.min(1, v)) * rows
  const ix = Math.min(columns - 1, Math.floor(x)), iy = Math.min(rows - 1, Math.floor(y))
  const tx = x - ix, ty = y - iy
  const a = (iy * (columns + 1) + ix) * 3, b = a + 3, c = a + (columns + 1) * 3, d = c + 3
  const coordinate = (axis: number) => ((1 - tx) * points[a + axis]! + tx * points[b + axis]!) * (1 - ty)
    + ((1 - tx) * points[c + axis]! + tx * points[d + axis]!) * ty
  return new Vector3(coordinate(0), coordinate(1), coordinate(2))
}

function tipRound(nail: StudioNail, frame: NailFrame, width: number, x: number, v: number): number {
  const cap = { round: .46, oval: .72, almond: .03, square: 0, squoval: .14, coffin: .035, stiletto: .01 }[nail.shape]
  // Bound the derivative so even a wide, extra-short oval cannot fold the
  // surface backwards. Its corner must remain distal to the locked cuticle.
  const round = nail.shape === 'round' || nail.shape === 'oval'
  const outline = round ? 1 - Math.sqrt(Math.max(0.000001, 1 - Math.min(1, x * x))) : x * x
  const budget = frame.bedLength * (.30 + .48 * nail.length)
  const baseCap = Math.min(width * cap, frame.bedLength * .30)
  const totalCap = Math.min(width * cap, budget)
  return outline * (baseCap * smooth((v - .45) / .55) + (totalCap - baseCap) * smooth((v - .60) / .40))
}

/** UV coordinates: u left→right, v cuticle→tip, both in [0,1]. */
export function nailSurface(frame: NailFrame, nail: StudioNail, u: number, v: number): Vector3 {
  const x = u * 2 - 1
  // Preserve the measured bed, cuticle and lateral folds. Only the free edge
  // receives the extension; never infer a floating base from a bounding box.
  const extension = frame.bedLength * 1.6 * nail.length * smooth((v - .60) / .40)
  const rootLock = smooth((v - .45) / .25)
  if (frame.bed) {
    const point = sampleBed(frame, u, v), center = sampleBed(frame, .5, v)
    const halfWidth = sampleBed(frame, 0, v).distanceTo(sampleBed(frame, 1, v)) * .5
    const desired = frame.width * .5 * widthAt(nail, v) * (1 + (nail.width - 1) * rootLock)
    const ratio = 1 + (desired / Math.max(.00001, halfWidth) - 1) * rootLock
    const originalX = point.clone().sub(center).dot(frame.across)
    point.addScaledVector(frame.across, originalX * (ratio - 1))
    const originalArch = center.clone().sub(point).dot(frame.normal)
    const curvature = 1 + (nail.curvature - 1) * smooth((v - .60) / .40)
    point.addScaledVector(frame.normal, originalArch * (1 - ratio * ratio * curvature))
    const oldTip = frame.width * .20 * x * x * smooth((v - .70) / .30)
    const roundedTip = tipRound(nail, frame, frame.width, x * widthAt(nail, v), v)
    point.addScaledVector(frame.along, extension + oldTip - roundedTip)
    if (v > .45) {
      // A rounded corner moves proximally onto a thicker part of the fingertip.
      // Resample its measured skin height instead of leaving the plate buried
      // in that skin (or floating when width/shape moves it the other way).
      const root = sampleBed(frame, .5, 0)
      const bedEnd = sampleBed(frame, .5, 1)
      const bedLength = bedEnd.clone().sub(root).dot(frame.along)
      const actualV = Math.max(0, Math.min(1, point.clone().sub(root).dot(frame.along) / Math.max(.00001, bedLength)))
      const actualHalf = sampleBed(frame, 0, actualV).distanceTo(sampleBed(frame, 1, actualV)) * .5
      const actualCenter = sampleBed(frame, .5, actualV)
      const actualX = originalX * ratio
      const actualU = .5 + actualX / Math.max(.00002, actualHalf * 2)
      const measured = sampleBed(frame, actualU, actualV)
      const arch = actualCenter.clone().sub(measured).dot(frame.normal)
      const excess = Math.max(1, Math.abs(actualX) / Math.max(.00001, actualHalf))
      const wantedZ = measured.dot(frame.normal) - arch * (excess * excess * curvature - 1)
      point.addScaledVector(frame.normal, (wantedZ - point.dot(frame.normal)) * smooth((v - .45) / .20))
    }
    // Tip downturn is subtle; the entire cuticle/bed remains unchanged.
    point.addScaledVector(frame.normal, -extension * .025)
    return point
  }
  const width = frame.width * (1 + (nail.width - 1) * rootLock)
  const transverse = width * 0.5 * x * widthAt(nail, v)
  const rootRound = frame.bedLength * 0.065 * x * x * (1 - smooth(v / 0.2))
  const y = frame.bedLength * v + extension + rootRound - tipRound(nail, frame, width, x * widthAt(nail, v), v)
  const arch = frame.arch * (1 + (nail.curvature - 1) * rootLock)
  const z = arch * (1 - x * x) - frame.bedLength * 0.045 * v * v
  return frame.origin.clone().addScaledVector(frame.across, transverse).addScaledVector(frame.along, y).addScaledVector(frame.normal, z)
}

/** Closed, consistently wound shell. O(rows × columns); no new Hand mesh. */
export function createParametricNail(frame: NailFrame, nail: StudioNail, lowQuality = false): BufferGeometry {
  const rows = lowQuality ? 20 : 40, columns = lowQuality ? 12 : 24
  const layerSize = (rows + 1) * (columns + 1)
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], joints: number[] = [], weights: number[] = []
  const thickness = frame.width * 0.035
  for (let layer = 0; layer < 2; layer += 1) {
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns, v = row / rows
        const point = nailSurface(frame, nail, u, v).addScaledVector(frame.normal, -layer * thickness)
        positions.push(point.x, point.y, point.z)
        uvs.push(u, v)
        joints.push(frame.joint, 0, 0, 0); weights.push(1, 0, 0, 0)
      }
    }
  }
  for (let row = 0; row < rows; row += 1) for (let column = 0; column < columns; column += 1) {
    const a = row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1
    indices.push(a, b, d, a, d, c, a + layerSize, d + layerSize, b + layerSize, a + layerSize, c + layerSize, d + layerSize)
  }
  const rim: number[] = []
  for (let column = 0; column <= columns; column += 1) rim.push(column)
  for (let row = 1; row <= rows; row += 1) rim.push(row * (columns + 1) + columns)
  for (let column = columns - 1; column >= 0; column -= 1) rim.push(rows * (columns + 1) + column)
  for (let row = rows - 1; row > 0; row -= 1) rim.push(row * (columns + 1))
  rim.forEach((a, index) => {
    const b = rim[(index + 1) % rim.length]!
    indices.push(a, a + layerSize, b + layerSize, a, b + layerSize, b)
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(joints, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4))
  geometry.setIndex(indices)
  geometry.computeVertexNormals(); geometry.computeBoundingSphere(); geometry.computeBoundingBox()
  return geometry
}

/** A surface frame for attachments; normal derived from the actual parametric surface. */
export function decorationSurface(frame: NailFrame, nail: StudioNail, u: number, v: number) {
  const position = nailSurface(frame, nail, u, v)
  const tangent = nailSurface(frame, nail, u + 0.001, v).sub(position).normalize()
  const along = nailSurface(frame, nail, u, v + 0.001).sub(position).normalize()
  const normal = new Vector3().crossVectors(tangent, along).normalize()
  return { position, tangent, normal }
}
