import { createHash } from 'node:crypto'
import { createCanvas } from '@napi-rs/canvas'
import { describe, expect, it } from 'vitest'
import { buildFromRecipe, PRESETS, renderPattern, type PatternSpec } from '@nail-studio/patterns'
import { renderLayer, type Ctx2D } from '../../web/src/3d/painting/rasterizer.ts'

/** นับชิ้นที่มองเห็นบนภาพจริงด้วย flood fill 8 ทิศทาง: O(จำนวนพิกเซล) */
function components(data: Uint8ClampedArray, size: number): number {
  const seen = new Uint8Array(size * size)
  const queue = new Int32Array(size * size)
  let count = 0
  for (let start = 0; start < seen.length; start++) {
    if (seen[start] || data[start * 4 + 3]! < 16) continue
    let head = 0
    let tail = 1
    queue[0] = start
    seen[start] = 1
    while (head < tail) {
      const index = queue[head++]!
      const x = index % size
      const y = Math.floor(index / size)
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= size || ny < 0 || ny >= size) continue
          const next = ny * size + nx
          if (seen[next] || data[next * 4 + 3]! < 16) continue
          seen[next] = 1
          queue[tail++] = next
        }
      }
    }
    count++
  }
  return count
}

describe('pattern rendering', () => {
  it('preset ทั้งชุดอยู่ภายในเพดาน body 4MB ของ API', () => {
    for (const [id, preset] of Object.entries(PRESETS)) {
      const { document } = buildFromRecipe(preset.recipe)
      expect(Buffer.byteLength(JSON.stringify({ document, expectedVersion: 1 })), id).toBeLessThan(4_000_000)
    }
  })
  for (const flip of [false, true]) {
    for (const accent of [undefined, '#bc9c57']) {
      it(`ใบเถาทุกใบต่อกับก้านบนภาพจริง (flip=${flip}, accent=${accent})`, () => {
        const { document } = buildFromRecipe({
          nails: { 'right.index': { patterns: [{ type: 'vine', stem: '#3d6551', leaf: '#54816a', flip, ...(accent ? { accent } : {}) }] } },
        })
        const nail = document.nails['right.index']
        const size = 512
        const canvas = createCanvas(size, size)
        const ctx = canvas.getContext('2d')
        const strokes = nail.layers.flatMap((l) => l.strokes)
          .map((s) => s.kind === 'fill' ? s : { ...s, size: s.size * size / 1024 })
        renderLayer(ctx as unknown as Ctx2D, { ...nail.layers[0]!, strokes }, size)
        expect(components(ctx.getImageData(0, 0, size, size).data, size)).toBe(1)
      })
    }
  }
})

describe('legacy pattern compatibility', () => {
  const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  it('preserves every legacy default stroke byte for byte', () => {
    const cases: [PatternSpec, string][] = [
      [{ type: 'french', color: '#ffffff' }, '37e0b8aaceb5c55859fd384dfeab3b353db30a87f223aae0229c47947190be39'],
      [{ type: 'aura', color: '#ec6f86' }, '07d4f78f58378bcabd99700997575978fab8baf10b2b46394b6153336dba738a'],
      [{ type: 'cat_eye' }, '27a38a223e457b20aec57380911d982efd09eae708ff53307c700666c224fc02'],
    ]
    for (const [spec, hash] of cases) expect(digest(renderPattern(spec)), spec.type).toBe(hash)
    const presets = {
      'graphic-french': 'd39458ff0229c55f580834fe17c1b3f709c91689f0ff9ef0f197f7a9b2d71219',
      'cherry-blush': '87ba391f42cf21164398958a46ab9f52142f1519a7936a73bf1e174e8feee5de',
      'champagne-cherry': '287affd33b5640c73599f71953d9cf0d2de11cb7d11eb115750c59f3cb159aa1',
    }
    for (const [id, hash] of Object.entries(presets)) expect(digest(buildFromRecipe(PRESETS[id]!.recipe).document.nails), id).toBe(hash)
  })
})

// Captured before repair loop 1: compare the entire document, not just visible nails.
describe('untouched preset output compatibility', () => {
  it('preserves all 27 other preset documents byte for byte', () => {
    const baseline = {
    'cloud-sky': '5acdfee940eb137f72e2d4bca9a2e9330156781bf07300aff4e47342fe0d698f',
    'champagne-quilt': '3c78cd135c452461507424e502d73086da132015f1d8bc44d673bc33ddd549bd',
    'pink-polka-pearl': '55f89dc22995a427ddf5c43ad6d9d6a61e313bd05fac11d31c85c3be64d568d7',
    'burgundy-ribbon': 'b460178147bb294edcad4c36ed77b7333e9b1d5037c5a6716c596423bd30c926',
    'ruby-crystal-ombre': '424274a9ac2fd7daa4632655a3acf43c353a8dc0e622fc71eededd6f4953ef7c',
    'pearl-heart-french': 'd31060fd39ee64958ed87163def77b27f193e569c85d1cafc5d7777be0084c27',
    'red-gold-french': 'e83faf994eb895561e929bf4f685531990494ef25ab9d73554307837585c4b70',
    'pastel-picnic': '7d0cad3dec915869b5cfea6313f7e7d5682fe0f22324fd119b7a239713699d0a',
    'vanilla-sprinkle': 'fb0e318c8971227eaf2097acdcb3914da40153b9d9650c1a87afa0660e1a2df4',
    'latte-polka-french': 'ed625faf5d28b0d4d699602b5ac4dc2f4f8975135bb57caf9b25ed11baa6c0b7',
    'playful-doodles': '65a25232b3aabf2286e36bb0e3f9e71d7b18c282306cdfdf9d67475b3551e3e7',
    'midnight-haunt': '197718db2c6c41586d623da40e06c6756441c6789f3e456d21e0e3e1e57ebe7a',
    'graphic-french': 'e65333ad15eca69758429ac9d19864767ee2e333b008fe21ddfcb574558103cd',
    'cherry-blush': '38942757b60d1cee50c41b9e73bade48d1f43b479c27cd9c9e8a7e3bb46c473f',
    'navy-daisy': '3b19a6a885cb8ba3d52ccce4ce61b73578ec8bf723586a5ad0e3df8d5973dd3e',
    'ink-flames': 'b913ef5d39a519b67b0db36570f1692ac4c5e663e70f906712364268d98b093a',
    'champagne-cherry': 'd2decef8c59aa144b627d3070280322dbb8655711531cc13fe0e239ef6d6ec4e',
    'glazed-pearl': '6a71c1475d57adb9b15d78e8e4057861033d4fa50ca17d9bcab135a7640ea48b',
    'rose-gold-glitter': 'b861ccd6bf9114a83087c6ecc987f182bd8aa94f43800b85ae03971a145b7422',
    'pastel-botanical': 'e63d7e040a0507d815941452bc6b5f1c61b3a9ed5c973f0292e1119ccfb2ecbe',
    'bridal-pearl-bow': 'f58155cf203508fed50046d0fdf351af946fe7cffdd4103ce6f53f0dd2c6dc08',
    'emerald-swirl': '8bb1fb5f77e2ae5b0cc0093e7b9d62971a13fa85e580d8745b1b492edd47bf22',
    'polka-duo': '829f936a275a12f85353775f2545a6557c65bcf1b872267ce7fea88b13f4dafb',
    'peach-blush-vine': '047f7a18260e55f38b984f4a96e8017b318dc04b23ad51b1b3eda0a109e31d27',
    'tortoise-turquoise': '8ec8aab18116923d8753d5083cf021cf4e46bdb9931608daf03959c90d7790ca',
    'fruit-garden': '4dccb30291edf7d89bc7ba509d977f1fa2a870d581212d37b17be8c04aa55f61',
    'lavender-butterfly': 'b7ff971060583d0e249c03c3b5007b5c2049f80005732a0ce6ccfee0e6025ade'
}
    expect(Object.keys(baseline)).toHaveLength(27)
    for (const [id, hash] of Object.entries(baseline)) {
      const document = buildFromRecipe(PRESETS[id]!.recipe).document
      expect(createHash('sha256').update(JSON.stringify(document)).digest('hex'), id).toBe(hash)
    }
  })
})
