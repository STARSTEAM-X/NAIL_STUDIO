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
  'fire-dragon': {
    title: 'Fire Dragon',
    description: 'มังกรดำขอบทองพ่นไฟบนนิ้วกลาง วาดด้วยลาย path อิสระ (SVG) บนพื้นแดงไล่ส้ม นิ้วอื่นเป็นเปลวไฟที่ปลาย',
    recipe: {
      defaults: { shape: 'almond', length: 'long', base: '#8e1420', finish: 'glossy' },
      nails: {
        ...Object.fromEntries(['thumb', 'index', 'ring', 'little'].map((finger) => [finger, {
          patterns: [
            { type: 'gradient', color: '#ff5a14', reach: 0.8 },
            { type: 'flame', color: '#ffb21e' },
          ],
        }])),
        middle: {
          patterns: [
            { type: 'gradient', color: '#ff5a14', reach: 0.8 },
            // มังกรวาดใน viewBox 0–100 (y = 0 ปลายเล็บ) — ส่วนที่อยู่ช่วงปลาย (เขา เปลวไฟ) วาดเตี้ยไว้
            // เพราะทรง almond/long ยืดช่วงปลายตามแนวยาวราว 3 เท่า
            ...([
              ['M31 28 C23 29 17 25 14 19 C19 21 20 17 18 13 C24 17 25 13 25 9 C30 13 31 10 33 7 C34 12 36 13 40 11 C39 16 40 19 43 18 C40 22 36 26 31 28 Z', { fill: '#ffb21e', stroke: '#c8160e', strokeWidth: 0.8 }],
              ['M31 26 C26 26 23 23 22 20 C25 21 27 18 27 15 C30 18 31 15 33 13 C34 17 35 18 38 16 C37 21 34 24 31 26 Z', { fill: '#fff3b0' }],
              ['M51.6 87.7 L49.4 82.7 L46.1 86.6 Z M39.2 84.4 L37.7 79 L33.6 82.3 Z M27.7 79.2 L29.4 74.6 L25.7 77.2 Z M24.7 74.3 L29.3 73.2 L25 72.7 Z M26.3 71.4 L29.9 74.9 L29.8 70.3 Z M38.6 68.9 L43.2 72.8 L46.3 67.8 Z M55.9 65.7 L60.8 69.2 L63.6 64 Z M73.3 61.3 L78.1 64 L79.3 58.5 Z M83.8 51 L87.7 47.5 L82.7 45.3 Z M78.7 40 L78.8 34.9 L74 37.2 Z M66.5 35.2 L64.5 30.3 L61 34.3 Z M54.9 33.7 L52.5 29.5 L50.8 34.2 Z', { fill: '#2a0d10', stroke: '#d8a440', strokeWidth: 0.5 }],
              ['M64.1 89.3 L63.1 89.1 L61.9 88.9 L60.5 88.7 L58.9 88.6 L57.2 88.4 L55.3 88.2 L53.5 87.9 L51.6 87.7 L49.7 87.3 L47.8 87 L46.1 86.6 L44.4 86.1 L42.8 85.6 L41 85 L39.2 84.4 L37.3 83.7 L35.4 83 L33.6 82.3 L31.9 81.5 L30.3 80.7 L28.9 80 L27.7 79.2 L26.7 78.5 L26.1 77.8 L25.7 77.2 L25.3 76.5 L25 75.7 L24.8 75 L24.7 74.3 L24.7 73.7 L24.8 73.1 L25 72.7 L25.2 72.3 L25.5 72 L25.8 71.7 L26.3 71.4 L27 71.1 L28.2 70.7 L29.8 70.3 L31.7 69.9 L33.8 69.5 L36.1 69.2 L38.6 68.9 L41.1 68.5 L43.7 68.2 L46.3 67.8 L48.8 67.3 L51.2 66.8 L53.5 66.2 L55.9 65.7 L58.4 65.2 L61 64.6 L63.6 64 L66.1 63.4 L68.7 62.7 L71.1 62 L73.3 61.3 L75.5 60.5 L77.5 59.6 L79.3 58.5 L81 57 L82.4 55.2 L83.3 53.1 L83.8 51 L83.7 48.9 L83.3 47 L82.7 45.3 L81.9 43.8 L80.9 42.4 L79.9 41.2 L78.7 40 L77.4 39 L75.7 38 L74 37.2 L72.2 36.6 L70.3 36.1 L68.4 35.6 L66.5 35.2 L64.6 34.8 L62.7 34.5 L61 34.3 L59.3 34.1 L57.8 33.9 L56.4 33.8 L54.9 33.7 L53.4 33.8 L52.1 34 L50.8 34.2 L49.7 34.6 L48.6 34.9 L47.8 35.3 L47.1 35.6 L46.5 35.9 L46.2 36 L46.1 36 L46.1 36.1 L49.9 47.9 L50.6 47.7 L51.3 47.4 L51.9 47.1 L52.4 46.9 L52.8 46.7 L53.1 46.6 L53.5 46.5 L53.8 46.4 L54.2 46.3 L54.5 46.2 L55 46.2 L55.6 46.2 L56.6 46.3 L57.9 46.4 L59.4 46.6 L61 46.8 L62.6 47 L64.2 47.3 L65.8 47.6 L67.3 47.9 L68.6 48.3 L69.6 48.6 L70.3 48.9 L70.6 49 L70.9 49.2 L71.3 49.5 L71.6 49.9 L71.9 50.2 L72.1 50.4 L72.2 50.5 L72.2 50.5 L72.2 50.2 L72.3 49.9 L72.5 49.6 L72.7 49.4 L72.7 49.5 L72.2 49.9 L71.1 50.4 L69.6 51.1 L67.8 51.7 L65.7 52.4 L63.4 53.1 L60.9 53.8 L58.4 54.5 L55.9 55.2 L53.4 55.9 L51 56.6 L48.8 57.2 L46.7 57.8 L44.4 58.3 L42.1 58.8 L39.6 59.3 L37.1 59.8 L34.6 60.3 L32.2 60.8 L29.8 61.4 L27.6 62 L25.5 62.7 L23.5 63.5 L21.7 64.6 L20.2 66 L19.1 67.4 L18.2 69.1 L17.7 70.7 L17.5 72.4 L17.6 74.1 L17.8 75.7 L18.3 77.1 L19 78.6 L19.8 79.9 L20.8 81.1 L21.9 82.2 L23.2 83.2 L24.7 84.1 L26.3 84.9 L28.1 85.6 L29.9 86.3 L31.9 87 L33.9 87.6 L35.9 88.1 L37.9 88.6 L39.9 89.1 L41.8 89.5 L43.6 89.9 L45.4 90.2 L47.3 90.4 L49.3 90.6 L51.3 90.7 L53.2 90.8 L55.2 90.8 L57 90.9 L58.8 90.8 L60.4 90.8 L61.8 90.8 L63 90.8 L63.9 90.7 Z', { fill: '#17090b', stroke: '#e0b04c', strokeWidth: 0.9 }],
              ['M47.8 87.5 Q49.1 89 47.4 89.9 M39 85 Q40.1 87 38.1 88 M30 81.5 Q30.6 83.8 28.4 84.9 M24.9 77.8 Q24.2 80.4 21.5 80.5 M23.6 73.7 Q21.2 75.5 18.6 74 M25 70.8 Q21.9 69.9 21.1 66.8 M31.4 68.6 Q29.2 66 30.1 62.6 M43.5 66.8 Q41.3 63.8 42.3 60.2 M55.5 64.2 Q53.1 61.2 53.8 57.4 M68.2 61.2 Q65.6 58 66.1 54 M78.3 57.1 Q74.7 55 73.7 50.9 M82 49.1 Q78.2 51.3 73.9 50.2 M78.6 42.4 Q76.7 46.5 72.6 48.3 M71.6 38.3 Q71.9 42.9 69.1 46.5 M62.5 36.4 Q63.4 40.9 61.2 45 M54.9 35.6 Q56.6 40 55 44.3 M49.3 36.7 Q52.4 40.2 52.4 44.8', { stroke: '#c8923a', strokeWidth: 0.5 }],
              ['M54 30 Q62 26 67 20 Q63 28 57 34 Z M50 28 Q52 22 57 18 Q55 24 54 30 Z', { fill: '#e8c46a' }],
              ['M49 48 C57 47 61 40 58 33 C56 29 52 27 47 28 L39 24 L30 23 L34 27 L38 28 L33 30 L27 31 L36 34 C35 39 38 44 43 46 C45 47 47 48 49 48 Z', { fill: '#17090b', stroke: '#e0b04c', strokeWidth: 0.9 }],
              ['M33 30 Q22 33 18 40 M36 34 Q27 40 24 47 M56 42 Q66 46 72 41', { stroke: '#e0b04c', strokeWidth: 0.6 }],
              ['M45 32 L50 31 L48 34 Z', { fill: '#ffd23a' }],
            ] as const).map(([d, paint]) => ({
              type: 'path' as const, d, viewBox: [0, 0, 100, 100], region: { u0: 0.2, v0: 0.06, u1: 0.8, v1: 0.96 }, ...paint,
            })),
          ],
        },
      },
    },
  },
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
