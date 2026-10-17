import { createCanvas, loadImage } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { createEmptyDocument, type DesignDocument, type NailKey } from '@nail-studio/contracts'
import { buildFromRecipe, PRESETS } from '@nail-studio/patterns'
import { textureToPanel } from '../../web/src/3d/painting/flatTriangles.ts'
import { flatNailFor } from './nailShape.ts'
import { cachedNailTexture, MAX_ZOOMED_NAILS, renderNailTexture, renderPreviewPng } from './render.ts'
import { toSceneColor } from './sceneColor.ts'

/** โซน nail: ช่อง 512 × 560 แผง 512 วางที่ (0, 6) */
const PANEL = 512
const PANEL_Y = 6
const BACKGROUND = [0xf4, 0xef, 0xec]

async function pixels(png: Buffer): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const image = await loadImage(png)
  const canvas = createCanvas(image.width, image.height)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(image, 0, 0)
  return { data: ctx.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height }
}

const hexRgb = (hex: string): number[] => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function withNail(key: NailKey, patch: Partial<DesignDocument['nails'][NailKey]>): DesignDocument {
  const document = createEmptyDocument()
  document.nails[key] = { ...document.nails[key], ...patch }
  return document
}

/** preset ที่ stroke เยอะที่สุด — ใช้วัดขนาดภาพ/เวลาในกรณีแย่สุด */
function densestPreset(): DesignDocument {
  let best: DesignDocument | null = null
  let most = -1
  for (const preset of Object.values(PRESETS)) {
    const document = buildFromRecipe(preset.recipe).document
    const strokes = Object.values(document.nails).reduce((sum, nail) => sum + nail.layers.reduce((s, l) => s + l.strokes.length, 0), 0)
    if (strokes > most) { most = strokes; best = document }
  }
  return best!
}

describe('toSceneColor', () => {
  it('ตรงกับสูตร ACES ของ three.js ที่ SCENE_LIGHT_GAIN และสีดำยังดำ', () => {
    const got = hexRgb(toSceneColor('#dfaaa2'))
    // คำนวณอิสระด้วยสูตร ACESFilmic ของ three.js ที่ gain 0.8
    const want = hexRgb('#cfaba4')
    got.forEach((c, i) => expect(Math.abs(c - want[i]!)).toBeLessThanOrEqual(2))
    expect(toSceneColor('#000000')).toBe('#000000')
  })
})

describe('renderPreviewPng', () => {
  it('นอกเล็บเป็นสีพื้นหลัง กลางเล็บเป็นสีตามฉาก และ flat ได้สีตรงตัว', async () => {
    const base = '#dfaaa2'
    const document = withNail('right.index', { baseColor: base, finish: 'matte' })
    const view = flatNailFor('index', 'round', 'medium', PANEL, 1024)
    const cx = Math.round(view.bounds.x + view.bounds.width / 2)
    const cy = Math.round(view.bounds.y + view.bounds.height / 2) + PANEL_Y

    for (const [lighting, expected] of [['scene', toSceneColor(base)], ['flat', base]] as const) {
      const { data, width } = await pixels(renderPreviewPng(document, { only: ['right.index'], zoom: 'nail', lighting }))
      expect(width).toBe(PANEL)
      const at = (x: number, y: number): number[] => [...data.slice((y * width + x) * 4, (y * width + x) * 4 + 3)]
      expect(at(2, 2)).toEqual(BACKGROUND)
      expect(at(width - 3, PANEL_Y + 2)).toEqual(BACKGROUND)
      const tolerance = lighting === 'scene' ? 12 : 1
      const want = hexRgb(expected)
      at(cx, cy).forEach((c, i) => expect(Math.abs(c - want[i]!), `${lighting} ช่อง ${i}`).toBeLessThanOrEqual(tolerance))
    }
  })

  it('ทรงเล็บต่างกันได้รูปต่างกัน (stiletto/extra กับ round/medium)', async () => {
    const coverage = async (shape: 'round' | 'stiletto', length: 'medium' | 'extra'): Promise<number> => {
      const { data, width } = await pixels(renderPreviewPng(withNail('right.index', { shape, length, baseColor: '#202020' }), {
        only: ['right.index'], zoom: 'nail', lighting: 'flat',
      }))
      let count = 0
      for (let y = PANEL_Y; y < PANEL_Y + PANEL; y++) {
        for (let x = 0; x < width; x++) if (data[(y * width + x) * 4]! < 100) count++
      }
      return count
    }
    const round = await coverage('round', 'medium')
    const stiletto = await coverage('stiletto', 'extra')
    expect(Math.abs(round - stiletto) / round).toBeGreaterThan(0.1)
  })

  it('มือซ้ายเป็นภาพกระจกของมือขวา (เอกสารที่ mirror แล้ว)', async () => {
    const recipe = {
      mirrorLeft: true,
      nails: { index: { base: '#f0e0d0', patterns: [{ type: 'heart' as const, color: '#c02040', u: 0.35, v: 0.45, size: 0.18 }] } },
    }
    const document = buildFromRecipe(recipe).document
    const right = await pixels(renderPreviewPng(document, { only: ['right.index'], zoom: 'nail', lighting: 'flat' }))
    const left = await pixels(renderPreviewPng(document, { only: ['left.index'], zoom: 'nail', lighting: 'flat' }))
    let different = 0
    let total = 0
    for (let y = PANEL_Y; y < PANEL_Y + PANEL; y++) {
      for (let x = 0; x < PANEL; x++) {
        const a = (y * PANEL + x) * 4
        const b = (y * PANEL + (PANEL - 1 - x)) * 4
        total++
        for (let k = 0; k < 3; k++) {
          if (Math.abs(right.data[a + k]! - left.data[b + k]!) > 2) { different++; break }
        }
      }
    }
    // ขอบ anti-alias ของ clip ต่างกันได้เล็กน้อย
    expect(different / total).toBeLessThan(0.01)
  })

  it('ของตกแต่งอยู่ตรงตำแหน่ง UV บนรูปเล็บ', async () => {
    const document = withNail('right.index', {
      baseColor: '#000000',
      decorations: [{ id: 'd1', catalogId: 'pearl-single', u: 0.5, v: 0.5, rotation: 0, scale: 0.5, color: '#ffffff' }],
    })
    const { data, width } = await pixels(renderPreviewPng(document, { only: ['right.index'], zoom: 'nail', lighting: 'flat' }))
    let sx = 0
    let sy = 0
    let count = 0
    for (let y = PANEL_Y; y < PANEL_Y + PANEL; y++) {
      for (let x = 0; x < width; x++) {
        const o = (y * width + x) * 4
        // พื้นหลัง #f4efec สว่างแต่ไม่ขาว — นับเฉพาะพิกเซลบนเล็บดำที่ sprite ทำให้สว่าง
        if (data[o]! > 60 && data[o]! !== BACKGROUND[0]) { sx += x; sy += y; count++ }
      }
    }
    expect(count).toBeGreaterThan(20)
    const at = textureToPanel(flatNailFor('index', 'round', 'medium', PANEL, 1024), 0.5, 0.5)!
    expect(Math.abs(sx / count - at.x)).toBeLessThanOrEqual(2)
    expect(Math.abs(sy / count - (at.y + PANEL_Y))).toBeLessThanOrEqual(2)
  })

  it('แคช texture: เล็บเดิมได้ canvas เดิม เล็บที่เปลี่ยนวาดใหม่', () => {
    const nail = withNail('right.index', { baseColor: '#123456' }).nails['right.index']
    const first = renderNailTexture(nail, 512)
    expect(renderNailTexture(structuredClone(nail), 512)).toBe(first)
    expect(cachedNailTexture(nail)).toBe(first)
    expect(renderNailTexture({ ...nail, baseColor: '#654321' }, 512)).not.toBe(first)
    expect(cachedNailTexture({ ...nail, baseColor: '#abcdef' })).toBeUndefined()
  })

  it('zoom nail เกินเพดานถูกปฏิเสธ', () => {
    const only: NailKey[] = ['right.thumb', 'right.index', 'right.middle', 'right.ring']
    expect(only.length).toBeGreaterThan(MAX_ZOOMED_NAILS)
    expect(() => renderPreviewPng(createEmptyDocument(), { only, zoom: 'nail' })).toThrow(/ไม่เกิน 3 นิ้ว/)
  })

  it('ขนาดภาพและเวลาที่เพิ่มจาก preview อยู่ในเพดาน (preset ที่หนาแน่นที่สุด)', () => {
    const document = densestPreset()
    // เวลาส่วนใหญ่คือ rasterizer ของ editor (มีอยู่เดิม) — วัดเฉพาะส่วนที่ preview เพิ่ม
    const textureStart = performance.now()
    for (const nail of Object.values(document.nails)) renderNailTexture(nail, 512)
    const textureTime = performance.now() - textureStart
    const started = performance.now()
    const hand = renderPreviewPng(document, { scope: 'both' })
    const elapsed = performance.now() - started - textureTime
    const nails = renderPreviewPng(document, { only: ['right.index', 'right.middle', 'right.ring'], zoom: 'nail' })
    const base64 = (png: Buffer): number => Math.ceil(png.length / 3) * 4
    expect(base64(hand)).toBeLessThanOrEqual(1024 * 1024)
    expect(base64(nails)).toBeLessThanOrEqual(1.5 * 1024 * 1024)
    expect(elapsed).toBeLessThan(1000)
  }, 30_000)
})
