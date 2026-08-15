# Nail Decoration System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the nail decoration system (Slice 4, items 1-3): UV-based surface placement math, InstancedMesh rendering with placeholder geometry, and mouse+panel interaction to add/move/rotate/scale/delete decorations, fully wired into undo/redo.

**Architecture:** Pure geometry math (`hull.ts`, `pointInHull.ts`, `surfaceProjection.ts`) with zero Three.js scene dependencies beyond `Mesh`/`Vector3` types, unit-tested like `tools/nail_geometry.py` was. Rendering via one `InstancedMesh` per catalog entry (placeholder primitives, swappable for GLB later). Interaction as a plain-logic pure function (`decorationPicking.ts`) plus a thin `TransformController` React wrapper mirroring `PaintController`'s "no decisions in the component" pattern. Everything routes through the existing `Command`/`HistoryStack` and `documentEdits.ts` identity-preserving helpers — no new document-mutation pattern.

**Tech Stack:** TypeScript, React Three Fiber, Zustand, Vitest. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-15-nail-decoration-design.md` — read this first, it explains *why* each decision below was made (D-28, D-29, D-30) and cites the prior algorithm/architecture decisions (D-10, A-11, A-21, A-01) this plan implements.

## Global Constraints

- Decoration position is stored as UV coordinates (`u`, `v` in `[0,1]`), never world position (DECISION D-10, `packages/contracts/src/design.ts:112-124` — schema already exists, do not modify it).
- Morph target names, `TAPER_START`, `UV_PADDING` etc. from the prior pipeline plan are untouched by this work — this plan does not touch `tools/`.
- One controller receives pointer events on the 3D canvas at a time — `PaintController` (paint mode) or `TransformController` (decorate mode), never both (DECISION D-28).
- No 3D transform gizmo. Rotate and scale are numeric-panel-only; only position is mouse-draggable (DECISION D-29).
- Adding a decoration is catalog-click-to-center, not drag-and-drop (DECISION D-30).
- Every command that mutates the document routes through `replaceNail`/`result()` in `apps/web/src/3d/history/commands/documentEdits.ts` and preserves object identity when nothing changes (see that file's header comment) — never hand-roll document spreads elsewhere.
- `MAX_DECORATIONS_PER_NAIL = 30` (from `packages/contracts/src/design.ts:49`) must be enforced in `AddDecorationCommand`.
- This repo has no DOM-testing infrastructure (no jsdom/RTL) — React components in this plan get manual browser verification (final task), not automated render tests. Only pure-logic modules get vitest coverage.
- Follow the codebase's Thai-language comments-explain-why convention in every new file (see any existing file in `apps/web/src/3d/` for tone).

---

### Task 1: `hull.ts` — Convex Hull (A-01)

**Files:**
- Create: `apps/web/src/3d/geometry/hull.ts`
- Test: `apps/web/src/3d/geometry/hull.test.ts`

**Interfaces:**
- Produces: `interface Pt2 { x: number; y: number }`, `function computeHull(points: readonly Pt2[]): Pt2[]` — returns convex hull vertices in counter-clockwise order. Fewer than 3 distinct input points returns those points unchanged (no hull possible).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/3d/geometry/hull.test.ts
import { describe, expect, it } from 'vitest'
import { computeHull, type Pt2 } from './hull.ts'

function area(hull: Pt2[]): number {
  let sum = 0
  for (let i = 0; i < hull.length; i += 1) {
    const a = hull[i]!
    const b = hull[(i + 1) % hull.length]!
    sum += a.x * b.y - b.x * a.y
  }
  return sum / 2
}

describe('computeHull', () => {
  it('returns fewer than 3 points unchanged', () => {
    expect(computeHull([])).toEqual([])
    expect(computeHull([{ x: 1, y: 1 }])).toEqual([{ x: 1, y: 1 }])
    expect(computeHull([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }])
  })

  it('finds the hull of a square with one interior point', () => {
    const points: Pt2[] = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
      { x: 0.5, y: 0.5 },
    ]
    const hull = computeHull(points)
    expect(hull).toHaveLength(4)
    expect(hull).not.toContainEqual({ x: 0.5, y: 0.5 })
  })

  it('produces a counter-clockwise winding (positive signed area)', () => {
    const points: Pt2[] = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }]
    expect(area(computeHull(points))).toBeGreaterThan(0)
  })

  it('drops duplicate points', () => {
    const points: Pt2[] = [
      { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ]
    expect(computeHull(points)).toHaveLength(4)
  })

  it('handles all-collinear points by returning them without crashing', () => {
    const points: Pt2[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
    expect(() => computeHull(points)).not.toThrow()
  })

  it('matches the known hull of an irregular nail-like point cloud', () => {
    // ทรงคล้ายเล็บ: ยาวตามแกน y แคบตามแกน x โค้งที่ปลาย
    const points: Pt2[] = [
      { x: 0.5, y: 0.05 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 },
      { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 },
      { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 },
      { x: 0.4, y: 0.95 }, { x: 0.6, y: 0.95 },
      { x: 0.5, y: 0.5 }, // interior point — ต้องไม่อยู่ใน hull
    ]
    const hull = computeHull(points)
    expect(hull).not.toContainEqual({ x: 0.5, y: 0.5 })
    expect(hull.length).toBeGreaterThanOrEqual(6)
    expect(area(hull)).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/3d/geometry/hull.test.ts`
Expected: FAIL — `hull.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/geometry/hull.ts
/**
 * Convex hull ด้วย Andrew's Monotone Chain (A-01)
 *
 * ใช้หาเส้นขอบนอกของเล็บในพิกัด UV เพื่อจำกัดพื้นที่วางของตกแต่ง (pointInHull.ts)
 * ดู docs/algorithms.md A-01 สำหรับ complexity analysis เต็ม — Θ(V log V), preprocessing
 * รันครั้งเดียวตอนโหลดโมเดล ไม่ใช่ทุกเฟรม
 */

export interface Pt2 {
  x: number
  y: number
}

function cross(o: Pt2, a: Pt2, b: Pt2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

/** คืนจุดยอดของ convex hull เรียงทวนเข็มนาฬิกา — จุดซ้ำและจุดภายในถูกตัดออก */
export function computeHull(points: readonly Pt2[]): Pt2[] {
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x))
  const unique: Pt2[] = []
  for (const point of sorted) {
    const last = unique[unique.length - 1]
    if (last && last.x === point.x && last.y === point.y) continue
    unique.push(point)
  }
  if (unique.length < 3) return unique

  const lower: Pt2[] = []
  for (const point of unique) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop()
    }
    lower.push(point)
  }

  const upper: Pt2[] = []
  for (let i = unique.length - 1; i >= 0; i -= 1) {
    const point = unique[i]!
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop()
    }
    upper.push(point)
  }

  lower.pop()
  upper.pop()
  return lower.concat(upper)
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/3d/geometry/hull.test.ts`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/geometry/hull.ts apps/web/src/3d/geometry/hull.test.ts
git commit -m "feat: add convex hull computation for decoration placement (A-01)"
```

---

### Task 2: `pointInHull.ts` — Point-in-Convex-Polygon (A-21)

**Files:**
- Create: `apps/web/src/3d/geometry/pointInHull.ts`
- Test: `apps/web/src/3d/geometry/pointInHull.test.ts`

**Interfaces:**
- Consumes: `Pt2` from `./hull.ts` (Task 1).
- Produces: `function isPointInHull(hull: readonly Pt2[], point: Pt2): boolean`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/3d/geometry/pointInHull.test.ts
import { describe, expect, it } from 'vitest'
import { computeHull, type Pt2 } from './hull.ts'
import { isPointInHull } from './pointInHull.ts'

const SQUARE: Pt2[] = computeHull([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }])

describe('isPointInHull', () => {
  it('returns false for a hull with fewer than 3 points', () => {
    expect(isPointInHull([], { x: 0, y: 0 })).toBe(false)
    expect(isPointInHull([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0 })).toBe(false)
  })

  it('finds the center of a square inside', () => {
    expect(isPointInHull(SQUARE, { x: 1, y: 1 })).toBe(true)
  })

  it('finds a point clearly outside', () => {
    expect(isPointInHull(SQUARE, { x: 5, y: 5 })).toBe(false)
    expect(isPointInHull(SQUARE, { x: -1, y: 1 })).toBe(false)
  })

  it('treats a vertex as inside', () => {
    expect(isPointInHull(SQUARE, { x: 0, y: 0 })).toBe(true)
  })

  it('treats a point on an edge as inside', () => {
    expect(isPointInHull(SQUARE, { x: 1, y: 0 })).toBe(true)
  })

  it('agrees with brute-force ray casting on a nail-like irregular hull', () => {
    const points: Pt2[] = [
      { x: 0.5, y: 0.05 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.1 },
      { x: 0.2, y: 0.4 }, { x: 0.8, y: 0.4 },
      { x: 0.25, y: 0.7 }, { x: 0.75, y: 0.7 },
      { x: 0.4, y: 0.95 }, { x: 0.6, y: 0.95 },
    ]
    const hull = computeHull(points)

    function bruteForceInside(poly: Pt2[], point: Pt2): boolean {
      // ray casting มาตรฐาน — ใช้เป็น oracle เทียบผลกับ binary search
      let inside = false
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
        const a = poly[i]!
        const b = poly[j]!
        const crosses = (a.y > point.y) !== (b.y > point.y)
          && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
        if (crosses) inside = !inside
      }
      return inside
    }

    const samples: Pt2[] = [
      { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.1 }, { x: 0.1, y: 0.1 },
      { x: 0.5, y: 0.9 }, { x: 0.9, y: 0.9 }, { x: 0.5, y: 0.02 },
    ]
    for (const sample of samples) {
      expect(isPointInHull(hull, sample)).toBe(bruteForceInside(hull, sample))
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/3d/geometry/pointInHull.test.ts`
Expected: FAIL — `pointInHull.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/geometry/pointInHull.ts
import type { Pt2 } from './hull.ts'

/**
 * ตรวจว่าจุดอยู่ใน convex hull หรือไม่ ด้วย fan decomposition + binary search (A-21)
 *
 * hull ต้องเป็นผลจาก computeHull (เรียงทวนเข็มนาฬิกา, convex เสมอ) — ใช้ประโยชน์จาก
 * ความนูนนี้: มุมรอบจุด hull[0] เรียงเป็น monotone จึง binary search หา "ลิ่ม" ที่จุด
 * ตกอยู่ได้ใน Θ(log h) แทนที่จะไล่ทุกขอบแบบ ray casting ที่ Θ(h)
 * ดู docs/algorithms.md A-21 สำหรับเหตุผลเต็ม
 */
export function isPointInHull(hull: readonly Pt2[], point: Pt2): boolean {
  const h = hull.length
  if (h < 3) return false

  const cross = (o: Pt2, a: Pt2, b: Pt2): number =>
    (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

  const origin = hull[0]!
  // จุดต้องอยู่ในลิ่มระหว่างขอบแรกกับขอบสุดท้ายที่ติดกับ origin ก่อน ไม่งั้นอยู่นอก hull แน่นอน
  if (cross(origin, hull[1]!, point) < 0) return false
  if (cross(origin, hull[h - 1]!, point) > 0) return false

  let low = 1
  let high = h - 1
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2)
    if (cross(origin, hull[mid]!, point) >= 0) low = mid
    else high = mid
  }

  return cross(hull[low]!, hull[high]!, point) >= 0
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/3d/geometry/pointInHull.test.ts`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/geometry/pointInHull.ts apps/web/src/3d/geometry/pointInHull.test.ts
git commit -m "feat: add point-in-convex-hull test for decoration bounds (A-21)"
```

---

### Task 3: `surfaceProjection.ts` — UV → World Surface Point (A-11)

**Files:**
- Create: `apps/web/src/3d/geometry/surfaceProjection.ts`
- Test: `apps/web/src/3d/geometry/surfaceProjection.test.ts`

**Interfaces:**
- Consumes: `nailMatrix` from `@/3d/scene/nailViews.ts` (existing, `apps/web/src/3d/scene/nailViews.ts:30`), `morphedPosition`/`morphedNormal` from `@/3d/scene/nailMorph.ts` (existing, `apps/web/src/3d/scene/nailMorph.ts:11,17`).
- Produces: `interface SurfacePoint { position: Vector3; normal: Vector3; tangent: Vector3 }`, `function projectUvToSurface(mesh: Mesh, u: number, v: number): SurfacePoint | null` — `null` when `(u,v)` doesn't fall inside any UV triangle of the mesh. Later tasks (DecorationInstances, TransformController) call this to place/reproject decorations.

Test note: this needs a real `Mesh` with `position`/`normal`/`uv` attributes and (for one test) a `SkinnedMesh` — build minimal fixtures directly with `three`'s `BufferGeometry`/`Mesh` (do not load `hand.glb` in a unit test; that belongs to manual browser verification in the final task).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/3d/geometry/surfaceProjection.test.ts
import { describe, expect, it } from 'vitest'
import { BufferAttribute, BufferGeometry, Mesh } from 'three'
import { projectUvToSurface } from './surfaceProjection.ts'

/** สร้าง mesh สี่เหลี่ยมแบนบนระนาบ XY สองสามเหลี่ยม UV กางเต็ม 0-1 พอดี */
function flatQuadMesh(): Mesh {
  const geometry = new BufferGeometry()
  // ลำดับจุด: (0,0,0) (1,0,0) (1,1,0) (0,1,0) — สองสามเหลี่ยม (0,1,2) และ (0,2,3)
  const positions = new Float32Array([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0,
  ])
  const normals = new Float32Array([
    0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1,
  ])
  const uvs = new Float32Array([
    0, 0, 1, 0, 1, 1, 0, 1,
  ])
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new BufferAttribute(normals, 3))
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  return new Mesh(geometry)
}

describe('projectUvToSurface', () => {
  it('returns null for a UV point outside every triangle', () => {
    const mesh = flatQuadMesh()
    expect(projectUvToSurface(mesh, 1.5, 1.5)).toBeNull()
    expect(projectUvToSurface(mesh, -0.5, 0.5)).toBeNull()
  })

  it('projects the center of the quad to the center of the plane', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.5, 0.5)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBeCloseTo(0.5, 5)
    expect(result!.position.y).toBeCloseTo(0.5, 5)
    expect(result!.position.z).toBeCloseTo(0, 5)
  })

  it('returns the flat normal facing +Z everywhere on the quad', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.2, 0.8)
    expect(result).not.toBeNull()
    expect(result!.normal.x).toBeCloseTo(0, 5)
    expect(result!.normal.y).toBeCloseTo(0, 5)
    expect(result!.normal.z).toBeCloseTo(1, 5)
  })

  it('returns a tangent perpendicular to the normal', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0.3, 0.4)
    expect(result).not.toBeNull()
    expect(result!.tangent.dot(result!.normal)).toBeCloseTo(0, 5)
    expect(result!.tangent.length()).toBeCloseTo(1, 5)
  })

  it('projects a UV corner to its exact matching vertex', () => {
    const mesh = flatQuadMesh()
    const result = projectUvToSurface(mesh, 0, 0)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBeCloseTo(0, 5)
    expect(result!.position.y).toBeCloseTo(0, 5)
  })

  it('handles a degenerate (zero-area) triangle without crashing or matching it', () => {
    const geometry = new BufferGeometry()
    // สามเหลี่ยมเสื่อม (จุดสามจุดเรียงเส้นตรง) ตามด้วยสามเหลี่ยมปกติที่มีจุดกึ่งกลางอยู่จริง
    const positions = new Float32Array([
      0, 0, 0, 1, 0, 0, 2, 0, 0, // degenerate
      0, 0, 0, 1, 0, 0, 0, 1, 0, // normal
    ])
    const normals = new Float32Array(18).fill(0)
    for (let i = 2; i < 18; i += 3) normals[i] = 1
    const uvs = new Float32Array([
      0, 0, 0.5, 0, 1, 0,
      0, 0, 1, 0, 0, 1,
    ])
    geometry.setAttribute('position', new BufferAttribute(positions, 3))
    geometry.setAttribute('normal', new BufferAttribute(normals, 3))
    geometry.setAttribute('uv', new BufferAttribute(uvs, 2))
    geometry.setIndex([0, 1, 2, 3, 4, 5])
    const mesh = new Mesh(geometry)
    expect(() => projectUvToSurface(mesh, 0.2, 0.2)).not.toThrow()
    const result = projectUvToSurface(mesh, 0.2, 0.2)
    expect(result).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/3d/geometry/surfaceProjection.test.ts`
Expected: FAIL — `surfaceProjection.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/geometry/surfaceProjection.ts
import { Matrix3, Vector3, type Mesh } from 'three'
import { morphedNormal, morphedPosition } from '@/3d/scene/nailMorph.ts'
import { nailMatrix } from '@/3d/scene/nailViews.ts'

/** ตำแหน่ง/ทิศ/แนวราบของผิวเล็บ ณ จุด UV หนึ่งจุด ในพิกัดโลก */
export interface SurfacePoint {
  position: Vector3
  normal: Vector3
  tangent: Vector3
}

/** แกนสำรองเมื่อคำนวณ tangent จาก UV ไม่ได้ (UV เสื่อมเป็นเส้นตรง) — เลี่ยงขนานกับ normal */
function fallbackTangent(normal: Vector3): Vector3 {
  const reference = Math.abs(normal.y) > 0.95 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0)
  return new Vector3().crossVectors(reference, normal).normalize()
}

/**
 * แปลงพิกัด UV เป็นตำแหน่ง/ทิศ/แนวราบจริงบนผิวเล็บในโลก (A-11)
 *
 * วนหาสามเหลี่ยมที่มี (u,v) ตกอยู่ข้างในด้วย barycentric coordinate แบบเดียวกับที่
 * nailFlatten.ts ทำ (แค่คนละทิศทาง — ที่นี่หาโลกจาก UV ไม่ใช่หาแผงจากโลก) แล้วรวม
 * ตำแหน่ง/normal ที่ morph แล้วผ่านเมทริกซ์เดียวกับที่ nailViewOf ใช้ เพื่อให้ของตกแต่ง
 * ตามทรง/ความยาวเล็บและสัดส่วนมือที่เปลี่ยนแปลงได้เสมอ (DECISION D-10)
 *
 * brute-force O(จำนวนสามเหลี่ยม) ต่อการเรียกหนึ่งครั้ง — acceptable ที่ T ≤ 512 ตาม A-11
 * ไม่ทำตารางแบ่งช่วงจนกว่าจะวัดแล้วว่าช้าจริง
 *
 * คืน null เมื่อจุดไม่ตกในสามเหลี่ยมไหนเลย (นอกรูปเล็บ)
 */
export function projectUvToSurface(mesh: Mesh, u: number, v: number): SurfacePoint | null {
  const uvAttribute = mesh.geometry.getAttribute('uv')
  if (!uvAttribute) throw new Error(`mesh ${mesh.name} ไม่มี uv attribute`)

  const index = mesh.geometry.getIndex()
  const count = index ? index.count : uvAttribute.count
  const vertexAt = (cursor: number): number => (index ? index.getX(cursor) : cursor)

  for (let cursor = 0; cursor + 2 < count; cursor += 3) {
    const a = vertexAt(cursor)
    const b = vertexAt(cursor + 1)
    const c = vertexAt(cursor + 2)
    const u0 = uvAttribute.getX(a)
    const v0 = uvAttribute.getY(a)
    const u1 = uvAttribute.getX(b)
    const v1 = uvAttribute.getY(b)
    const u2 = uvAttribute.getX(c)
    const v2 = uvAttribute.getY(c)

    const denominator = (v1 - v2) * (u0 - u2) + (u2 - u1) * (v0 - v2)
    if (Math.abs(denominator) < 1e-12) continue
    const w0 = ((v1 - v2) * (u - u2) + (u2 - u1) * (v - v2)) / denominator
    const w1 = ((v2 - v0) * (u - u2) + (u0 - u2) * (v - v2)) / denominator
    const w2 = 1 - w0 - w1
    if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue

    const matrix = nailMatrix(mesh)
    const normalMatrix = new Matrix3().getNormalMatrix(matrix)

    const p0 = morphedPosition(mesh, a, new Vector3()).applyMatrix4(matrix)
    const p1 = morphedPosition(mesh, b, new Vector3()).applyMatrix4(matrix)
    const p2 = morphedPosition(mesh, c, new Vector3()).applyMatrix4(matrix)
    const position = new Vector3(
      w0 * p0.x + w1 * p1.x + w2 * p2.x,
      w0 * p0.y + w1 * p1.y + w2 * p2.y,
      w0 * p0.z + w1 * p1.z + w2 * p2.z,
    )

    const n0 = morphedNormal(mesh, a, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const n1 = morphedNormal(mesh, b, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const n2 = morphedNormal(mesh, c, new Vector3()).applyMatrix3(normalMatrix).normalize()
    const normal = new Vector3(
      w0 * n0.x + w1 * n1.x + w2 * n2.x,
      w0 * n0.y + w1 * n1.y + w2 * n2.y,
      w0 * n0.z + w1 * n1.z + w2 * n2.z,
    )
    if (normal.lengthSq() < 1e-12) normal.copy(n0)
    normal.normalize()

    // tangent จากอนุพันธ์ UV: หาแกนในโลกที่สอดคล้องกับทิศ +u บนผิว (สูตรมาตรฐานของ
    // tangent-space จาก normal mapping) แล้วตัดองค์ประกอบตามแนว normal ออกด้วย
    // Gram-Schmidt ให้ตั้งฉากกับ normal จริง ๆ
    const edge1 = p1.clone().sub(p0)
    const edge2 = p2.clone().sub(p0)
    const deltaU1 = u1 - u0
    const deltaV1 = v1 - v0
    const deltaU2 = u2 - u0
    const deltaV2 = v2 - v0
    const tangentDenominator = deltaU1 * deltaV2 - deltaU2 * deltaV1

    let tangent: Vector3
    if (Math.abs(tangentDenominator) < 1e-12) {
      tangent = fallbackTangent(normal)
    } else {
      const f = 1 / tangentDenominator
      tangent = new Vector3(
        f * (deltaV2 * edge1.x - deltaV1 * edge2.x),
        f * (deltaV2 * edge1.y - deltaV1 * edge2.y),
        f * (deltaV2 * edge1.z - deltaV1 * edge2.z),
      )
      tangent.sub(normal.clone().multiplyScalar(tangent.dot(normal)))
      tangent = tangent.lengthSq() < 1e-12 ? fallbackTangent(normal) : tangent.normalize()
    }

    return { position, normal, tangent }
  }
  return null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/3d/geometry/surfaceProjection.test.ts`
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/geometry/surfaceProjection.ts apps/web/src/3d/geometry/surfaceProjection.test.ts
git commit -m "feat: add UV-to-world surface projection for decoration placement (A-11)"
```

---

### Task 4: `decorationCatalog.ts` — Placeholder Catalog

**Files:**
- Create: `apps/web/src/3d/decorations/decorationCatalog.ts`
- Test: `apps/web/src/3d/decorations/decorationCatalog.test.ts`

**Interfaces:**
- Produces: `interface CatalogEntry { id: string; label: string; geometry: () => BufferGeometry; defaultScale: number }`, `const DECORATION_CATALOG: readonly CatalogEntry[]`, `function catalogEntry(id: string): CatalogEntry | undefined`. Later tasks (DecorationInstances, DecorationPanel) consume `DECORATION_CATALOG` and `catalogEntry`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/web/src/3d/decorations/decorationCatalog.test.ts
import { describe, expect, it } from 'vitest'
import { BufferGeometry } from 'three'
import { catalogEntry, DECORATION_CATALOG } from './decorationCatalog.ts'

describe('decorationCatalog', () => {
  it('has at least one entry with a unique id, label, and positive default scale', () => {
    expect(DECORATION_CATALOG.length).toBeGreaterThan(0)
    const ids = new Set(DECORATION_CATALOG.map((entry) => entry.id))
    expect(ids.size).toBe(DECORATION_CATALOG.length)
    for (const entry of DECORATION_CATALOG) {
      expect(entry.label.length).toBeGreaterThan(0)
      expect(entry.defaultScale).toBeGreaterThan(0)
    }
  })

  it('geometry() returns a fresh BufferGeometry instance each call', () => {
    const entry = DECORATION_CATALOG[0]!
    const first = entry.geometry()
    const second = entry.geometry()
    expect(first).toBeInstanceOf(BufferGeometry)
    expect(first).not.toBe(second)
  })

  it('catalogEntry finds an existing id and returns undefined for an unknown one', () => {
    const known = DECORATION_CATALOG[0]!
    expect(catalogEntry(known.id)).toBe(known)
    expect(catalogEntry('does-not-exist')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx vitest run src/3d/decorations/decorationCatalog.test.ts`
Expected: FAIL — `decorationCatalog.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/decorations/decorationCatalog.ts
import { BoxGeometry, ConeGeometry, IcosahedronGeometry, type BufferGeometry } from 'three'

/**
 * รายการของตกแต่งที่เลือกวางบนเล็บได้
 *
 * ตอนนี้ใช้ placeholder geometry ล้วน — ยังไม่มี asset 3D จริง (การทำคลัง asset จริง
 * 30-50 ชิ้นเป็นงาน Slice 5) โครงสร้างนี้ออกแบบให้สลับ geometry factory เป็น GLTF
 * loader ได้ทีหลังโดยไม่ต้องแก้โค้ดที่เรียกใช้ catalog เลย — แค่เปลี่ยนข้อมูลในไฟล์นี้
 */
export interface CatalogEntry {
  id: string
  label: string
  /** factory ไม่ใช่ instance เดียวที่แชร์ข้าม InstancedMesh — แต่ละเรียกต้องได้ก้อนใหม่ */
  geometry: () => BufferGeometry
  defaultScale: number
}

export const DECORATION_CATALOG: readonly CatalogEntry[] = [
  { id: 'gem', label: 'เพชร', geometry: () => new IcosahedronGeometry(1, 0), defaultScale: 0.08 },
  { id: 'bow', label: 'โบว์', geometry: () => new BoxGeometry(1.6, 0.4, 0.6), defaultScale: 0.06 },
  { id: 'star', label: 'ดาว', geometry: () => new ConeGeometry(1, 1, 5), defaultScale: 0.07 },
]

export function catalogEntry(id: string): CatalogEntry | undefined {
  return DECORATION_CATALOG.find((entry) => entry.id === id)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx vitest run src/3d/decorations/decorationCatalog.test.ts`
Expected: PASS, 3/3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/decorations/decorationCatalog.ts apps/web/src/3d/decorations/decorationCatalog.test.ts
git commit -m "feat: add placeholder decoration catalog"
```

---

### Task 5: `decorationPicking.ts` — Pure Selection Logic

**Files:**
- Create: `apps/web/src/3d/decorations/decorationPicking.ts`
- Test: `apps/web/src/3d/decorations/decorationPicking.test.ts`

**Interfaces:**
- Consumes: `Decoration` type from `@nail-studio/contracts`.
- Produces: `const SELECTION_RADIUS_UV: number`, `function nearestDecoration(decorations: readonly Decoration[], u: number, v: number): Decoration | null`. Consumed by Task 9 (`TransformController`) to decide what a click/drag hits — mirrors `picking.ts`'s "pure targeting logic separated from event binding" pattern (`apps/web/src/3d/painting/picking.ts:6-11`).

Selecting by nearest-UV-distance (rather than raycasting the rendered `InstancedMesh` and mapping `instanceId` back to a decoration) is this plan's simplification of the spec's §6 interaction sketch: the pointer-down raycast already lands on the nail surface and yields a UV point (reusing the existing `pickNail`/`picking.ts` pipeline, Task 9), so finding the nearest placed decoration to that UV point is enough — no new hit-testing infrastructure against the instanced meshes is needed.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/3d/decorations/decorationPicking.test.ts
import { describe, expect, it } from 'vitest'
import type { Decoration } from '@nail-studio/contracts'
import { nearestDecoration, SELECTION_RADIUS_UV } from './decorationPicking.ts'

function deco(id: string, u: number, v: number): Decoration {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('nearestDecoration', () => {
  it('returns null for an empty list', () => {
    expect(nearestDecoration([], 0.5, 0.5)).toBeNull()
  })

  it('returns the only decoration when the click is within range', () => {
    const target = deco('a', 0.5, 0.5)
    expect(nearestDecoration([target], 0.51, 0.5)).toBe(target)
  })

  it('returns null when the nearest decoration is outside the selection radius', () => {
    const target = deco('a', 0.5, 0.5)
    const far = 0.5 + SELECTION_RADIUS_UV * 3
    expect(nearestDecoration([target], far, 0.5)).toBeNull()
  })

  it('picks the closer of two overlapping decorations', () => {
    const near = deco('near', 0.5, 0.5)
    const far = deco('far', 0.55, 0.55)
    expect(nearestDecoration([far, near], 0.5, 0.5)).toBe(near)
  })

  it('treats a point exactly at the selection radius boundary as inside', () => {
    const target = deco('a', 0.5, 0.5)
    expect(nearestDecoration([target], 0.5 + SELECTION_RADIUS_UV, 0.5)).toBe(target)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/3d/decorations/decorationPicking.test.ts`
Expected: FAIL — `decorationPicking.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/decorations/decorationPicking.ts
import type { Decoration } from '@nail-studio/contracts'

/**
 * ตรรกะการเล็งเป้าของตกแต่งล้วน ๆ แยกจากการผูก event — ทดสอบได้ด้วยข้อมูลธรรมดา
 * ไม่ต้องมี WebGL หรือ pointer event ใด ๆ (มาตรฐานเดียวกับ picking.ts ของระบบวาด)
 *
 * เลือกด้วยระยะทาง UV ที่ใกล้ที่สุดจากจุดที่คลิก แทนที่จะ raycast กับ InstancedMesh
 * ที่เรนเดอร์จริงแล้วแปลง instanceId กลับเป็นของตกแต่ง — pointer-down บนเล็บให้พิกัด UV
 * มาอยู่แล้วผ่าน pickNail (picking.ts) การหาของตกแต่งที่ใกล้ UV นั้นที่สุดจึงพอ ไม่ต้อง
 * สร้างระบบ hit-test คู่ขนานอีกชุด
 */
export const SELECTION_RADIUS_UV = 0.08

export function nearestDecoration(
  decorations: readonly Decoration[],
  u: number,
  v: number,
): Decoration | null {
  let best: Decoration | null = null
  let bestDistance = SELECTION_RADIUS_UV
  for (const decoration of decorations) {
    const distance = Math.hypot(decoration.u - u, decoration.v - v)
    if (distance <= bestDistance) {
      best = decoration
      bestDistance = distance
    }
  }
  return best
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/3d/decorations/decorationPicking.test.ts`
Expected: PASS, 5/5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/decorations/decorationPicking.ts apps/web/src/3d/decorations/decorationPicking.test.ts
git commit -m "feat: add pure nearest-decoration selection logic"
```

---

### Task 6: Decoration Commands

**Files:**
- Create: `apps/web/src/3d/history/commands/decorationCommands.ts`
- Modify: `apps/web/src/3d/history/commands/commands.test.ts` (add a new `describe` block at the end of the file)

**Interfaces:**
- Consumes: `Command`, `CommandResult` from `../Command.ts`; `replaceNail`, `result` from `./documentEdits.ts`; `Decoration`, `MAX_DECORATIONS_PER_NAIL`, `NailKey` from `@nail-studio/contracts`.
- Produces: `AddDecorationCommand`, `RemoveDecorationCommand`, `MoveDecorationCommand`, `ScaleDecorationCommand` classes. Consumed by Task 7 (store wiring).

**Note on `replaceNail`/`result` signatures**: `replaceNail(document, key, update: (nail: Nail) => Nail)` builds a `CommandResult` automatically from whether `update` returned the same or a new reference (`apps/web/src/3d/history/commands/documentEdits.ts:21-30`) — the commands below use it directly, mirroring `AddLayerCommand`/`RemoveLayerCommand` in `layerCommands.ts` (array add/remove) and `SetFinishCommand`/`SetShapeCommand` in `nailCommands.ts` (scalar before/after + merge).

- [ ] **Step 1: Write the failing tests** (append to the end of `commands.test.ts`, inside a new `describe` block — do not modify existing tests)

```typescript
// Add to the end of apps/web/src/3d/history/commands/commands.test.ts
// (add this import alongside the existing imports at the top of the file)
// import {
//   AddDecorationCommand,
//   MoveDecorationCommand,
//   RemoveDecorationCommand,
//   ScaleDecorationCommand,
// } from './decorationCommands.ts'
// import { MAX_DECORATIONS_PER_NAIL, type Decoration } from '@nail-studio/contracts'

function decoration(id: string, u = 0.5, v = 0.5): Decoration {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('decoration commands', () => {
  it('adds and removes a decoration, restoring the exact original document', () => {
    const document = createEmptyDocument()
    const deco = decoration('deco-1')
    expectRoundTrip(document, new AddDecorationCommand(RIGHT_INDEX, deco, 0))
  })

  it('does not add a decoration beyond MAX_DECORATIONS_PER_NAIL', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: Array.from({ length: MAX_DECORATIONS_PER_NAIL }, (_, i) => decoration(`d-${i}`)),
    }
    const command = new AddDecorationCommand(RIGHT_INDEX, decoration('overflow'), MAX_DECORATIONS_PER_NAIL)
    const result = command.do(document)
    expect(result.document.nails[RIGHT_INDEX].decorations).toHaveLength(MAX_DECORATIONS_PER_NAIL)
    expect(result.affects.size).toBe(0)
  })

  it('restores a removed decoration at its original index', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a'), decoration('b'), decoration('c')],
    }
    const target = document.nails[RIGHT_INDEX].decorations[1]!
    expectRoundTrip(document, new RemoveDecorationCommand(RIGHT_INDEX, target, 1))
  })

  it('restores decoration position and rotation after a move', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a', 0.3, 0.3)],
    }
    const command = new MoveDecorationCommand(
      RIGHT_INDEX, 'a',
      { u: 0.3, v: 0.3, rotation: 0 },
      { u: 0.6, v: 0.7, rotation: 1.2 },
    )
    expectRoundTrip(document, command)
  })

  it('merges two consecutive moves with the same mergeKey into one before/after pair', () => {
    const first = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.1, v: 0.1, rotation: 0 }, { u: 0.2, v: 0.2, rotation: 0 }, 'drag-1',
    )
    const second = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.2, v: 0.2, rotation: 0 }, { u: 0.3, v: 0.3, rotation: 0 }, 'drag-1',
    )
    const merged = first.merge?.(second) as MoveDecorationCommand | null
    expect(merged).not.toBeNull()
    expect(merged!.before).toEqual({ u: 0.1, v: 0.1, rotation: 0 })
    expect(merged!.after).toEqual({ u: 0.3, v: 0.3, rotation: 0 })
  })

  it('does not merge moves with different mergeKeys', () => {
    const first = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.1, v: 0.1, rotation: 0 }, { u: 0.2, v: 0.2, rotation: 0 }, 'drag-1',
    )
    const second = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.2, v: 0.2, rotation: 0 }, { u: 0.3, v: 0.3, rotation: 0 }, 'drag-2',
    )
    expect(first.merge?.(second)).toBeNull()
  })

  it('restores a decoration scale after resizing', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a')],
    }
    document.nails[RIGHT_INDEX].decorations[0] = { ...document.nails[RIGHT_INDEX].decorations[0]!, scale: 0.1 }
    expectRoundTrip(document, new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.1, 0.4))
  })

  it('merges two consecutive scale changes with the same mergeKey', () => {
    const first = new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.1, 0.2, 'resize-1')
    const second = new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.2, 0.3, 'resize-1')
    const merged = first.merge?.(second) as ScaleDecorationCommand | null
    expect(merged).not.toBeNull()
    expect(merged!.before).toBe(0.1)
    expect(merged!.after).toBe(0.3)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/3d/history/commands/commands.test.ts`
Expected: FAIL — `decorationCommands.ts` does not exist yet, import error.

- [ ] **Step 3: Write the implementation**

```typescript
// apps/web/src/3d/history/commands/decorationCommands.ts
import {
  MAX_DECORATIONS_PER_NAIL,
  type DesignDocument,
  type Decoration,
  type NailKey,
} from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { replaceNail } from './documentEdits.ts'

export class AddDecorationCommand implements Command {
  readonly label = 'เพิ่มของตกแต่ง'
  readonly key: NailKey
  readonly decoration: Decoration
  readonly index: number

  constructor(key: NailKey, decoration: Decoration, index: number) {
    this.key = key
    this.decoration = decoration
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.decorations.length >= MAX_DECORATIONS_PER_NAIL) return nail
      if (this.index < 0 || this.index > nail.decorations.length) return nail
      if (nail.decorations.some((decoration) => decoration.id === this.decoration.id)) return nail
      const decorations = [...nail.decorations]
      decorations.splice(this.index, 0, this.decoration)
      return { ...nail, decorations }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decoration.id)
      if (index < 0) return nail
      const decorations = [...nail.decorations]
      decorations.splice(index, 1)
      return { ...nail, decorations }
    })
  }
}

export class RemoveDecorationCommand implements Command {
  readonly label = 'ลบของตกแต่ง'
  readonly key: NailKey
  readonly decoration: Decoration
  readonly index: number

  constructor(key: NailKey, decoration: Decoration, index: number) {
    this.key = key
    this.decoration = decoration
    this.index = index
  }

  do(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decoration.id)
      if (index < 0) return nail
      const decorations = [...nail.decorations]
      decorations.splice(index, 1)
      return { ...nail, decorations }
    })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      if (nail.decorations.some((decoration) => decoration.id === this.decoration.id)) return nail
      const index = Math.min(Math.max(this.index, 0), nail.decorations.length)
      const decorations = [...nail.decorations]
      decorations.splice(index, 0, this.decoration)
      return { ...nail, decorations }
    })
  }
}

interface DecorationTransform {
  u: number
  v: number
  rotation: number
}

export class MoveDecorationCommand implements Command {
  readonly label = 'ย้ายของตกแต่ง'
  readonly key: NailKey
  readonly decorationId: string
  readonly before: DecorationTransform
  readonly after: DecorationTransform
  readonly mergeKey?: string

  constructor(
    key: NailKey,
    decorationId: string,
    before: DecorationTransform,
    after: DecorationTransform,
    mergeKey?: string,
  ) {
    this.key = key
    this.decorationId = decorationId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  private apply(document: DesignDocument, transform: DecorationTransform): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decorationId)
      if (index < 0) return nail
      const current = nail.decorations[index]!
      if (current.u === transform.u && current.v === transform.v && current.rotation === transform.rotation) {
        return nail
      }
      const decorations = [...nail.decorations]
      decorations[index] = { ...current, u: transform.u, v: transform.v, rotation: transform.rotation }
      return { ...nail, decorations }
    })
  }

  do(document: DesignDocument): CommandResult {
    return this.apply(document, this.after)
  }

  undo(document: DesignDocument): CommandResult {
    return this.apply(document, this.before)
  }

  merge(next: Command): Command | null {
    if (!(next instanceof MoveDecorationCommand)) return null
    if (next.key !== this.key || next.decorationId !== this.decorationId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new MoveDecorationCommand(this.key, this.decorationId, this.before, next.after, this.mergeKey)
  }
}

export class ScaleDecorationCommand implements Command {
  readonly label = 'ปรับขนาดของตกแต่ง'
  readonly key: NailKey
  readonly decorationId: string
  readonly before: number
  readonly after: number
  readonly mergeKey?: string

  constructor(key: NailKey, decorationId: string, before: number, after: number, mergeKey?: string) {
    this.key = key
    this.decorationId = decorationId
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  private apply(document: DesignDocument, scale: number): CommandResult {
    return replaceNail(document, this.key, (nail) => {
      const index = nail.decorations.findIndex((decoration) => decoration.id === this.decorationId)
      if (index < 0) return nail
      const current = nail.decorations[index]!
      if (current.scale === scale) return nail
      const decorations = [...nail.decorations]
      decorations[index] = { ...current, scale }
      return { ...nail, decorations }
    })
  }

  do(document: DesignDocument): CommandResult {
    return this.apply(document, this.after)
  }

  undo(document: DesignDocument): CommandResult {
    return this.apply(document, this.before)
  }

  merge(next: Command): Command | null {
    if (!(next instanceof ScaleDecorationCommand)) return null
    if (next.key !== this.key || next.decorationId !== this.decorationId) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new ScaleDecorationCommand(this.key, this.decorationId, this.before, next.after, this.mergeKey)
  }
}
```

Also add the import block at the very top of `commands.test.ts`, alongside the existing `nailCommands.ts` import:

```typescript
import {
  AddDecorationCommand,
  MoveDecorationCommand,
  RemoveDecorationCommand,
  ScaleDecorationCommand,
} from './decorationCommands.ts'
```

And add `Decoration` to the existing `import { ... } from '@nail-studio/contracts'` line at the top, and `MAX_DECORATIONS_PER_NAIL` alongside it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/3d/history/commands/commands.test.ts`
Expected: PASS, all existing tests plus 8 new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/history/commands/decorationCommands.ts apps/web/src/3d/history/commands/commands.test.ts
git commit -m "feat: add decoration add/remove/move/scale commands"
```

---

### Task 7: Store Wiring — Mode, Selection, and Decoration Actions

**Files:**
- Modify: `apps/web/src/features/design/designStore.ts`
- Test: `apps/web/src/features/design/decorationActions.test.ts` (new file)

**Interfaces:**
- Consumes: `AddDecorationCommand`, `MoveDecorationCommand`, `RemoveDecorationCommand`, `ScaleDecorationCommand` from Task 6; `catalogEntry` from Task 4 is NOT used here (catalog lookup happens in the UI, Task 10) — the store only receives an already-built `Decoration` object, mirroring how `addLayer` receives an already-built `Layer`.
- Produces (added to `DesignState`): `mode: 'paint' | 'decorate'`, `selectedDecoration: { key: NailKey; decorationId: string } | null`.
  Produces (added to `DesignActions`): `setMode: (mode: 'paint' | 'decorate') => void`, `selectDecoration: (target: { key: NailKey; decorationId: string } | null) => void`, `addDecoration: (key: NailKey, decoration: Decoration) => void`, `removeDecoration: (key: NailKey, decorationId: string) => void`, `moveDecoration: (key: NailKey, decorationId: string, u: number, v: number, rotation: number, mergeKey?: string) => void`, `scaleDecoration: (key: NailKey, decorationId: string, scale: number, mergeKey?: string) => void`.
  Consumed by Task 9 (`TransformController`) and Task 10 (`DecorationPanel`, mode toggle button).

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/web/src/features/design/decorationActions.test.ts
import { describe, expect, it } from 'vitest'
import type { NailKey } from '@nail-studio/contracts'
import { createDesignStore } from './designStore.ts'

const RIGHT_INDEX: NailKey = 'right.index'

function deco(id: string, u = 0.5, v = 0.5) {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('decoration store actions', () => {
  it('defaults to paint mode with no selection', () => {
    const store = createDesignStore()
    expect(store.getState().mode).toBe('paint')
    expect(store.getState().selectedDecoration).toBeNull()
  })

  it('switches mode', () => {
    const store = createDesignStore()
    store.getState().setMode('decorate')
    expect(store.getState().mode).toBe('decorate')
  })

  it('adds a decoration to the given nail', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    expect(store.getState().document.nails[RIGHT_INDEX].decorations).toHaveLength(1)
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.id).toBe('a')
  })

  it('removes a decoration and clears selection if it was selected', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    store.getState().selectDecoration({ key: RIGHT_INDEX, decorationId: 'a' })
    store.getState().removeDecoration(RIGHT_INDEX, 'a')
    expect(store.getState().document.nails[RIGHT_INDEX].decorations).toHaveLength(0)
    expect(store.getState().selectedDecoration).toBeNull()
  })

  it('moves a decoration and supports undo', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a', 0.3, 0.3))
    store.getState().moveDecoration(RIGHT_INDEX, 'a', 0.6, 0.7, 1.0)
    const moved = store.getState().document.nails[RIGHT_INDEX].decorations[0]!
    expect(moved.u).toBeCloseTo(0.6)
    expect(moved.v).toBeCloseTo(0.7)
    expect(moved.rotation).toBeCloseTo(1.0)
    store.getState().undo()
    const restored = store.getState().document.nails[RIGHT_INDEX].decorations[0]!
    expect(restored.u).toBeCloseTo(0.3)
    expect(restored.v).toBeCloseTo(0.3)
  })

  it('scales a decoration and supports undo', () => {
    const store = createDesignStore()
    store.getState().addDecoration(RIGHT_INDEX, deco('a'))
    store.getState().scaleDecoration(RIGHT_INDEX, 'a', 0.5)
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.scale).toBeCloseTo(0.5)
    store.getState().undo()
    expect(store.getState().document.nails[RIGHT_INDEX].decorations[0]!.scale).toBeCloseTo(0.1)
  })

  it('adding to a non-editable nail is a no-op', () => {
    const store = createDesignStore()
    const before = store.getState().document
    store.getState().addDecoration('left.thumb' as NailKey, deco('a'))
    expect(store.getState().document).toBe(before)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/web && npx vitest run src/features/design/decorationActions.test.ts`
Expected: FAIL — `mode`/`selectedDecoration`/decoration actions don't exist on the store yet.

- [ ] **Step 3: Write the implementation**

In `apps/web/src/features/design/designStore.ts`:

1. Add to the imports from `@/3d/history/commands/decorationCommands.ts` (new import line, alongside the existing `nailCommands.ts` import):

```typescript
import {
  AddDecorationCommand,
  MoveDecorationCommand,
  RemoveDecorationCommand,
  ScaleDecorationCommand,
} from '@/3d/history/commands/decorationCommands.ts'
```

2. Add `Decoration` to the existing `@nail-studio/contracts` import line.

3. Add to `DesignState` (after `history: HistoryStack`):

```typescript
  mode: 'paint' | 'decorate'
  selectedDecoration: { key: NailKey; decorationId: string } | null
```

4. Add to `DesignActions` (after `setBaseColor`):

```typescript
  setMode: (mode: 'paint' | 'decorate') => void
  selectDecoration: (target: { key: NailKey; decorationId: string } | null) => void
  addDecoration: (key: NailKey, decoration: Decoration) => void
  removeDecoration: (key: NailKey, decorationId: string) => void
  moveDecoration: (key: NailKey, decorationId: string, u: number, v: number, rotation: number, mergeKey?: string) => void
  scaleDecoration: (key: NailKey, decorationId: string, scale: number, mergeKey?: string) => void
```

5. Add to the store's initial state object (after `history,`):

```typescript
      mode: 'paint',
      selectedDecoration: null,
```

6. Add the action implementations (after the existing `setBaseColor` action, before `copyActiveNailToAll`):

```typescript
      setMode: (mode) => set({ mode, selectedDecoration: mode === 'paint' ? null : get().selectedDecoration }),

      selectDecoration: (target) => set({ selectedDecoration: target }),

      addDecoration: (key, decoration) => {
        if (!isEditable(key)) return
        const nail = get().document.nails[key]
        execute(new AddDecorationCommand(key, decoration, nail.decorations.length))
      },

      removeDecoration: (key, decorationId) => {
        if (!isEditable(key)) return
        const decorations = get().document.nails[key].decorations
        const index = decorations.findIndex((decoration) => decoration.id === decorationId)
        const decoration = decorations[index]
        if (!decoration) return
        if (execute(new RemoveDecorationCommand(key, decoration, index))) {
          const selected = get().selectedDecoration
          if (selected && selected.key === key && selected.decorationId === decorationId) {
            set({ selectedDecoration: null })
          }
        }
      },

      moveDecoration: (key, decorationId, u, v, rotation, mergeKey) => {
        if (!isEditable(key)) return
        const decoration = get().document.nails[key].decorations.find((item) => item.id === decorationId)
        if (!decoration) return
        execute(new MoveDecorationCommand(
          key, decorationId,
          { u: decoration.u, v: decoration.v, rotation: decoration.rotation },
          { u, v, rotation },
          mergeKey,
        ))
      },

      scaleDecoration: (key, decorationId, scale, mergeKey) => {
        if (!isEditable(key)) return
        const decoration = get().document.nails[key].decorations.find((item) => item.id === decorationId)
        if (!decoration) return
        execute(new ScaleDecorationCommand(key, decorationId, decoration.scale, scale, mergeKey))
      },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && npx vitest run src/features/design/decorationActions.test.ts`
Expected: PASS, 7/7 tests.

Also run the full web test suite to confirm nothing existing broke:
Run: `cd apps/web && npx vitest run`
Expected: all pre-existing tests still pass, plus the new ones.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/design/designStore.ts apps/web/src/features/design/decorationActions.test.ts
git commit -m "feat: wire decoration add/remove/move/scale and mode into the design store"
```

---

### Task 8: `DecorationInstances.tsx` — Rendering

**Files:**
- Create: `apps/web/src/3d/decorations/DecorationInstances.tsx`
- Modify: `apps/web/src/3d/scene/DesignScene.tsx`

**Interfaces:**
- Consumes: `DECORATION_CATALOG` (Task 4), `projectUvToSurface` (Task 3), `HandParts` (existing, `apps/web/src/3d/models/HandModel.tsx`), `useDesignStoreApi` (existing, `apps/web/src/features/design/DesignStoreProvider.tsx`), `EDITABLE_NAILS` (existing, `apps/web/src/features/design/designStore.ts:39`).
- Produces: `function DecorationInstances({ parts }: { parts: HandParts }): JSX.Element` — one `<primitive object={InstancedMesh}>` per catalog entry, matrices rebuilt whenever the document's decorations (or hand proportions, or nail shape/length) change.

No automated test for this task (React Three Fiber rendering, no DOM-testing infra per the Global Constraints) — verified manually in Task 11.

- [ ] **Step 1: Write the implementation**

```typescript
// apps/web/src/3d/decorations/DecorationInstances.tsx
import { useEffect, useMemo, useRef } from 'react'
import { InstancedMesh, Matrix4, MeshStandardMaterial, Object3D, Vector3 } from 'three'
import { EDITABLE_NAILS } from '@/features/design/designStore.ts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { projectUvToSurface } from '@/3d/geometry/surfaceProjection.ts'
import { DECORATION_CATALOG } from './decorationCatalog.ts'

interface Props {
  parts: HandParts
}

/** เพดานจำนวน instance ต่อ catalog entry — 30 ต่อเล็บ (MAX_DECORATIONS_PER_NAIL) × 5 นิ้ว */
const MAX_INSTANCES_PER_CATALOG_ENTRY = 30 * 5

/**
 * เรนเดอร์ของตกแต่งทั้งหมดด้วย InstancedMesh หนึ่งตัวต่อ catalog entry ครอบคลุมทั้งมือ
 *
 * ไม่แยกต่อเล็บเพราะของตกแต่ง catalog เดียวกันแชร์ geometry/material ได้อยู่แล้วไม่ว่า
 * จะอยู่เล็บไหน slot ที่ไม่ได้ใช้ถูกซ่อนด้วยการตั้ง scale เป็น 0 (มองไม่เห็น ไม่กิน
 * draw call เพิ่มเพราะ instanced mesh นับ 1 draw call ต่อ mesh ไม่ใช่ต่อ instance)
 *
 * Matrix ของทุก instance ถูกคำนวณใหม่เมื่อ document เปลี่ยน (มาตรฐานเดียวกับ
 * useNailTextures.ts — เทียบ identity ของ document ก่อนแล้วค่อย rebuild ไม่ใช่ diff
 * ทุกเฟรม) ครอบคลุมทั้งการเพิ่ม/ลบ/ย้ายของตกแต่ง และการเปลี่ยนทรง/ความยาวเล็บหรือ
 * สัดส่วนมือ (ซึ่งเปลี่ยนตำแหน่งที่ projectUvToSurface คำนวณได้โดยอัตโนมัติ เพราะสิ่ง
 * เหล่านั้นก็เปลี่ยน document เหมือนกัน)
 */
export function DecorationInstances({ parts }: Props) {
  const store = useDesignStoreApi()
  const meshRefs = useRef<Map<string, InstancedMesh>>(new Map())

  const meshes = useMemo(() => DECORATION_CATALOG.map((entry) => {
    const mesh = new InstancedMesh(
      entry.geometry(),
      new MeshStandardMaterial({ color: '#d9d9d9', metalness: 0.3, roughness: 0.4 }),
      MAX_INSTANCES_PER_CATALOG_ENTRY,
    )
    mesh.name = `decorations-${entry.id}`
    mesh.count = 0
    meshRefs.current.set(entry.id, mesh)
    return mesh
  }), [])

  useEffect(() => () => {
    for (const mesh of meshRefs.current.values()) {
      mesh.geometry.dispose()
      if (mesh.material instanceof MeshStandardMaterial) mesh.material.dispose()
    }
  }, [])

  useEffect(() => {
    const object = new Object3D()

    const rebuild = () => {
      const document = store.getState().document
      const counters = new Map<string, number>()
      for (const mesh of meshRefs.current.values()) mesh.count = 0

      for (const key of EDITABLE_NAILS) {
        const mesh = parts.nails.get(key)
        const nail = document.nails[key]
        if (!mesh) continue
        for (const decoration of nail.decorations) {
          const target = meshRefs.current.get(decoration.catalogId)
          const entry = DECORATION_CATALOG.find((item) => item.id === decoration.catalogId)
          if (!target || !entry) continue

          const surface = projectUvToSurface(mesh, decoration.u, decoration.v)
          if (!surface) continue

          const bitangent = new Vector3().crossVectors(surface.normal, surface.tangent).normalize()
          const rotatedTangent = surface.tangent.clone()
            .multiplyScalar(Math.cos(decoration.rotation))
            .addScaledVector(bitangent, Math.sin(decoration.rotation))
          const rotatedBitangent = new Vector3().crossVectors(surface.normal, rotatedTangent).normalize()

          object.position.copy(surface.position)
          object.quaternion.setFromRotationMatrix(
            new Matrix4().makeBasis(rotatedTangent, surface.normal, rotatedBitangent),
          )
          const scale = decoration.scale * entry.defaultScale
          object.scale.setScalar(scale)
          object.updateMatrix()

          const instanceIndex = counters.get(decoration.catalogId) ?? 0
          if (instanceIndex < MAX_INSTANCES_PER_CATALOG_ENTRY) {
            target.setMatrixAt(instanceIndex, object.matrix)
            counters.set(decoration.catalogId, instanceIndex + 1)
          }
        }
      }

      for (const [catalogId, mesh] of meshRefs.current) {
        mesh.count = counters.get(catalogId) ?? 0
        mesh.instanceMatrix.needsUpdate = true
      }
    }

    rebuild()
    let previous = store.getState().document
    const unsubscribe = store.subscribe((state) => {
      if (state.document === previous) return
      previous = state.document
      rebuild()
    })
    return unsubscribe
  }, [parts, store])

  return (
    <>
      {meshes.map((mesh) => <primitive key={mesh.name} object={mesh} />)}
    </>
  )
}
```

Wire into `DesignScene.tsx`:

```typescript
// apps/web/src/3d/scene/DesignScene.tsx — full replacement
import { HandModel, type HandParts } from '@/3d/models/HandModel.tsx'
import { PaintController } from '@/3d/painting/PaintController.tsx'
import type { NailTextureSet } from '@/3d/painting/NailTextureSet.ts'
import { DecorationInstances } from '@/3d/decorations/DecorationInstances.tsx'
import { NailFocus } from './NailFocus.tsx'

interface Props {
  scale: number
  parts: HandParts | null
  textures: NailTextureSet | null
  onReady: (parts: HandParts) => void
}

export function DesignScene({ scale, parts, textures, onReady }: Props) {
  return (
    <>
      <HandModel scale={scale} onReady={onReady} />
      {parts && <NailFocus parts={parts} />}
      {parts && textures && <PaintController parts={parts} textures={textures} />}
      {parts && <DecorationInstances parts={parts} />}
    </>
  )
}
```

(`TransformController`, added in Task 9, will replace the unconditional `<PaintController>` line with a mode-gated choice — this task only adds the renderer, not the interaction switch, to keep the task's diff reviewable on its own.)

- [ ] **Step 2: Verify it compiles and the app still runs**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

Run: `npm run dev --workspace apps/web` (from repo root), open the editor in a browser, confirm the app loads without console errors (decorations are invisible at this point — count is 0 until Task 10 lets you add one — this step just confirms nothing crashes).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/decorations/DecorationInstances.tsx apps/web/src/3d/scene/DesignScene.tsx
git commit -m "feat: render decorations as per-catalog InstancedMesh"
```

---

### Task 9: `TransformController.tsx` — Select, Drag, Mode Gating

**Files:**
- Create: `apps/web/src/3d/interactions/TransformController.tsx`
- Modify: `apps/web/src/3d/scene/DesignScene.tsx`

**Interfaces:**
- Consumes: `pickNail`, `pointerToNdc`, `Hit` from `@/3d/painting/picking.ts` (existing); `nearestDecoration` from Task 5; `isPointInHull` from Task 2; `computeHull`, `Pt2` from Task 1; `useDesignStoreApi` (existing); `HandParts` (existing).
- Produces: `function TransformController({ parts }: { parts: HandParts }): null`. Mounted in `DesignScene` alongside (mode-gated against) `PaintController`.

This mirrors `PaintController.tsx`'s structure closely: a `useEffect` that adds/removes `pointerdown`/`pointermove`/`pointerup`/`pointercancel` listeners on `gl.domElement`, reading store state with `getState()` at event time (not `subscribe`), for the same reason `PaintController` does (`apps/web/src/3d/painting/PaintController.tsx:27-29` — subscribing would rebind listeners on every store change and could cut off an in-progress drag).

No automated test for this task (event-driven React Three Fiber component) — verified manually in Task 11. The per-nail hull cache and the drag math are the only non-trivial logic; both are exercised indirectly by Tasks 1, 2, and 5's own unit tests plus manual verification here.

- [ ] **Step 1: Write the implementation**

```typescript
// apps/web/src/3d/interactions/TransformController.tsx
import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import { Raycaster, Vector2 } from 'three'
import type { NailKey } from '@nail-studio/contracts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { pickNail, pointerToNdc, type Hit } from '@/3d/painting/picking.ts'
import { computeHull, type Pt2 } from '@/3d/geometry/hull.ts'
import { isPointInHull } from '@/3d/geometry/pointInHull.ts'
import { nearestDecoration } from '@/3d/decorations/decorationPicking.ts'

interface Props {
  parts: HandParts
}

/**
 * ต่อ pointer event เข้ากับการเลือก/ย้ายของตกแต่ง — ทำงานเฉพาะโหมด "ของตกแต่ง"
 *
 * เลือก: pointer-down หาเล็บที่โดนด้วย pipeline เดียวกับการวาด (pickNail) แล้วหาของ
 * ตกแต่งที่ใกล้จุด UV นั้นที่สุด (nearestDecoration) ถ้าเจอ = เริ่มลากทันทีในท่าเดียวกัน
 * ถ้าไม่เจอ = ยกเลิกการเลือกเดิม (คลิกพื้นที่ว่าง)
 *
 * ย้าย: pointer-move คำนวณ UV ใหม่จากเล็บเดิม ถ้าจุดใหม่หลุดนอกรูปเล็บ (isPointInHull
 * ปฏิเสธ) ค้างตำแหน่งเดิมไว้เฉย ๆ ไม่ commit ความเปลี่ยนแปลงของจุดนั้น — ผู้ใช้ลากกลับ
 * เข้ามาต่อได้ตามปกติในจังหวะถัดไป เหมือนที่ PaintController ทำกับเส้นวาดที่ลากออก
 * นอกเล็บ
 *
 * hull ของแต่ละเล็บคำนวณครั้งเดียวตอน parts พร้อม (A-01 เป็น preprocessing ที่ไม่ควร
 * รันซ้ำทุก pointermove) และไม่เปลี่ยนแม้ทรง/ความยาวเล็บจะเปลี่ยน เพราะ UV ไม่ได้ขยับ
 * ตาม morph target (มีแต่ position/normal ที่ขยับ — ดู nailMorph.ts)
 */
export function TransformController({ parts }: Props) {
  const store = useDesignStoreApi()
  const gl = useThree((state) => state.gl)
  const camera = useThree((state) => state.camera)
  const controls = useThree((state) => state.controls) as { enabled: boolean } | null
  const hullsRef = useRef<Map<NailKey, Pt2[]>>(new Map())

  useEffect(() => {
    const hulls = new Map<NailKey, Pt2[]>()
    for (const [key, mesh] of parts.nails) {
      const uv = mesh.geometry.getAttribute('uv')
      if (!uv) continue
      const points: Pt2[] = []
      for (let index = 0; index < uv.count; index += 1) {
        points.push({ x: uv.getX(index), y: uv.getY(index) })
      }
      hulls.set(key, computeHull(points))
    }
    hullsRef.current = hulls
  }, [parts])

  useEffect(() => {
    const canvas = gl.domElement
    const raycaster = new Raycaster()
    const ndc = new Vector2()
    const targets = [...parts.nails.values(), ...parts.occluders]

    let dragging: { key: NailKey; decorationId: string; mergeKey: string } | null = null

    const hit = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const screen = pointerToNdc(event.clientX, event.clientY, rect)
      ndc.set(screen.x, screen.y)
      raycaster.setFromCamera(ndc, camera)
      const hits: Hit[] = raycaster.intersectObjects(targets, false).map((intersection) => ({
        object: intersection.object,
        uv: intersection.uv,
      }))
      return pickNail(hits, parts.nailOf, 1)
    }

    const onDown = (event: PointerEvent) => {
      if (store.getState().mode !== 'decorate') return
      if (dragging) return
      const target = hit(event)
      if (!target) {
        store.getState().selectDecoration(null)
        return
      }
      const decorations = store.getState().document.nails[target.key].decorations
      const found = nearestDecoration(decorations, target.point.x, target.point.y)
      if (!found) {
        store.getState().selectDecoration(null)
        return
      }
      store.getState().selectDecoration({ key: target.key, decorationId: found.id })
      dragging = { key: target.key, decorationId: found.id, mergeKey: `decoration-drag-${Date.now()}` }
      if (controls) controls.enabled = false
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        // ไม่มี capture ก็ยังลากได้ เพียงแต่ลากออกนอกแคนวาสแล้วจะจบเอง
      }
    }

    const onMove = (event: PointerEvent) => {
      if (!dragging) return
      const target = hit(event)
      if (!target || target.key !== dragging.key) return
      const hull = hullsRef.current.get(dragging.key)
      if (hull && !isPointInHull(hull, { x: target.point.x, y: target.point.y })) return
      const decoration = store.getState().document.nails[dragging.key].decorations
        .find((item) => item.id === dragging!.decorationId)
      if (!decoration) return
      store.getState().moveDecoration(
        dragging.key, dragging.decorationId,
        target.point.x, target.point.y, decoration.rotation,
        dragging.mergeKey,
      )
    }

    const finish = (event: PointerEvent) => {
      dragging = null
      if (controls) controls.enabled = true
      if (canvas.hasPointerCapture(event.pointerId)) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // pointer อาจถูกปล่อยไปแล้วโดยเบราว์เซอร์
        }
      }
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', finish)
    canvas.addEventListener('pointercancel', finish)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', finish)
      canvas.removeEventListener('pointercancel', finish)
    }
  }, [gl, camera, controls, parts, store])

  return null
}
```

Wire into `DesignScene.tsx` with mode gating (replace the unconditional `<PaintController>` line from Task 8):

```typescript
// apps/web/src/3d/scene/DesignScene.tsx — full replacement
import { HandModel, type HandParts } from '@/3d/models/HandModel.tsx'
import { PaintController } from '@/3d/painting/PaintController.tsx'
import { TransformController } from '@/3d/interactions/TransformController.tsx'
import type { NailTextureSet } from '@/3d/painting/NailTextureSet.ts'
import { DecorationInstances } from '@/3d/decorations/DecorationInstances.tsx'
import { useDesign } from '@/features/design/DesignStoreProvider.tsx'
import { NailFocus } from './NailFocus.tsx'

interface Props {
  scale: number
  parts: HandParts | null
  textures: NailTextureSet | null
  onReady: (parts: HandParts) => void
}

export function DesignScene({ scale, parts, textures, onReady }: Props) {
  const mode = useDesign((state) => state.mode)
  return (
    <>
      <HandModel scale={scale} onReady={onReady} />
      {parts && <NailFocus parts={parts} />}
      {parts && textures && mode === 'paint' && <PaintController parts={parts} textures={textures} />}
      {parts && mode === 'decorate' && <TransformController parts={parts} />}
      {parts && <DecorationInstances parts={parts} />}
    </>
  )
}
```

Check `useDesign` is exported from `DesignStoreProvider.tsx` (it's already imported this way elsewhere, e.g. `PaintToolbar.tsx:3`) — no change needed there.

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/3d/interactions/TransformController.tsx apps/web/src/3d/scene/DesignScene.tsx
git commit -m "feat: add TransformController for selecting and dragging decorations"
```

---

### Task 10: `DecorationPanel.tsx` — Catalog, Rotate/Scale, Delete, Mode Toggle

**Files:**
- Create: `apps/web/src/features/design/DecorationPanel.tsx`
- Modify: `apps/web/src/features/design/PaintToolbar.tsx` (add the mode toggle at the top)
- Modify: `apps/web/src/features/design/NailEditor.tsx` (mount `DecorationPanel` alongside `PaintToolbar`)

**Interfaces:**
- Consumes: `DECORATION_CATALOG`, `catalogEntry` (Task 4); `useDesign` (existing, `apps/web/src/features/design/DesignStoreProvider.tsx`); `primaryOf` (existing, `apps/web/src/features/design/designStore.ts:90`).
- Produces: `function DecorationPanel(): JSX.Element`. Terminal UI task — nothing downstream depends on this.

No automated test (React component, no DOM-testing infra) — verified manually in Task 11.

- [ ] **Step 1: Write the implementation**

```typescript
// apps/web/src/features/design/DecorationPanel.tsx
import { DECORATION_CATALOG } from '@/3d/decorations/decorationCatalog.ts'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'

/**
 * แผงของตกแต่ง — เลือกจาก catalog มาวางกลางเล็บที่เลือกอยู่ (D-30) และปรับ
 * หมุน/ย่อขยาย/ลบของตกแต่งที่กำลังเลือกอยู่ผ่านตัวเลข ไม่มี 3D gizmo (D-29)
 *
 * แสดงเฉพาะตอนอยู่โหมด "ของตกแต่ง" — สลับโหมดทำที่ปุ่มใน PaintToolbar
 */
export function DecorationPanel() {
  const mode = useDesign((state) => state.mode)
  const selection = useDesign((state) => state.selection)
  const selectedDecoration = useDesign((state) => state.selectedDecoration)
  const addDecoration = useDesign((state) => state.addDecoration)
  const removeDecoration = useDesign((state) => state.removeDecoration)
  const moveDecoration = useDesign((state) => state.moveDecoration)
  const scaleDecoration = useDesign((state) => state.scaleDecoration)
  const nail = useDesign((state) => state.document.nails[primaryOf(state.selection)])

  if (mode !== 'decorate') return null

  const activeKey = primaryOf(selection)
  const selected = selectedDecoration && selectedDecoration.key === activeKey
    ? nail.decorations.find((decoration) => decoration.id === selectedDecoration.decorationId) ?? null
    : null

  const handleAdd = (catalogId: string) => {
    addDecoration(activeKey, {
      id: `deco-${crypto.randomUUID()}`,
      catalogId,
      u: 0.5,
      v: 0.5,
      rotation: 0,
      scale: 1,
    })
  }

  return (
    <aside className="toolbar" aria-label="ของตกแต่ง">
      <div className="field">
        เพิ่มของตกแต่ง
        <div className="swatches">
          {DECORATION_CATALOG.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="chip"
              onClick={() => handleAdd(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <>
          <label className="field">
            หมุน {Math.round((selected.rotation * 180) / Math.PI)}°
            <input
              type="range" min={0} max={360} step={1}
              value={Math.round((selected.rotation * 180) / Math.PI)}
              onChange={(event) => {
                const degrees = Number(event.target.value)
                moveDecoration(activeKey, selected.id, selected.u, selected.v, (degrees * Math.PI) / 180)
              }}
            />
          </label>

          <label className="field">
            ขนาด {Math.round(selected.scale * 100)}%
            <input
              type="range" min={10} max={100} step={1}
              value={Math.round(selected.scale * 100)}
              onChange={(event) => scaleDecoration(activeKey, selected.id, Number(event.target.value) / 100)}
            />
          </label>

          <button
            type="button"
            className="btn btn-ghost btn-danger"
            onClick={() => removeDecoration(activeKey, selected.id)}
          >
            ลบ
          </button>
        </>
      )}
    </aside>
  )
}
```

In `PaintToolbar.tsx`, add the mode toggle. Add these two lines to the existing `useDesign` calls at the top of the component (after the `settings`/`setSettings` lines):

```typescript
  const mode = useDesign((state) => state.mode)
  const setMode = useDesign((state) => state.setMode)
```

And add this block as the very first child inside the `<aside className="toolbar" ...>` element, before the existing `<div className="tool-group" ...>` for brush/eraser:

```typescript
      <div className="tool-group" role="group" aria-label="โหมด">
        <button
          type="button"
          className={`chip ${mode === 'paint' ? 'chip-on' : ''}`}
          aria-pressed={mode === 'paint'}
          onClick={() => setMode('paint')}
        >
          วาด
        </button>
        <button
          type="button"
          className={`chip ${mode === 'decorate' ? 'chip-on' : ''}`}
          aria-pressed={mode === 'decorate'}
          onClick={() => setMode('decorate')}
        >
          ของตกแต่ง
        </button>
      </div>
```

In `NailEditor.tsx`, add the import:

```typescript
import { DecorationPanel } from './DecorationPanel.tsx'
```

And mount it right after `<PaintToolbar />` inside `<div className="editor-body">`:

```typescript
        <PaintToolbar />
        <DecorationPanel />
```

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/design/DecorationPanel.tsx apps/web/src/features/design/PaintToolbar.tsx apps/web/src/features/design/NailEditor.tsx
git commit -m "feat: add decoration catalog panel, rotate/scale/delete controls, and mode toggle"
```

---

### Task 11: Manual Browser Verification + Close Out Docs

No automated tests — this is the last task that proves every separately-tested piece (Tasks 1-10) works together in the real running app, mirroring how the prior nail-model-pipeline plan's Task 12 closed out Slice 4 item 4.

**Files:**
- Modify: `docs/architecture.md` — add DECISION D-31 summarizing this work (following the same format as D-27, D-25, D-26)
- Modify: `docs/implementation-plan.md` — mark Slice 4 items 1-3 done

- [ ] **Step 1: Start the dev server and API**

```bash
npm run dev --workspace apps/web
npm run dev:api
```

- [ ] **Step 2: Walk through the spec's DoD (§11 of `docs/superpowers/specs/2026-08-15-nail-decoration-design.md`) in the browser**

Log in, open a project, and check each item:
- Click a catalog entry ("เพชร"/"โบว์"/"ดาว") in decorate mode → the shape appears at the center of the currently selected nail.
- Drag the decoration with the mouse → it follows the cursor and stays clamped to the nail surface (does not fly off into space or freeze at the wrong spot); dragging past the edge of the nail stops updating position rather than crashing or jumping.
- Adjust the rotate/scale sliders → the decoration visibly rotates/resizes in the 3D view.
- Click "ลบ" → the decoration disappears.
- Ctrl+Z / Ctrl+Y after each of the above (add, move, rotate, scale, delete) → undo/redo restores the exact prior state.
- Switch shape (`stiletto`) or length (`extra`) on a nail that has a decoration on it (Slice 4 item 4's UI, already shipped) → the decoration stays visually attached to the surface, does not float above or sink into the nail (proves D-10 end-to-end, the spec's explicit final DoD item).
- Toggle between "วาด"/"ของตกแต่ง" modes → painting works normally in paint mode and does not also drag decorations; decorate mode does not also paint.
- Check the browser console for errors during all of the above.

- [ ] **Step 3: Fix anything broken found in Step 2**

If a bug surfaces, fix it directly in this task (this is the integration-proving step; do not defer integration bugs to a "later cleanup"). Re-run the relevant unit tests from Tasks 1-7 after any fix to geometry/command code, and repeat the relevant part of Step 2.

- [ ] **Step 4: Add DECISION D-31 to `docs/architecture.md`**

Follow the exact structure of DECISION D-27 (search for `### DECISION D-27` in the file) — add a new table row `| D-31 | ... |` to the decision table (§8, after the D-27 row) and a new `### DECISION D-31 — ...` section (placed right after the table's closing `---`, before `### DECISION D-27`, matching the file's newest-first ordering). Content to include, based on what actually shipped:
- What: decoration placement stored as UV (D-10) reprojected every render via `projectUvToSurface` (A-11); one `InstancedMesh` per catalog entry; selection via UV-nearest-neighbor instead of instance raycasting (cite the reasoning from `decorationPicking.ts`'s docstring, Task 5); rotate/scale via numeric panel only, no 3D gizmo (D-29 from the spec).
- Why: cite D-28/D-29/D-30 from the spec directly.
- Known limitation: placeholder geometry only (no real 3D assets — Slice 5); no drag-and-drop from catalog (D-30); no BVH-accelerated hit-testing for decorations (128-512 tri nail meshes, same reasoning as D-06).

- [ ] **Step 5: Update `docs/implementation-plan.md` Slice 4 items 1-3**

Find the `### Slice 4` section (search for `ของตกแต่ง + ทรงเล็บ + สัดส่วนมือ`). Mark items 1 (`geometry/surfaceProjection.ts (A-11) + pointInHull.ts (A-21)`), 2 (`NailDecoration + DecorationInstances`), and 3 (`TransformController`) as `[x]`, and add a short note under item 1 (matching the style used for item 4's note, added by the prior plan) recording: placeholder catalog used pending Slice 5 assets, UV-nearest-neighbor selection instead of instance raycasting, no 3D gizmo.

- [ ] **Step 6: Run the full verification suite**

```bash
npm run typecheck
npm run -s lint
npm run test
```

Expected: `typecheck` and `test` pass cleanly. `lint` is expected to exit 1 with npm's "missing script" error — this is the same pre-existing repo-wide gap documented in the prior plan's Task 11/12 (no ESLint configured anywhere in the repo); do not attempt to fix it here, it is out of scope for this plan.

- [ ] **Step 7: Commit**

```bash
git add docs/architecture.md docs/implementation-plan.md
git commit -m "docs: close out the nail decoration system (Slice 4 part B)"
```

---

## Self-Review Notes

- **Spec coverage**: §2 (D-28/D-29/D-30) → Tasks 9, 10. §3 (catalog) → Task 4. §4 (geometry, including the mid-writing A-01 discovery) → Tasks 1-3. §5 (rendering) → Task 8. §6 (interaction) → Tasks 9-10. §7 (commands) → Task 6, wired in Task 7. §8 (testing) → every task's own Step 1-4, with the DOM-testing gap explicitly carried into Tasks 8-10's task text. §11 (DoD) → Task 11 Step 2 walks every bullet.
- **Type consistency checked**: `Decoration` fields (`u`, `v`, `rotation`, `scale`, `catalogId`, `id`) used identically across Tasks 4, 6, 7, 9, 10. `MoveDecorationCommand`'s `{u, v, rotation}` triple matches between Task 6's class and Task 7's `moveDecoration` store action and Task 9's `TransformController` call site. `SurfacePoint { position, normal, tangent }` from Task 3 matches Task 8's destructuring. `CatalogEntry { id, label, geometry, defaultScale }` matches between Task 4's definition and Tasks 8/10's usage.
- **No placeholders**: every task has complete code, not descriptions of code — checked against the "No Placeholders" list before finalizing.
