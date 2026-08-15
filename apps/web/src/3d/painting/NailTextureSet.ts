import type { DesignDocument, Layer, NailKey } from '@nail-studio/contracts'
import type { Dab } from './brush.ts'
import { TEX_SIZE } from './constants.ts'
import { compositeLayers, type LayerSource } from './layers.ts'
import { drawDabs, renderLayer, renderStroke, type Ctx2D } from './rasterizer.ts'

export interface Surface {
  canvas: CanvasImageSource
  ctx: Ctx2D
}

export type CanvasFactory = (size: number) => Surface

/**
 * เพดานจำนวนแคนวาสเลเยอร์ที่ยอมให้ค้างไว้พร้อมกัน (ทบทวนตาม R-5)
 *
 * บัญชีหน่วยความจำที่แย่ที่สุด เมื่อ TEX_SIZE = 1024 (4.2 MB ต่อใบ):
 *   composite ของเล็บที่มองเห็น 5 ใบ + เลเยอร์ 12 ใบ + wet/scratch 2 ใบ = 19 ใบ ≈ 80 MB
 *
 * ทำไม 12: มือหนึ่งข้างมี 5 นิ้ว งาน Slice 2 มีเลเยอร์ละนิ้ว จึงใช้จริง 5 ใบ
 * เหลือที่ว่างให้ Slice 3 ที่เปิดหลายเลเยอร์ต่อนิ้วได้ราวสองนิ้วเต็มเพดาน
 * โดยยังไม่ทะลุงบหน่วยความจำที่ตั้งไว้
 *
 * ค่านี้ไม่ใช่การจูนที่วัดแล้ว แต่เป็นเพดานความปลอดภัย — ถ้าวันหนึ่งพบว่าการ evict
 * ทำให้สลับนิ้วสะดุด ต้องวัดก่อนแล้วค่อยขยับ ไม่ใช่เดาเพิ่ม
 */
const MAX_LAYER_SURFACES = 12

/** สีพื้นเล็บที่ยังไม่ได้ลงสี ทำให้ composite ทึบพอที่จะส่งเข้าเท็กซ์เจอร์ตรง ๆ */
export const NAIL_BASE_COLOR = '#ffffff'

export type RebuildScheduler = (task: () => void) => void

/**
 * เบราว์เซอร์ยิง pointermove ได้ถี่กว่าเฟรม การ rebuild ทุกครั้งคือการทำงานระดับ
 * 1024² หลายรอบทิ้ง จึงรวบให้เหลือรอบเดียวต่อเฟรม ส่วนใน Node (เทส) ไม่มี rAF
 * ก็ทำทันทีเพื่อให้ยังเขียนเทสแบบซิงโครนัสได้
 */
const defaultScheduler: RebuildScheduler = (task) => {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => task())
  else task()
}

interface LayerCache extends Surface {
  /** จำนวนเส้นที่วาดลงแคนวาสใบนี้ไปแล้ว */
  count: number
  /** เส้นสุดท้ายที่วาดไปแล้ว ใช้เช็คว่าอาร์เรย์ชุดใหม่เป็นการ "ต่อท้าย" ของเดิมหรือไม่ */
  last: Layer['strokes'][number] | null
}

export interface NailTextureSetOptions {
  factory: CanvasFactory
  /** อ่านเอกสารงานล่าสุดตอนต้องวาด — ชั้นนี้จึงไม่ต้องรู้จัก store ที่ใช้ */
  read: () => DesignDocument
  size?: number
  schedule?: RebuildScheduler
}

/**
 * ผลิตเท็กซ์เจอร์ของเล็บแต่ละนิ้วจากเอกสารงาน แล้วอัปเดตเฉพาะส่วนที่เปลี่ยน
 *
 * เหตุผลที่ต้องมีชั้นนี้แทนการวาดใหม่ทั้งหมดทุกครั้ง: การ replay เส้นทั้งเลเยอร์
 * เป็นงานระดับหลายพันแต้มบนแคนวาส 1024² ซึ่งทำทุกเฟรมไม่ไหว ชั้นนี้จึงเก็บ
 * ผลของเลเยอร์ที่วาดไปแล้วไว้ แล้ววาดเพิ่มเฉพาะเส้นใหม่ที่ต่อท้ายเข้ามา
 */
export class NailTextureSet {
  private readonly factory: CanvasFactory
  private readonly read: () => DesignDocument
  private readonly size: number
  private readonly schedule: RebuildScheduler

  private composites = new Map<NailKey, Surface>()
  /** คีย์เป็น `${nailKey}:${layerId}` — layer id ซ้ำข้ามเล็บได้หลังสั่ง "ใช้กับทุกนิ้ว" */
  private layerCache = new Map<string, LayerCache>()
  private nailTouch = new Map<NailKey, number>()
  private clock = 0
  private visible: NailKey[] = []

  private wet: Surface
  private scratch: Surface
  /** เล็บที่เส้นสด ๆ กำลังถูกวาดลงไป — วาดครั้งเดียวเห็นพร้อมกันทุกนิ้วที่เลือกไว้ */
  private wetTargets = new Set<NailKey>()
  /**
   * ใครเป็นเจ้าของเส้นที่กำลังลากอยู่ ('3d' หรือ '2d')
   *
   * ทั้งสองโหมดวาดลงแคนวาส wet ใบเดียวกัน ถ้าไม่แยกเจ้าของ การปล่อยนิ้วในโหมดหนึ่ง
   * จะไปล้างเส้นที่อีกโหมดกำลังลากค้างอยู่ทิ้ง
   */
  private owner: string | null = null
  private wetErase = false
  /** ดัชนีเลเยอร์ที่เส้นสดกำลังถูกวาดลงไป */
  private wetLayers = new Map<NailKey, number>()
  private wetDirty = false
  private rebuildScheduled = false
  private scheduleGeneration = 0
  private painting = false
  private updateListeners = new Set<(key: NailKey) => void>()
  private disposed = false

  constructor(options: NailTextureSetOptions) {
    this.factory = options.factory
    this.read = options.read
    this.size = options.size ?? TEX_SIZE
    this.schedule = options.schedule ?? defaultScheduler
    this.wet = this.factory(this.size)
    this.scratch = this.factory(this.size)
  }

  /**
   * กำหนดว่าเล็บนิ้วไหนกำลังถูกแสดงอยู่จริง
   *
   * เก็บแคนวาสไว้เฉพาะนิ้วที่มองเห็น เพราะเท็กซ์เจอร์ของมือที่ไม่ได้แสดงไม่มีใครอ่าน
   * การถือไว้ทั้งสิบนิ้วคือการจอง 42 MB ไว้เฉย ๆ ครึ่งหนึ่งของนั้นไม่มีวันถูกใช้
   */
  setVisibleNails(keys: NailKey[]): void {
    const next = new Set(keys)
    for (const key of [...this.composites.keys()]) {
      if (next.has(key)) continue
      this.composites.delete(key)
      this.dropLayerCache(key)
      this.nailTouch.delete(key)
    }
    this.visible = [...next]
    for (const key of this.visible) {
      // surfaceOf สร้างแคนวาสแล้ว rebuild ให้เองสำหรับนิ้วที่เพิ่งเข้ามาใหม่
      if (this.composites.has(key)) this.rebuild(key)
      else this.surfaceOf(key)
    }
  }

  composite(key: NailKey): CanvasImageSource {
    return this.surfaceOf(key).canvas
  }

  isPainting(): boolean {
    return this.painting
  }

  /**
   * เริ่มเส้นใหม่ คืน false ถ้ามีเส้นค้างอยู่
   *
   * ห้ามเริ่มเส้นซ้อนกัน ไม่งั้นแคนวาส wet ใบเดียวจะถือเส้นของสองเหตุการณ์ปนกัน
   * แล้วการปล่อยนิ้วครั้งแรกจะลบเส้นที่สองทิ้งไปด้วย
   */
  beginStroke(
    targets: Iterable<NailKey>,
    layerIndexes: ReadonlyMap<NailKey, number>,
    erase: boolean,
    owner = 'default',
  ): boolean {
    if (this.painting) return false
    this.rebuildScheduled = false
    this.painting = true
    this.owner = owner
    this.wetErase = erase
    this.wetTargets = new Set(targets)
    this.wetLayers = new Map(
      [...this.wetTargets]
        .map((key) => [key, layerIndexes.get(key)] as const)
        .filter((entry): entry is readonly [NailKey, number] => entry[1] !== undefined),
    )
    this.clearWet()
    return true
  }

  paintDabs(dabs: Dab[], color: string, softness: number): void {
    if (!this.painting || dabs.length === 0) return
    // Rasterize dabs immediately so the 3D preview follows the pointer.
    // Keep the expensive layer composite batched to one callback per frame.
    drawDabs(this.wet.ctx, dabs, color, softness)
    this.wetDirty = true
    if (this.rebuildScheduled) return
    this.rebuildScheduled = true
    const generation = ++this.scheduleGeneration
    this.schedule(() => {
      if (!this.rebuildScheduled || this.disposed || generation !== this.scheduleGeneration) return
      this.rebuildScheduled = false
      this.rebuildWetTargets()
    })
  }

  /** เจ้าของเส้นที่กำลังลากอยู่ — ใช้ให้ผู้เรียกรู้ว่าเส้นที่ค้างอยู่เป็นของตัวเองหรือไม่ */
  strokeOwner(): string | null {
    return this.owner
  }

  /**
   * จบเส้น ไม่ว่าจะเพราะปล่อยนิ้วหรือถูกยกเลิก
   *
   * ต้องเรียกทั้งสองกรณีเสมอ (TD-5) ถ้าเรียกเฉพาะตอนสำเร็จ แคนวาส wet จะค้าง
   * เส้นที่ถูกยกเลิกไว้ แล้วเส้นถัดไปจะวาดทับของเก่า — ซอร์สเดิมกลบอาการนี้ด้วยการ
   * ตรวจสถานะซ้ำทุกเฟรม ซึ่งเป็นการจ่ายค่างานตลอดเวลาเพื่อแก้เหตุการณ์ที่นาน ๆ ครั้ง
   */
  endStroke(owner?: string): void {
    if (!this.painting) return
    // ปล่อยให้ปิดได้เฉพาะเจ้าของเส้น ไม่งั้นโหมดหนึ่งจะไปตัดเส้นที่อีกโหมดกำลังลากอยู่
    if (owner !== undefined && this.owner !== owner) return
    this.scheduleGeneration += 1
    this.painting = false
    this.owner = null
    this.rebuildScheduled = false
    const targets = [...this.wetTargets]
    this.wetTargets.clear()
    this.wetLayers.clear()
    this.clearWet()
    for (const key of targets) this.rebuild(key)
  }

  rebuild(key: NailKey): void {
    if (this.disposed) return
    const nail = this.read().nails[key]
    const target = this.composites.get(key)
    if (!target) return
    const sources: LayerSource[] = []
    for (const [index, layer] of nail.layers.entries()) {
      // เลเยอร์ที่ซ่อนหรือความทึบศูนย์ถูก compositeLayers ทิ้งอยู่แล้ว
      // การ renderLayer ให้มันคือการ replay เส้นทิ้งเปล่า ๆ
      if (!layer.visible || layer.opacity <= 0) continue
      const surface = this.layerSurface(key, layer)
      const isWetLayer = this.wetDirty && index === this.wetLayers.get(key) && this.wetTargets.has(key)
      if (isWetLayer) {
        this.scratch.ctx.clearRect(0, 0, this.size, this.size)
        if (surface) this.scratch.ctx.drawImage(surface.canvas, 0, 0, this.size, this.size)
        this.scratch.ctx.save()
        this.scratch.ctx.globalCompositeOperation = this.wetErase ? 'destination-out' : 'source-over'
        this.scratch.ctx.drawImage(this.wet.canvas, 0, 0, this.size, this.size)
        this.scratch.ctx.restore()
        sources.push({ layer, canvas: this.scratch.canvas })
      } else if (surface) {
        sources.push({ layer, canvas: surface.canvas })
      }
    }
    this.nailTouch.set(key, (this.clock += 1))
    this.dropDeadLayers(key, nail.layers)
    this.evictColdSurfaces()
    compositeLayers(target.ctx, sources, this.size, nail.baseColor || NAIL_BASE_COLOR)
    for (const listener of this.updateListeners) listener(key)
  }

  onUpdate(callback: (key: NailKey) => void): () => void {
    this.updateListeners.add(callback)
    return () => this.updateListeners.delete(callback)
  }

  dispose(): void {
    this.disposed = true
    this.updateListeners.clear()
    // ไม่ล้างทันที: effect เก่าของ React อาจยังวาดเฟรมสุดท้ายระหว่าง cleanup
    // แต่ปล่อยค้างไว้ก็ไม่ได้ เพราะ Map ถือแคนวาสรวมกันหลายสิบ MB
    queueMicrotask(() => {
      this.layerCache.clear()
      this.composites.clear()
      this.nailTouch.clear()
    })
  }

  private rebuildWetTargets(): void {
    for (const key of this.wetTargets) this.rebuild(key)
  }

  private surfaceOf(key: NailKey): Surface {
    let surface = this.composites.get(key)
    if (!surface) {
      surface = this.factory(this.size)
      this.composites.set(key, surface)
      this.rebuild(key)
    }
    return surface
  }

  /**
   * แคนวาสของเลเยอร์หนึ่งชั้น — วาดเฉพาะเส้นที่เพิ่มเข้ามาใหม่เมื่อทำได้
   *
   * เอกสารงานถูกแก้แบบสร้างใหม่เสมอ อาร์เรย์เส้นจึงเป็นคนละก้อนทุกครั้งที่วาด
   * การเทียบ identity ของอาร์เรย์จึงใช้ไม่ได้ ต้องเทียบว่า "เส้นสุดท้ายที่วาดไปแล้ว
   * ยังอยู่ตำแหน่งเดิม" ซึ่งพอเพียงที่จะรู้ว่าเป็นการต่อท้าย และเป็นการเทียบเวลาคงที่
   */
  private layerSurface(nailKey: NailKey, layer: Layer): Surface | null {
    if (layer.strokes.length === 0) return null
    const key = `${nailKey}:${layer.id}`
    let entry = this.layerCache.get(key)
    if (!entry) {
      const created = this.factory(this.size)
      entry = { canvas: created.canvas, ctx: created.ctx, count: 0, last: null }
      this.layerCache.set(key, entry)
    }
    const appended = entry.count > 0
      && entry.count <= layer.strokes.length
      && layer.strokes[entry.count - 1] === entry.last
    if (appended) {
      for (let index = entry.count; index < layer.strokes.length; index += 1) {
        const stroke = layer.strokes[index]
        if (stroke) renderStroke(entry.ctx, stroke, this.size)
      }
    } else {
      renderLayer(entry.ctx, layer, this.size)
    }
    entry.count = layer.strokes.length
    entry.last = layer.strokes[layer.strokes.length - 1] ?? null
    return entry
  }

  /**
   * ทิ้งแคชของเลเยอร์ที่ไม่มีอยู่ในเล็บนี้แล้ว
   *
   * layer id ถูกสร้างใหม่ทุกครั้งที่เพิ่มเลเยอร์ ถ้าไม่เก็บกวาดตรงนี้ การเพิ่มแล้วลบ
   * เลเยอร์ซ้ำ ๆ บนเล็บที่ใช้งานอยู่จะทิ้งแคนวาส 4 MB ค้างไว้รอบละใบ โดย
   * evictColdSurfaces ไล่เก็บไม่ได้เพราะมันข้ามเล็บที่เพิ่งถูกแตะเสมอ
   */
  private dropDeadLayers(key: NailKey, layers: Layer[]): void {
    const alive = new Set(layers.map((layer) => `${key}:${layer.id}`))
    for (const cacheKey of this.layerCache.keys()) {
      if (cacheKey.startsWith(`${key}:`) && !alive.has(cacheKey)) this.layerCache.delete(cacheKey)
    }
  }

  private dropLayerCache(key: NailKey): void {
    for (const cacheKey of [...this.layerCache.keys()]) {
      if (cacheKey.startsWith(`${key}:`)) this.layerCache.delete(cacheKey)
    }
  }

  private evictColdSurfaces(): void {
    if (this.layerCache.size <= MAX_LAYER_SURFACES) return
    const coldestFirst = [...this.nailTouch.entries()].sort((a, b) => a[1] - b[1])
    for (const [key] of coldestFirst) {
      if (this.layerCache.size <= MAX_LAYER_SURFACES) break
      if (this.wetTargets.has(key)) continue
      this.dropLayerCache(key)
    }
  }

  private clearWet(): void {
    this.wet.ctx.clearRect(0, 0, this.size, this.size)
    this.wetDirty = false
  }
}
