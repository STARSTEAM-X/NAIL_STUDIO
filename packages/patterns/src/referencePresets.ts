import type { Recipe } from './recipe.ts'

const NUDE = '#ddb3a9'
const MILK = '#fff9ed'
const WINE = '#861d35'
const GOLD = '#c5ad76'

/** เรียงตามภาพอ้างอิง 1–17; ทุกรายการเป็น recipe ที่แก้สีและองค์ประกอบต่อได้ */
export const REFERENCE_PRESETS: Record<string, { title: string; description: string; recipe: Recipe }> = {
  'cloud-sky': {
    title: 'Cloud Sky', description: 'เมฆขาวบนปลายฟ้าพาสเทล สายสีพริ้ว และวงโคจรดาว',
    recipe: { defaults: { base: NUDE, shape: 'almond', length: 'medium', finish: 'glossy' }, nails: {
      thumb: { patterns: [{ type: 'french', color: '#a3bfd6', depth: 0.32 }, { type: 'cloud', u: 0.48, v: 0.3, size: 0.14 }, { type: 'constellation', orbit: true }] },
      index: { patterns: [{ type: 'curve', color: '#9fbbd5', width: 0.06, points: [[0.28, 0.08], [0.8, 0.3], [0.2, 0.62], [0.7, 0.95]] }, { type: 'curve', color: '#fff7e9', width: 0.012, points: [[0.34, 0.08], [0.86, 0.3], [0.26, 0.62], [0.76, 0.95]] }] },
      middle: { patterns: [{ type: 'gradient', color: '#9ab7d5', reach: 0.55 }, { type: 'cloud', u: 0.4, v: 0.28, size: 0.11 }, { type: 'star', color: '#fff9e6', u: 0.64, v: 0.5, rx: 0.025, ry: 0.05 }] },
      ring: { patterns: [{ type: 'gradient', color: '#a0b6d2', reach: 0.6 }, { type: 'constellation', seed: 3 }] },
      little: { patterns: [{ type: 'french', color: '#a3bfd6', depth: 0.25, border: MILK }, { type: 'cloud', u: 0.52, v: 0.25, size: 0.1 }] },
    } },
  },
  'champagne-quilt': {
    title: 'Champagne Quilt', description: 'แม่เหล็กแชมเปญ ตารางมุก และโบว์ผ้าซาติน',
    recipe: { defaults: { base: '#bca48d', shape: 'almond', finish: 'cat_eye' }, nails: {
      thumb: { patterns: [{ type: 'cat_eye', color: '#e8dfbe', angle: -30 }] },
      index: { base: NUDE, finish: 'glossy', patterns: [{ type: 'quilt', color: GOLD }], decorations: [{ catalogId: 'pearl-single', u: 0.5, v: 0.54, scale: 0.48 }] },
      middle: { base: NUDE, finish: 'glossy', patterns: [{ type: 'bow', color: '#e9d8b1', style: 'silk', size: 0.19 }], decorations: [{ catalogId: 'pearl-single', u: 0.5, v: 0.5, scale: 0.56 }] },
      ring: { patterns: [{ type: 'cat_eye', color: '#eee5ca', angle: 25 }] },
      little: { base: '#dac7b0', patterns: [{ type: 'cat_eye', color: '#fff0cd' }, { type: 'quilt', color: '#c6b7a0', spacing: 0.26 }] },
    } },
  },
  'pink-polka-pearl': {
    title: 'Pink Polka Pearl', description: 'ชมพูมุกเหลือบสลับจุดดำละเอียดและคริสตัลเล็ก',
    recipe: { defaults: { base: '#d49eaf', shape: 'almond', length: 'long', finish: 'pearl' }, nails: {
      thumb: { patterns: [] },
      index: { patterns: [{ type: 'dots', color: '#332732', size: 0.018, spacing: 0.11 }], decorations: [{ catalogId: 'gem-round', color: '#f4eee7', u: 0.5, v: 0.86, scale: 0.35 }] },
      middle: { patterns: [], decorations: [{ catalogId: 'gem-round', color: '#f4eee7', u: 0.5, v: 0.86, scale: 0.35 }] },
      ring: { patterns: [{ type: 'dots', color: '#332732', size: 0.018, spacing: 0.11 }] },
      little: { patterns: [] },
    } },
  },
  'burgundy-ribbon': {
    title: 'Burgundy Ribbon', description: 'ไวน์แดงเงา สลับโบว์เส้นบางและกลิตเตอร์เงินละเอียด',
    recipe: { defaults: { base: WINE, shape: 'squoval', length: 'short' }, nails: {
      thumb: { patterns: [] },
      index: { base: '#ead4ca', patterns: [{ type: 'cat_eye', color: '#ede7df' }, { type: 'bow', color: WINE, size: 0.17, angle: -12 }] },
      middle: { patterns: [] },
      ring: { base: '#c4b7ba', finish: 'cat_eye', patterns: [{ type: 'cat_eye', color: '#f8f1eb' }, { type: 'glitter', colors: ['#fff8ed', '#ded4ce'], size: 0.006, coverage: 'full', density: 0.65 }] },
      little: { patterns: [] },
    } },
  },
  'ruby-crystal-ombre': {
    title: 'Ruby Crystal Ombre', description: 'แดงรูบีไล่สีนู้ด พร้อมช่อคริสตัลและประกาย',
    recipe: { defaults: { base: '#d7aca7', shape: 'square', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'gradient', color: '#971831', reach: 0.9, strength: 1.8 }] },
      index: { patterns: [{ type: 'gradient', color: '#971831', reach: 0.9, strength: 1.8 }, { type: 'glitter', colors: ['#b32646', '#e89096'], size: 0.007, density: 0.4 }] },
      middle: { patterns: [{ type: 'gradient', color: '#971831', reach: 0.9, strength: 1.8 }], decorations: [{ catalogId: 'gem-round', color: '#f4eee7', u: 0.5, v: 0.5, scale: 0.325 }] },
      ring: { patterns: [{ type: 'gradient', color: '#971831', reach: 0.95, strength: 1.8 }], decorations: [
        { catalogId: 'gem-round', color: '#f4eee7', u: 0.5, v: 0.5, scale: 0.425 },
        { catalogId: 'gem-round', color: '#f4eee7', u: 0.41, v: 0.42, scale: 0.325 }, { catalogId: 'gem-round', color: '#f4eee7', u: 0.59, v: 0.42, scale: 0.325 },
        { catalogId: 'gem-round', color: '#f4eee7', u: 0.41, v: 0.58, scale: 0.325 }, { catalogId: 'gem-round', color: '#f4eee7', u: 0.59, v: 0.58, scale: 0.325 },
      ] },
      little: { patterns: [{ type: 'gradient', color: '#971831', reach: 0.85, strength: 1.8 }] },
    } },
  },
  'pearl-heart-french': {
    title: 'Pearl Heart French', description: 'เฟรนช์ขาวมุก หัวใจไวน์แดง และโบว์ริบบิ้น',
    recipe: { defaults: { base: '#d9b5ac', shape: 'square', length: 'medium', finish: 'pearl' }, nails: {
      thumb: { patterns: [{ type: 'french', color: MILK, depth: 0.22 }, { type: 'heart', color: WINE, u: 0.38, v: 0.52, size: 0.04 }] },
      index: { patterns: [{ type: 'french', color: MILK, depth: 0.2 }, { type: 'bow', color: WINE, v: 0.3, size: 0.1 }], decorations: [{ catalogId: 'pearl-single', u: 0.5, v: 0.55, scale: 0.32 }] },
      middle: { base: MILK, patterns: [{ type: 'heart', color: WINE, u: 0.35, v: 0.3, size: 0.04 }, { type: 'heart', color: WINE, u: 0.64, v: 0.62, size: 0.04 }] },
      ring: { patterns: [{ type: 'french', color: MILK, depth: 0.22 }, { type: 'heart', color: WINE, u: 0.6, v: 0.45, size: 0.04 }] },
      little: { patterns: [{ type: 'french', color: MILK, depth: 0.18 }] },
    } },
  },
  'red-gold-french': {
    title: 'Red Gold French', description: 'ขอบปลายไวน์แดงและเส้นโค้งทองบนพื้นนู้ดใส',
    recipe: { defaults: { base: '#dcbab0', shape: 'almond', length: 'medium' }, nails: {
      thumb: { patterns: [{ type: 'french', color: WINE, depth: 0.16, smile: 0.1, border: GOLD }, { type: 'heart', color: WINE, u: 0.58, v: 0.55, size: 0.06 }] },
      index: { patterns: [{ type: 'french', color: WINE, depth: 0.18, smile: 0.12 }, { type: 'french', color: GOLD, depth: 0.27, smile: 0.12, outlineOnly: true, borderWidth: 0.012 }] },
      middle: { patterns: [{ type: 'french', color: GOLD, depth: 0.23, smile: 0.12, outlineOnly: true }, { type: 'bow', color: WINE, v: 0.55, size: 0.17, angle: -15 }] },
      ring: { patterns: [{ type: 'french', color: WINE, depth: 0.17, smile: 0.1, border: GOLD }] },
      little: { patterns: [{ type: 'french', color: GOLD, depth: 0.18, smile: 0.1, outlineOnly: true }] },
    } },
  },
  'pastel-picnic': {
    title: 'Pastel Picnic', description: 'ผลไม้ ดอกเดซี่ เมฆ และสายรุ้งบนปลายเล็บพาสเทล',
    recipe: { defaults: { base: '#e6c0af', shape: 'squoval', length: 'short' }, nails: {
      thumb: { patterns: [{ type: 'swirl_tip', color: '#c7d8ba', depth: 0.4 }, { type: 'flower', petal: MILK, center: '#dab969', size: 0.07, u: 0.36, v: 0.28 }, { type: 'flower', petal: MILK, center: '#dab969', size: 0.065, u: 0.64, v: 0.46 }] },
      index: { patterns: [{ type: 'french', color: '#a9c8d4', depth: 0.3 }, { type: 'cloud', u: 0.36, v: 0.3, size: 0.09 }, { type: 'rainbow', u: 0.62, v: 0.48, size: 0.085, angle: -15 }] },
      middle: { patterns: [{ type: 'french', color: '#f1d79a', depth: 0.25 }, { type: 'fruit', kind: 'cherry', size: 0.65, v: 0.4 }, { type: 'fruit', kind: 'strawberry', size: 0.6, u: 0.36, v: 0.2 }] },
      ring: { patterns: [{ type: 'french', color: '#b5cfb8', depth: 0.25 }, { type: 'flower', petal: MILK, center: '#e5c677', size: 0.1, u: 0.48, v: 0.34 }, { type: 'leaf', color: '#48866a', u: 0.5, v: 0.56, size: 0.07 }] },
      little: { patterns: [{ type: 'french', color: '#eab7c3', depth: 0.22 }, { type: 'fruit', kind: 'lemon', size: 0.65, v: 0.45 }] },
    } },
  },
  'vanilla-sprinkle': {
    title: 'Vanilla Sprinkle', description: 'ปลายเล็บครีมขอบคลื่น เกล็ดน้ำตาล โบว์ กระต่ายและแมว',
    recipe: { defaults: { base: '#dfb4a9', shape: 'square', length: 'short' }, nails: {
      thumb: { patterns: [{ type: 'wavy_tip', color: '#fff3cc', border: WINE, depth: 0.3 }, { type: 'sprinkles', colors: [WINE, '#b2d4d9'], count: 10, to: 0.25 }] },
      index: { patterns: [{ type: 'wavy_tip', color: '#fff3cc', border: WINE, depth: 0.3 }, { type: 'sprinkles', colors: [WINE, '#b2d4d9'], count: 9, to: 0.25, seed: 3 }] },
      middle: { patterns: [{ type: 'bunny', face: false, size: 0.19, v: 0.45 }, { type: 'bow', color: WINE, size: 0.1, v: 0.6 }] },
      ring: { patterns: [{ type: 'wavy_tip', color: MILK, depth: 0.32, border: WINE }, { type: 'cat', size: 0.13, v: 0.22 }, { type: 'bow', color: WINE, size: 0.045, u: 0.6, v: 0.13 }] },
      little: { patterns: [{ type: 'wavy_tip', color: '#fff3cc', border: WINE, depth: 0.3 }, { type: 'sprinkles', colors: [WINE, '#b2d4d9'], count: 7, to: 0.25, seed: 5 }] },
    } },
  },
  'latte-polka-french': {
    title: 'Latte Polka French', description: 'เฟรนช์ครีมกับจุดน้ำตาลห่าง ๆ บนพื้นลาเต้',
    recipe: { defaults: { base: '#d2a298', shape: 'squoval', length: 'medium' }, nails: {
      thumb: { patterns: [{ type: 'french', color: '#f2e5cc', depth: 0.22, smile: 0.09 }] },
      index: { base: '#eee0c9', patterns: [{ type: 'dots', color: '#8e6346', size: 0.026, spacing: 0.25 }] },
      middle: { patterns: [{ type: 'french', color: '#f2e5cc', depth: 0.2, smile: 0.09 }] },
      ring: { base: '#eee0c9', patterns: [{ type: 'dots', color: '#8e6346', size: 0.026, spacing: 0.25 }] },
      little: { patterns: [{ type: 'french', color: '#f2e5cc', depth: 0.18, smile: 0.09 }] },
    } },
  },
  'playful-doodles': {
    title: 'Playful Doodles', description: 'หน้ายิ้ม ดอกไม้เส้นขอบ ตารางสเก็ตช์ และเส้นขดสีสด',
    recipe: { defaults: { base: '#f3eadc', shape: 'squoval', length: 'short' }, nails: {
      thumb: { base: '#e5e7ee', patterns: [{ type: 'smiley', color: '#4c9ccd', size: 0.2, hair: true, angle: -8 }] },
      index: { base: '#bdd9c2', patterns: [{ type: 'checkerboard', color: '#5d4c53', size: 0.25, style: 'sketch' }] },
      middle: { patterns: [{ type: 'flower', petal: '#df4c81', center: '#e4b157', size: 0.13, u: 0.45, v: 0.32, style: 'outline' }, { type: 'flower', petal: '#df4c81', center: '#e4b157', size: 0.1, u: 0.66, v: 0.68, style: 'outline' }] },
      ring: { base: '#faf1cb', patterns: [{ type: 'squiggle', color: '#e9ac45', size: 0.11, u: 0.4, v: 0.3, angle: 35 }, { type: 'squiggle', color: '#e9ac45', size: 0.1, u: 0.63, v: 0.7, angle: -35 }, { type: 'dots', color: '#e3ba5f', spacing: 0.25, size: 0.024 }] },
      little: { base: '#d2cbea', patterns: [{ type: 'heart', color: '#8867bc', size: 0.09, u: 0.4, v: 0.3 }, { type: 'heart', color: '#8867bc', size: 0.09, u: 0.64, v: 0.67 }] },
    } },
  },
  'midnight-haunt': {
    title: 'Midnight Haunt', description: 'ดำประกายเงิน ใยแมงมุม ผีน้อย กะโหลก และหน้ารอยเย็บ',
    recipe: { defaults: { base: '#191920', shape: 'square', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'glitter', colors: ['#a7a2a0', '#dfd9c7'], size: 0.006, density: 0.3, coverage: 'full' }, { type: 'spiderweb' }] },
      index: { base: '#f1eee4', patterns: [{ type: 'skull', color: '#f1eee4', detail: '#23212a', stitched: true, size: 0.25 }] },
      middle: { patterns: [{ type: 'cat_eye', color: '#9b929c', angle: 0 }, { type: 'ghost', size: 0.14, v: 0.42 }] },
      ring: { patterns: [{ type: 'skull', size: 0.19, v: 0.38 }, { type: 'skull', size: 0.1, u: 0.62, v: 0.75 }] },
      little: { patterns: [{ type: 'spiderweb', corner: 'right' }, { type: 'ghost', size: 0.13, v: 0.62, angle: 15 }] },
    } },
  },
  'graphic-french': {
    title: 'Graphic French', description: 'ปลายเฉียง ตัว V และ reverse French ขาวดำบนพื้นนู้ด',
    recipe: { defaults: { base: '#d4b1aa', shape: 'square', length: 'medium' }, nails: {
      thumb: { patterns: [{ type: 'french', color: '#23232a', style: 'chevron', depth: 0.25 }] },
      index: { patterns: [{ type: 'french', color: '#23232a', style: 'diagonal', depth: 0.3 }, { type: 'french', color: MILK, style: 'diagonal', side: 'right', depth: 0.22 }] },
      middle: { patterns: [{ type: 'french', color: MILK, depth: 0.2 }, { type: 'french', color: '#23232a', style: 'reverse', depth: 0.12 }] },
      ring: { patterns: [{ type: 'french', color: '#23232a', style: 'chevron', depth: 0.3 }, { type: 'french', color: MILK, style: 'chevron', depth: 0.2 }] },
      little: { patterns: [{ type: 'french', color: MILK, depth: 0.18 }, { type: 'french', color: '#23232a', depth: 0.28, outlineOnly: true }] },
    } },
  },
  'cherry-blush': {
    title: 'Cherry Blush', description: 'นมชมพูบลัชกลางเล็บ เชอร์รี กระต่าย และดาวประกายเล็ก',
    recipe: { defaults: { base: '#f2e8dc', shape: 'square', length: 'short' }, nails: {
      thumb: { patterns: [{ type: 'aura', color: '#d985a2', radius: 0.34 }, { type: 'bunny', size: 0.13, v: 0.58 }, { type: 'fruit', kind: 'strawberry', size: 0.6, v: 0.28 }] },
      index: { patterns: [{ type: 'aura', color: '#d985a2', radius: 0.34 }, { type: 'star', color: '#b8aeb7', rx: 0.06, ry: 0.08, u: 0.36, v: 0.27 }, { type: 'star', color: '#b8aeb7', rx: 0.05, ry: 0.07, u: 0.64, v: 0.7 }] },
      middle: { patterns: [{ type: 'fruit', kind: 'cherry', size: 0.8, color: '#de4e73', v: 0.55 }] },
      ring: { patterns: [{ type: 'aura', color: '#e2a0b0' }, { type: 'fruit', kind: 'cherry', size: 0.6, color: '#d95678', u: 0.5, v: 0.5 }] },
      little: { patterns: [{ type: 'aura', color: '#d985a2', radius: 0.34 }, { type: 'star', color: '#b8aeb7', rx: 0.05, ry: 0.08, u: 0.5, v: 0.3 }] },
    } },
  },
  'navy-daisy': {
    title: 'Navy Daisy', description: 'กรมท่าเงา สลับเดซี่ขาวบนเทาฟ้าและหัวใจบนครีม',
    recipe: { defaults: { base: '#123b57', shape: 'squoval', length: 'medium' }, nails: {
      thumb: { patterns: [] },
      index: { base: '#a5b4c2', patterns: [{ type: 'flower', petal: MILK, center: '#d9c587', size: 0.13, u: 0.46, v: 0.35 }, { type: 'flower', petal: MILK, center: '#d9c587', size: 0.1, u: 0.6, v: 0.68 }] },
      middle: { patterns: [] },
      ring: { base: '#f0e5d6', patterns: [{ type: 'heart', color: '#123b57', size: 0.13 }] },
      little: { patterns: [] },
    } },
  },
  'ink-flames': {
    title: 'Ink Flames', description: 'เปลวไฟดำเส้นพริ้วบนพื้นขาวนม',
    recipe: { defaults: { base: '#f3ede7', shape: 'square', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'flame', color: '#191b21', height: 0.58 }] },
      index: { patterns: [{ type: 'flame', color: '#191b21', height: 0.68 }] },
      middle: { patterns: [{ type: 'flame', color: '#191b21', height: 0.63 }] },
      ring: { patterns: [{ type: 'flame', color: '#191b21', height: 0.7 }] },
      little: { patterns: [{ type: 'flame', color: '#191b21', height: 0.5 }] },
    } },
  },
  'champagne-cherry': {
    title: 'Champagne Cherry', description: 'เชอร์รีสีเงิน บลัชชมพู จุดน้ำตาล และผิวแม่เหล็กแชมเปญ',
    recipe: { defaults: { base: '#e8ddd0', shape: 'round', length: 'medium' }, nails: {
      thumb: { patterns: [{ type: 'fruit', kind: 'cherry', color: '#b4aaa3', stem: '#896241', size: 0.85 }], decorations: [{ catalogId: 'pearl-single', color: '#d5cbc0', u: 0.415, v: 0.585, scale: 0.72 }, { catalogId: 'pearl-single', color: '#d5cbc0', u: 0.602, v: 0.602, scale: 0.72 }] },
      index: { patterns: [{ type: 'aura', color: '#c7959e', radius: 0.35, strength: 0.75 }] },
      middle: { base: '#bba9a0', finish: 'cat_eye', patterns: [{ type: 'cat_eye', color: '#eee1ce' }] },
      ring: { patterns: [{ type: 'dots', color: '#8b644c', size: 0.024, spacing: 0.25 }] },
      little: { base: '#bba9a0', finish: 'cat_eye', patterns: [{ type: 'cat_eye', color: '#eee1ce', angle: 25 }] },
    } },
  },
}
