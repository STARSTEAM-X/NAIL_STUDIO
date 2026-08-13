import type { Layer, Stroke } from '@nail-studio/contracts'
import { strokeToDabs, type Dab } from './brush.ts'
import { TEX_SIZE } from './constants.ts'

/**
 * วาดแต้มสีลงแคนวาส 2D (A-15)
 *
 * ใช้ Canvas2D ไม่ใช่ WebGL render target เพราะเส้นถูกวาดตอนผู้ใช้ลากนิ้วเท่านั้น
 * ไม่ใช่ทุกเฟรม ต้นทุนจึงไม่ได้อยู่บนเส้นทางวิกฤต ส่วน Canvas2D ให้ blend mode
 * และ radial gradient มาฟรี ซึ่งถ้าทำเองบน WebGL ต้องเขียน shader เพิ่มอีกชุด
 */

export type Ctx2D = CanvasRenderingContext2D

const HEX_LONG = /^#([0-9a-f]{6})$/i
const HEX_SHORT = /^#([0-9a-f]{3})$/i
const TAU = Math.PI * 2

/** รัศมีอ้างอิงของ gradient ที่สร้างครั้งเดียวแล้วย่อ/ขยายเอา */
const UNIT_RADIUS = 64

/** ต่ำกว่านี้ถือว่าขอบคม การสร้าง gradient จะไม่ให้ผลต่างที่มองเห็น */
const HARD_EDGE_THRESHOLD = 0.02

export function hexToRgba(hex: string, alpha: number): string {
  const long = HEX_LONG.exec(hex)
  const short = HEX_SHORT.exec(hex)
  let r: number
  let g: number
  let b: number
  if (long?.[1]) {
    const value = Number.parseInt(long[1], 16)
    r = (value >> 16) & 255
    g = (value >> 8) & 255
    b = value & 255
  } else if (short?.[1]) {
    const value = short[1]
    r = Number.parseInt(`${value[0]}${value[0]}`, 16)
    g = Number.parseInt(`${value[1]}${value[1]}`, 16)
    b = Number.parseInt(`${value[2]}${value[2]}`, 16)
  } else {
    return hex
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/**
 * วาดทั้งเส้นในครั้งเดียวเพราะสีกับความฟุ้งคงที่ตลอดเส้น
 *
 * การสร้าง radial gradient ใหม่ทุกแต้มคือหลายหมื่นครั้งต่อการ replay หนึ่งรอบ
 * บนเล็บที่ลงสีหนัก gradient เป็นวงกลมสมมาตร การย่อ/ขยายด้วย transform
 * จึงให้ผลเท่ากับสร้างใหม่ที่รัศมีนั้นทุกประการ
 */
export function drawDabs(ctx: Ctx2D, dabs: Dab[], color: string, softness: number): void {
  if (dabs.length === 0) return
  ctx.save()
  if (softness <= HARD_EDGE_THRESHOLD) {
    ctx.fillStyle = color
    for (const dab of dabs) {
      ctx.globalAlpha = dab.alpha
      ctx.beginPath()
      ctx.arc(dab.x, dab.y, Math.max(0.5, dab.r), 0, TAU)
      ctx.fill()
    }
  } else {
    const inner = Math.max(0, 1 - softness)
    const gradient = ctx.createRadialGradient(0, 0, UNIT_RADIUS * inner, 0, 0, UNIT_RADIUS)
    gradient.addColorStop(0, hexToRgba(color, 1))
    gradient.addColorStop(1, hexToRgba(color, 0))
    ctx.fillStyle = gradient
    for (const dab of dabs) {
      const scale = Math.max(0.5, dab.r) / UNIT_RADIUS
      ctx.globalAlpha = dab.alpha
      ctx.save()
      ctx.translate(dab.x, dab.y)
      ctx.scale(scale, scale)
      ctx.beginPath()
      ctx.arc(0, 0, UNIT_RADIUS, 0, TAU)
      ctx.fill()
      ctx.restore()
    }
  }
  ctx.restore()
}

export function drawDab(ctx: Ctx2D, dab: Dab, color: string, softness: number): void {
  drawDabs(ctx, [dab], color, softness)
}

export function renderStroke(ctx: Ctx2D, stroke: Stroke, texSize = TEX_SIZE): void {
  switch (stroke.kind) {
    case 'fill':
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      ctx.fillStyle = stroke.color
      ctx.fillRect(0, 0, texSize, texSize)
      ctx.restore()
      return
    case 'brush':
      ctx.save()
      ctx.globalCompositeOperation = 'source-over'
      drawDabs(ctx, strokeToDabs(stroke, texSize), stroke.color, stroke.softness)
      ctx.restore()
      return
    case 'erase':
      // destination-out เจาะรูให้เห็นเลเยอร์ล่าง — ยางลบต้องลบเฉพาะเลเยอร์ของตัวเอง
      // จึงต้องวาดบนแคนวาสของเลเยอร์นั้น ไม่ใช่บนแคนวาสรวม
      ctx.save()
      ctx.globalCompositeOperation = 'destination-out'
      drawDabs(ctx, strokeToDabs(stroke, texSize), '#000000', stroke.softness)
      ctx.restore()
      return
  }
}

export function renderLayer(ctx: Ctx2D, layer: Layer, texSize = TEX_SIZE): void {
  ctx.clearRect(0, 0, texSize, texSize)
  for (const stroke of layer.strokes) renderStroke(ctx, stroke, texSize)
}
