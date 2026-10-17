import type { Recipe } from './recipe.ts'
import { REFERENCE_PRESETS } from './referencePresets.ts'
import { LUXURY_PRESETS } from './luxuryPresets.ts'

/**
 * ดีไซน์สำเร็จรูป (ทำจากรูปตัวอย่างและตรวจบน editor จริงแล้ว) — เป็น recipe ล้วน
 * ใช้ได้ทั้งเป็นจุดเริ่มต้น และเป็นตัวอย่าง few-shot ให้ AI เห็นว่า recipe ที่ดีหน้าตาเป็นอย่างไร
 */
export const PRESETS: Record<string, { title: string; description: string; recipe: Recipe }> = {
  ...REFERENCE_PRESETS,
  ...LUXURY_PRESETS,
  'emerald-swirl': {
    title: 'Emerald Swirl',
    description: 'พื้นชมพูนู้ด ปลายเล็บโค้งเขียวเข้ม สลับนิ้วที่มีใบไม้เขียว',
    recipe: {
      defaults: { shape: 'almond', length: 'medium', base: '#ecc4c0' },
      nails: {
        thumb: { patterns: [{ type: 'leaf', color: '#1f6e55', vein: '#7fb89d', size: 0.26, angle: -72 }] },
        index: { patterns: [{ type: 'swirl_tip', color: '#0e4a3b', accent: '#1f6e55', side: 'left' }] },
        middle: {
          patterns: [
            { type: 'swirl_tip', color: '#0e4a3b', accent: '#1f6e55', side: 'right' },
            { type: 'leaf', color: '#1f6e55', vein: '#7fb89d', u: 0.55, v: 0.66, size: 0.17, angle: -63 },
          ],
        },
        ring: { patterns: [{ type: 'swirl_tip', color: '#0e4a3b', accent: '#1f6e55', side: 'left' }] },
        little: { patterns: [{ type: 'leaf', color: '#1f6e55', vein: '#7fb89d', v: 0.52, size: 0.24, angle: -77 }] },
      },
    },
  },
  'polka-duo': {
    title: 'Polka Duo',
    description: 'มือขวาชมพูจุดเลือดหมู มือซ้ายเลือดหมูจุดชมพู',
    recipe: {
      defaults: { shape: 'almond', length: 'medium' },
      nails: Object.fromEntries(['thumb', 'index', 'middle', 'ring', 'little'].flatMap((finger) => [
        [`right.${finger}`, { base: '#f4bfd1', patterns: [{ type: 'dots', color: '#4a0e1d', size: 0.05 }] }],
        [`left.${finger}`, { base: '#4a0e1d', patterns: [{ type: 'dots', color: '#f4bfd1', size: 0.055 }] }],
      ])),
    },
  },
  'peach-blush-vine': {
    title: 'Peach Blush Vine',
    description: 'ทรงเหลี่ยมยาว ไล่สีพีชกลางเล็บ มือขวามีเถาใบขาวและใบทอง',
    recipe: {
      defaults: { shape: 'square', length: 'long', base: '#f5f0ee' },
      mirrorLeft: false,
      nails: {
        thumb: { patterns: [{ type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 }] },
        index: { patterns: [{ type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 }] },
        middle: { patterns: [{ type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 }] },
        ring: { patterns: [{ type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 }] },
        little: { patterns: [{ type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 }] },
        ...Object.fromEntries(['index', 'middle', 'ring', 'little'].map((finger) => [`right.${finger}`, {
          patterns: [
            { type: 'gradient', color: '#f59a8a', from: 'cuticle', reach: 0.65, strength: 1.3 },
            { type: 'vine', stem: '#ffffff', leaf: '#ffffff', accent: '#d6a343', flip: finger === 'middle' || finger === 'little' },
          ],
        }])),
      },
    },
  },
  'tortoise-turquoise': {
    title: 'Tortoise Turquoise',
    description: 'กระดองเต่าอำพัน กับลายเทอร์ควอยซ์ต่างกันทุกนิ้ว',
    recipe: {
      defaults: { shape: 'almond', length: 'medium', base: '#b9580d' },
      nails: {
        thumb: { patterns: [{ type: 'tortoise', seed: 3 }, { type: 'curve', color: '#62d4c9', width: 0.12, points: [[0.1, 0.75], [0.4, 0.55], [0.6, 0.45], [0.95, 0.2]] }] },
        index: { patterns: [{ type: 'tortoise', seed: 5 }, { type: 'star', color: '#62d4c9', rx: 0.24, ry: 0.32 }] },
        middle: { patterns: [{ type: 'tortoise', seed: 7 }, { type: 'curve', color: '#62d4c9', width: 0.13, points: [[0.25, 0], [0.15, 0.4], [0.85, 0.55], [0.75, 1]] }] },
        ring: { patterns: [{ type: 'tortoise', seed: 9 }, { type: 'star', color: '#62d4c9', rx: 0.24, ry: 0.32 }] },
        little: { patterns: [{ type: 'tortoise', seed: 11 }, { type: 'curve', color: '#62d4c9', width: 0.035, points: [[0.68, 0.95], [0.62, 0.35], [0.5, 0.05], [0.32, 0.4]] }] },
      },
    },
  },
  'fruit-garden': {
    title: 'Fruit Garden',
    description: 'เส้นฟ้า ส้ม สตรอว์เบอร์รี เชอร์รี มะนาว บนพื้นครีม/นู้ด',
    recipe: {
      defaults: { shape: 'almond', length: 'long', base: '#efcfc4' },
      nails: {
        thumb: { base: '#f7f1e6', patterns: [{ type: 'stripes', color: '#8091ee', count: 5 }] },
        index: { base: '#f7f1e6', patterns: [{ type: 'fruit', kind: 'orange', u: 0.5, v: 0.45 }] },
        middle: { patterns: [{ type: 'french', color: '#f7f1e6', depth: 0.34, smile: 0.06 }, { type: 'fruit', kind: 'strawberry', u: 0.39, v: 0.24, size: 0.6 }, { type: 'fruit', kind: 'strawberry', u: 0.61, v: 0.22, size: 0.6 }] },
        ring: { patterns: [{ type: 'french', color: '#f7f1e6', depth: 0.26, smile: 0.06 }, { type: 'fruit', kind: 'cherry', u: 0.5, v: 0.45 }] },
        little: { patterns: [{ type: 'french', color: '#f7f1e6', depth: 0.22, smile: 0.06 }, { type: 'fruit', kind: 'lemon', u: 0.5, v: 0.62 }] },
      },
    },
  },
  'lavender-butterfly': {
    title: 'Lavender Butterfly',
    description: 'ทรงเหลี่ยมยาว กลิตเตอร์ม่วงไล่จากปลาย สลับ French ขาวไล่จางกับผีเสื้อม่วง',
    recipe: {
      defaults: { shape: 'square', length: 'long', base: '#dfaaa2' },
      nails: {
        ...Object.fromEntries(['thumb', 'middle', 'little'].map((finger, i) => [finger, {
          patterns: [
            { type: 'gradient', color: '#c2adf6', reach: 0.66, strength: 0.45 },
            { type: 'glitter', colors: ['#9a78ee', '#b9a0ff', '#d9ccff', '#ffffff', '#7f5fdc', '#c5b2ff'], haze: '#a184ee', density: 0.85, reach: 0.6, seed: 100 + i },
          ],
        }])),
        ...Object.fromEntries(['index', 'ring'].map((finger) => [finger, {
          patterns: [
            { type: 'french', color: '#fdfbfa', depth: 0.28, soft: true },
            { type: 'butterfly', wing: '#9070e4', outline: '#5d3aa8', u: 0.55, v: 0.24, size: 0.13 },
            { type: 'flower', petal: '#c2adf6', center: '#5d3aa8', u: 0.32, v: 0.3, size: 0.045 },
            { type: 'flower', petal: '#c2adf6', center: '#5d3aa8', u: 0.35, v: 0.15, size: 0.035 },
          ],
        }])),
      },
    },
  },
}
