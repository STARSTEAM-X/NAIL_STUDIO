import type { Recipe } from './recipe.ts'

const PINK = '#d9b1ad'
const CREAM = '#fff9ef'

/** ภาพอ้างอิงชุดที่สอง: ผิวมุก โรสโกลด์ กิ่งดอกไม้ ฟอยล์ และงานเจ้าสาว */
export const LUXURY_PRESETS: Record<string, { title: string; description: string; recipe: Recipe }> = {
  'glazed-pearl': {
    title: 'Glazed Pearl', description: 'มุกชมพูเหลือบอุ่นบนทรงอัลมอนด์',
    recipe: { defaults: { base: '#e2c4bc', shape: 'almond', length: 'long', finish: 'pearl' }, nails: {
      thumb: { patterns: [{ type: 'gradient', color: '#f1e8dc', reach: 0.7, strength: 0.45 }] },
      index: { patterns: [{ type: 'gradient', color: '#f1e8dc', reach: 0.7, strength: 0.45 }] },
      middle: { patterns: [{ type: 'gradient', color: '#f1e8dc', reach: 0.7, strength: 0.45 }] },
      ring: { patterns: [{ type: 'gradient', color: '#f1e8dc', reach: 0.7, strength: 0.45 }] },
      little: { patterns: [{ type: 'gradient', color: '#f1e8dc', reach: 0.7, strength: 0.45 }] },
    } },
  },
  'rose-gold-glitter': {
    title: 'Rose Gold Glitter', description: 'กลิตเตอร์โรสโกลด์ไล่จากปลายพร้อมช่อคริสตัล',
    recipe: { defaults: { base: PINK, shape: 'almond', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'glitter', colors: ['#b87d5e', '#d7a98a', '#f8dfb1', '#fff4de'], haze: '#c79578', density: 0.9, reach: 0.7, size: 0.018, seed: 11 }] },
      index: { patterns: [{ type: 'glitter', colors: ['#b87d5e', '#d7a98a', '#f8dfb1', '#fff4de'], haze: '#c79578', density: 0.9, reach: 0.7, size: 0.018, seed: 12 }] },
      middle: { patterns: [{ type: 'glitter', colors: ['#b87d5e', '#d7a98a', '#f8dfb1', '#fff4de'], haze: '#c79578', density: 0.9, reach: 0.7, size: 0.018, seed: 13 }], decorations: [
        { catalogId: 'gem-emerald', color: '#f4e3d1', u: 0.5, v: 0.58, scale: 0.525, rotation: 0.25 },
        { catalogId: 'gem-round', color: '#f4eee7', u: 0.42, v: 0.72, scale: 0.3 }, { catalogId: 'gem-round', color: '#f4eee7', u: 0.61, v: 0.46, scale: 0.275 },
      ] },
      ring: { patterns: [{ type: 'glitter', colors: ['#b87d5e', '#d7a98a', '#f8dfb1', '#fff4de'], haze: '#c79578', density: 0.9, reach: 0.7, size: 0.018, seed: 14 }] },
      little: { patterns: [{ type: 'glitter', colors: ['#b87d5e', '#d7a98a', '#f8dfb1', '#fff4de'], haze: '#c79578', density: 0.9, reach: 0.7, size: 0.018, seed: 15 }] },
    } },
  },
  'pastel-botanical': {
    title: 'Pastel Botanical', description: 'ช่อดอกไม้กลีบซ้อน กิ่งใบเล็ก บนชมพู ฟ้า และลาเวนเดอร์',
    recipe: { defaults: { base: '#dfb7c6', shape: 'almond', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'floral_spray', size: 0.29, angle: -12 }] },
      index: { base: '#b3c9d9', patterns: [{ type: 'floral_spray', size: 0.29, colors: ['#f9f1e6', '#d4b1d7', '#faf6ec'], angle: 10 }] },
      middle: { base: '#c7b6d7', patterns: [{ type: 'floral_spray', size: 0.28, colors: ['#ceb4e2', '#eee1f4', '#f7e7eb'], angle: -8 }] },
      ring: { patterns: [{ type: 'floral_spray', size: 0.29, colors: ['#f2cada', '#e1a8bf', '#f7e5d9'], angle: 12 }] },
      little: { base: '#b3c9d9', patterns: [{ type: 'floral_spray', size: 0.26, colors: ['#faf5e8', '#e5c2da'], angle: -12 }] },
    } },
  },
  'bridal-pearl-bow': {
    title: 'Bridal Pearl Bow', description: 'เฟรนช์ขาวเส้นยิ้มลึก มุกนูน และโบว์ขาวละเอียด',
    recipe: { defaults: { base: '#ddb8af', shape: 'almond', length: 'long' }, nails: {
      thumb: { patterns: [{ type: 'french', color: CREAM, depth: 0.16, smile: 0.14 }] },
      index: { patterns: [{ type: 'french', color: CREAM, depth: 0.16, smile: 0.14 }], decorations: [{ catalogId: 'pearl-single', u: 0.5, v: 0.67, scale: 0.64 }, { catalogId: 'pearl-single', u: 0.57, v: 0.79, scale: 0.36 }] },
      middle: { patterns: [{ type: 'french', color: CREAM, depth: 0.16, smile: 0.14 }, { type: 'bow', color: CREAM, size: 0.18, v: 0.53 }], decorations: [{ catalogId: 'pearl-single', u: 0.5, v: 0.53, scale: 0.48 }] },
      ring: { patterns: [{ type: 'french', color: CREAM, depth: 0.16, smile: 0.14 }], decorations: [{ catalogId: 'pearl-single', u: 0.47, v: 0.66, scale: 0.6 }, { catalogId: 'pearl-single', u: 0.55, v: 0.78, scale: 0.32 }] },
      little: { patterns: [{ type: 'french', color: CREAM, depth: 0.14, smile: 0.14 }] },
    } },
  },
  'emerald-marble-foil': {
    title: 'Emerald Marble Foil', description: 'ชั้นควันมาลาไคต์เขียวเข้ม เครือข่ายทองและนู้ดขอบฟอยล์',
    recipe: { defaults: { base: '#0c3b2e', shape: 'almond', length: 'long', finish: 'glossy' }, nails: {
      thumb: { patterns: [
        { type: 'malachite', angle: 22, contrast: 0.8, bands: 9, seed: 11 },
        { type: 'gold_vein', veins: 2, branches: 0.65, width: 0.009, flakes: 0.7, angle: -28, seed: 7 },
      ] },
      index: { patterns: [
        { type: 'malachite', angle: 35, contrast: 0.8, bands: 9, seed: 18 },
        { type: 'gold_vein', veins: 3, branches: 0.65, width: 0.009, flakes: 0.7, angle: 32, seed: 16 },
      ] },
      middle: { base: '#dfb4a6', patterns: [
        { type: 'gradient', color: '#fff5ea', reach: 0.4, strength: 0.45 },
        { type: 'gold_vein', region: 'edge', side: 'right', veins: 1, branches: 0.2, width: 0.022, flakes: 1, tipCluster: 1, angle: 24, seed: 35 },
      ] },
      ring: { patterns: [
        { type: 'malachite', angle: -18, contrast: 0.8, bands: 9, seed: 32 },
        { type: 'gold_vein', veins: 2, branches: 0.65, width: 0.009, flakes: 0.7, angle: -45, seed: 34 },
      ] },
      little: { base: '#dfb4a6', patterns: [
        { type: 'gradient', color: '#fff5ea', reach: 0.4, strength: 0.45 },
        { type: 'gold_vein', region: 'edge', side: 'left', veins: 1, branches: 0.2, width: 0.022, flakes: 1, tipCluster: 1, angle: -35, seed: 41 },
      ] },
    } },
  },
  'black-gold-couture': {
    title: 'Black Gold Couture', description: 'ปลายดำเส้นยิ้มลึก ขอบกลิตเตอร์ทอง เส้นตัดและเม็ดทอง',
    recipe: { defaults: { base: '#d9b1ad', shape: 'almond', length: 'long', finish: 'glossy' }, nails: {
      thumb: { patterns: [
        { type: 'french', color: '#0e0e12', style: 'almond', side: 'left', depth: 0.12, smile: 0.105, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.024 },
        { type: 'bead_line', size: 0.019, spacing: 1.8, taper: 0.25, points: [[0.35, 0.5], [0.5, 0.58], [0.65, 0.48]] },
      ], decorations: [
        { catalogId: 'gem-chaton', color: '#f5f2eb', u: 0.5, v: 0.53, scale: 0.6 },
      ] },
      index: { patterns: [
        { type: 'french', color: '#0e0e12', style: 'swoop', side: 'left', depth: 0.28, smile: 0.105, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.024 },
        { type: 'glitter_line', width: 0.024, seed: 35, points: [[0.28, 0.43], [0.5, 0.32], [0.66, 0.07]], density: 1, taper: false },
      ] },
      middle: { patterns: [
        { type: 'french', color: '#0e0e12', style: 'almond', side: 'left', depth: 0.12, smile: 0.105, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.024 },
        { type: 'bead_line', size: 0.019, spacing: 1.8, taper: 0.25, points: [[0.35, 0.5], [0.5, 0.58], [0.65, 0.48]] },
      ], decorations: [
        { catalogId: 'gem-chaton', color: '#f5f2eb', u: 0.5, v: 0.53, scale: 0.6 },
      ] },
      ring: { patterns: [
        { type: 'french', color: '#0e0e12', style: 'swoop', side: 'right', depth: 0.28, smile: 0.105, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.024 },
        { type: 'glitter_line', width: 0.024, seed: 37, points: [[0.72, 0.43], [0.5, 0.32], [0.33999999999999997, 0.07]], density: 1, taper: false },
      ] },
      little: { patterns: [
        { type: 'french', color: '#0e0e12', style: 'almond', side: 'left', depth: 0.12, smile: 0.105, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.024 },
      ] },
    } },
  },
  'peach-blush': {
    title: 'Peach Blush', description: 'บลัชเจลลี่ทรงรียาว ชมพูสลับพีชและชิมเมอร์ละเอียด',
    recipe: { defaults: { base: '#e3a99c', shape: 'almond', length: 'medium', finish: 'glossy' }, nails: {
      thumb: { patterns: [
        { type: 'aura', color: '#df3e70', inner: '#f08054', aspect: 2.1, radius: 0.44, strength: 1, v: 0.48, rotation: -4 },
        { type: 'aura', color: '#df3e70', aspect: 2.1, radius: 0.26, strength: 0.7, v: 0.5, rotation: -4 },
        { type: 'gradient', color: '#ecc4b1', reach: 0.32, strength: 0.25 },
        { type: 'glitter', colors: ['#ffe9d8', '#fff3e6'], coverage: 'full', density: 0.1, size: 0.006, seed: 61 },
      ] },
      index: { patterns: [
        { type: 'aura', color: '#e66073', inner: '#ee8650', aspect: 2.1, radius: 0.44, strength: 1, v: 0.48, rotation: 3 },
        { type: 'aura', color: '#e66073', aspect: 2.1, radius: 0.26, strength: 0.7, v: 0.5, rotation: 3 },
        { type: 'gradient', color: '#ecc4b1', reach: 0.32, strength: 0.25 },
        { type: 'glitter', colors: ['#ffe9d8', '#fff3e6'], coverage: 'full', density: 0.1, size: 0.006, seed: 62 },
      ] },
      middle: { patterns: [
        { type: 'aura', color: '#df3e70', inner: '#f08054', aspect: 2.1, radius: 0.44, strength: 1, v: 0.48, rotation: 0 },
        { type: 'aura', color: '#df3e70', aspect: 2.1, radius: 0.26, strength: 0.7, v: 0.5, rotation: 0 },
        { type: 'gradient', color: '#ecc4b1', reach: 0.32, strength: 0.25 },
        { type: 'glitter', colors: ['#ffe9d8', '#fff3e6'], coverage: 'full', density: 0.1, size: 0.006, seed: 63 },
      ] },
      ring: { patterns: [
        { type: 'aura', color: '#e66073', inner: '#ee8650', aspect: 2.1, radius: 0.44, strength: 1, v: 0.48, rotation: -5 },
        { type: 'aura', color: '#e66073', aspect: 2.1, radius: 0.26, strength: 0.7, v: 0.5, rotation: -5 },
        { type: 'gradient', color: '#ecc4b1', reach: 0.32, strength: 0.25 },
        { type: 'glitter', colors: ['#ffe9d8', '#fff3e6'], coverage: 'full', density: 0.1, size: 0.006, seed: 64 },
      ] },
      little: { patterns: [
        { type: 'aura', color: '#df3e70', inner: '#f08054', aspect: 2.1, radius: 0.44, strength: 1, v: 0.48, rotation: 4 },
        { type: 'aura', color: '#df3e70', aspect: 2.1, radius: 0.26, strength: 0.7, v: 0.5, rotation: 4 },
        { type: 'gradient', color: '#ecc4b1', reach: 0.32, strength: 0.25 },
        { type: 'glitter', colors: ['#ffe9d8', '#fff3e6'], coverage: 'full', density: 0.1, size: 0.006, seed: 65 },
      ] },
    } },
  },
  'plum-cat-eye': {
    title: 'Plum Cat Eye', description: 'พลัมและมอฟ แกนแม่เหล็กคมสว่างพร้อมฝุ่นชิมเมอร์ทั่วเล็บ',
    recipe: { defaults: { base: '#4a2236', shape: 'almond', length: 'long', finish: 'cat_eye' }, nails: {
      thumb: { base: '#4a2236', patterns: [
        { type: 'cat_eye', color: '#c58b9f', glow: '#ffe3e7', core: 0.85, shimmer: 1, width: 0.16, angle: -42, seed: 81 },
      ] },
      index: { base: '#9a6a78', patterns: [
        { type: 'cat_eye', color: '#d7a5b6', glow: '#ffe3e7', core: 0.85, shimmer: 1, width: 0.16, angle: 35, seed: 82 },
      ] },
      middle: { base: '#4a2236', patterns: [
        { type: 'cat_eye', color: '#c58b9f', glow: '#ffe3e7', core: 0.85, shimmer: 1, width: 0.16, angle: -30, seed: 83 },
      ] },
      ring: { base: '#9a6a78', patterns: [
        { type: 'cat_eye', color: '#d7a5b6', glow: '#ffe3e7', core: 0.85, shimmer: 1, width: 0.16, angle: 46, seed: 84 },
      ] },
      little: { base: '#4a2236', patterns: [
        { type: 'cat_eye', color: '#c58b9f', glow: '#ffe3e7', core: 0.85, shimmer: 1, width: 0.16, angle: -22, seed: 85 },
      ] },
    } },
  },
  'bridal-crystal-lace': {
    title: 'Bridal Crystal Lace', description: 'ขาวนมไล่บนชมพูใส ช่อเพชรทรงเรือ มุกและสายลูกปัดเงิน',
    recipe: { defaults: { base: '#dcaaa2', shape: 'almond', length: 'long', finish: 'glossy' }, nails: {
      thumb: { patterns: [
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.32, strength: 1.6 },
        { type: 'glitter', colors: ['#fffdf8', '#b4b9c3', '#e4e6ed'], coverage: 'full', density: 0.22, size: 0.007, seed: 95 },
        { type: 'bead_line', color: '#979eac', size: 0.016, spacing: 1.65, taper: 0.3, curl: 0.9, points: [[0.32, 0.38], [0.72, 0.5], [0.48, 0.75]] },
      ], decorations: [
        { catalogId: 'pearl-single', u: 0.52, v: 0.73, scale: 0.64 },
        { catalogId: 'pearl-single', u: 0.4, v: 0.49, scale: 0.36 },
      ] },
      index: { patterns: [
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.32, strength: 1.6 },
        { type: 'glitter', colors: ['#fffdf8', '#b4b9c3', '#e4e6ed'], coverage: 'full', density: 0.22, size: 0.007, seed: 96 },
      ], decorations: [
        { catalogId: 'gem-chaton', color: '#f5f4f0', u: 0.5, v: 0.59, scale: 0.95 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.5, v: 0.75, rotation: 0, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.6617, v: 0.6394, rotation: 1.2566, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.5999, v: 0.4606, rotation: 2.5133, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.4001, v: 0.4606, rotation: 3.7699, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.3383, v: 0.6394, rotation: 5.0265, scale: 0.55 },
        { catalogId: 'pearl-single', u: 0.36, v: 0.79, scale: 0.44 },
        { catalogId: 'pearl-single', u: 0.64, v: 0.35, scale: 0.4 },
      ] },
      middle: { patterns: [
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.32, strength: 1.6 },
        { type: 'glitter', colors: ['#fffdf8', '#b4b9c3', '#e4e6ed'], coverage: 'full', density: 0.22, size: 0.007, seed: 97 },
      ], decorations: [
        { catalogId: 'gem-chaton', color: '#f5f4f0', u: 0.5, v: 0.6, scale: 0.95 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.5, v: 0.76, rotation: 0, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.6299, v: 0.68, rotation: -1.0472, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.6299, v: 0.52, rotation: -2.0944, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.5, v: 0.44, rotation: -3.1416, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.3701, v: 0.52, rotation: -4.1888, scale: 0.55 },
        { catalogId: 'gem-marquise', color: '#f5f4f0', u: 0.3701, v: 0.68, rotation: -5.236, scale: 0.55 },
        { catalogId: 'pearl-single', u: 0.36, v: 0.8, scale: 0.44 },
        { catalogId: 'pearl-single', u: 0.64, v: 0.36, scale: 0.4 },
      ] },
      ring: { patterns: [
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.32, strength: 1.6 },
        { type: 'glitter', colors: ['#fffdf8', '#b4b9c3', '#e4e6ed'], coverage: 'full', density: 0.22, size: 0.007, seed: 98 },
        { type: 'bead_line', color: '#979eac', size: 0.016, spacing: 1.65, taper: 0.3, curl: 0.9, points: [[0.37, 0.3], [0.78, 0.46], [0.25, 0.64], [0.55, 0.82]] },
      ], decorations: [
        { catalogId: 'pearl-single', u: 0.52, v: 0.73, scale: 0.64 },
        { catalogId: 'pearl-single', u: 0.4, v: 0.49, scale: 0.36 },
      ] },
      little: { patterns: [
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.45, strength: 2 },
        { type: 'gradient', color: '#fbf6f1', reach: 0.32, strength: 1.6 },
        { type: 'glitter', colors: ['#fffdf8', '#b4b9c3', '#e4e6ed'], coverage: 'full', density: 0.22, size: 0.007, seed: 99 },
        { type: 'bead_line', color: '#979eac', size: 0.016, spacing: 1.65, taper: 0.3, curl: 0.9, points: [[0.32, 0.38], [0.72, 0.5], [0.48, 0.75]] },
      ], decorations: [
        { catalogId: 'pearl-single', u: 0.52, v: 0.73, scale: 0.64 },
        { catalogId: 'pearl-single', u: 0.4, v: 0.49, scale: 0.36 },
      ] },
    } },
  },
}
