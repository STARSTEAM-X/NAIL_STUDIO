import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { createRequire } from 'node:module'
import { FINGERS } from '../packages/contracts/src/index.ts'
import { PRESETS, buildFromRecipe } from '../packages/patterns/src/index.ts'
import { REFERENCE_PRESETS } from '../packages/patterns/src/referencePresets.ts'
import { LUXURY_PRESETS } from '../packages/patterns/src/luxuryPresets.ts'
import { renderPreviewPng } from '../apps/mcp/src/render.ts'

// ใช้ renderer และ canvas ตัวเดียวกับ MCP; ไม่ต้องติดตั้ง dependency เพิ่ม
const require = createRequire(new URL('../apps/mcp/package.json', import.meta.url))
const { createCanvas, loadImage } = require('@napi-rs/canvas')
const out = resolve(process.argv[2] ?? 'test-results/pattern-catalog')
await mkdir(out, { recursive: true })

const pages = []
const entries = Object.entries({ ...REFERENCE_PRESETS, ...LUXURY_PRESETS })
for (let start = 0; start < entries.length; start += 4) {
  const group = entries.slice(start, start + 4)
  const canvas = createCanvas(1000, group.length * 272)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#f4efec'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let i = 0; i < group.length; i++) {
    const [id, preset] = group[i]
    const document = buildFromRecipe(preset.recipe).document
    const png = renderPreviewPng(document)
    await writeFile(join(out, `${id}.png`), png)
    ctx.drawImage(await loadImage(png), 0, 0, 1000, 194, 0, i * 272 + 40, 1000, 194)
    ctx.fillStyle = '#443b35'
    ctx.font = 'bold 20px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(`${start + i + 1}. ${preset.title}`, 20, i * 272 + 28)
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    FINGERS.forEach((f, j) => ctx.fillText(document.nails[`right.${f}`].finish, j * 200 + 100, i * 272 + 252))
  }
  const name = `reference-sets-${Math.floor(start / 4) + 1}.png`
  await writeFile(join(out, name), canvas.toBuffer('image/png'))
  pages.push(name)
}

const groups = [
  [{ type: 'gold_vein' }, { type: 'malachite' }, { type: 'glitter_line' }, { type: 'bead_line', curl: 0.6 }, { type: 'gold_vein', region: 'edge', veins: 1, tipCluster: 0.8 }],
  [{ type: 'french', color: '#0e0e12', style: 'almond', depth: 0.12, smile: 0.1, border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.018 }, { type: 'french', color: '#0e0e12', style: 'swoop', border: '#d4ab52', borderStyle: 'glitter', borderWidth: 0.018 }, { type: 'cat_eye', core: 0.8, shimmer: 0.8, width: 0.12 }, { type: 'aura', color: '#ec6f86', inner: '#f39a62', aspect: 1.8, radius: 0.36, strength: 0.95 }, { type: 'bead_line', color: '#cbd0d6' }],
  [{ type: 'bow', color: '#8f273d' }, { type: 'bow', color: '#d6c5a5', style: 'silk' }, { type: 'cloud' }, { type: 'rainbow' }, { type: 'constellation', orbit: true }],
  [{ type: 'quilt' }, { type: 'aura', color: '#c96891' }, { type: 'cat_eye' }, { type: 'wavy_tip', color: '#fff3cc', border: '#8f273d' }, { type: 'sprinkles', colors: ['#8f273d', '#9dcbd3', '#d4b86a'], to: 1 }],
  [{ type: 'checkerboard', color: '#53685f' }, { type: 'checkerboard', color: '#5d4c53', style: 'sketch', size: 0.25 }, { type: 'smiley', color: '#4c9ccd', hair: true }, { type: 'squiggle', color: '#dda34e' }, { type: 'flower', petal: '#df4c81', center: '#e4b157', style: 'outline' }],
  [{ type: 'ghost' }, { type: 'skull' }, { type: 'spiderweb' }, { type: 'flame', color: '#25242c' }, { type: 'bunny' }],
  [{ type: 'cat' }, { type: 'french', color: '#25242c', style: 'chevron' }, { type: 'french', color: '#25242c', style: 'diagonal' }, { type: 'french', color: '#25242c', style: 'reverse' }, { type: 'french', color: '#c5ad76', outlineOnly: true, depth: 0.3, smile: 0.1 }],
  [{ type: 'marble' }, { type: 'foil' }, { type: 'floral_spray', size: 0.29 }, { type: 'flower', petal: '#e6c8d5', center: '#c7a65b' }, { type: 'aura', color: '#da967b' }],
]
const canvas = createCanvas(1000, groups.length * 260)
const ctx = canvas.getContext('2d')
ctx.fillStyle = '#f4efec'; ctx.fillRect(0, 0, canvas.width, canvas.height)
for (let i = 0; i < groups.length; i++) {
  const nails = Object.fromEntries(groups[i].map((pattern, j) => [FINGERS[j], {
    base: ['ghost', 'skull', 'spiderweb', 'constellation'].includes(pattern.type) ? '#292630' : ['marble', 'malachite'].includes(pattern.type) ? '#0b3e32' : pattern.type === 'cat_eye' ? '#ac9d94' : '#e7c8ba', patterns: [pattern],
  }]))
  const png = renderPreviewPng(buildFromRecipe({ nails }).document)
  ctx.drawImage(await loadImage(png), 0, 0, 1000, 194, 0, i * 260 + 10, 1000, 194)
  ctx.fillStyle = '#443b35'; ctx.font = '16px sans-serif'; ctx.textAlign = 'center'
  groups[i].forEach((p, j) => ctx.fillText(`${p.type}${p.style ? ` (${p.style})` : p.outlineOnly ? ' (outline)' : ''}`, j * 200 + 100, i * 260 + 233))
}
await writeFile(join(out, 'new-patterns.png'), canvas.toBuffer('image/png'))
// Optional local reference photos: keep the visual comparison reproducible in one command.
const luxuryIds = ['emerald-marble-foil', 'black-gold-couture', 'peach-blush', 'plum-cat-eye', 'bridal-crystal-lace']
let comparisonAvailable = true
const references = []
for (const id of luxuryIds) {
  try { references.push(await loadImage(await readFile(new URL('../test-results/reference/' + id + '.webp', import.meta.url)))) }
  catch (error) { if (error.code !== 'ENOENT') throw error; comparisonAvailable = false; break }
}
if (comparisonAvailable) {
  const comparison = createCanvas(1460, luxuryIds.length * 420)
  const context = comparison.getContext('2d')
  context.fillStyle = '#f4efec'
  context.fillRect(0, 0, comparison.width, comparison.height)
  for (let i = 0; i < luxuryIds.length; i++) {
    const id = luxuryIds[i]
    context.drawImage(references[i], 0, i * 420, 410, 410)
    context.drawImage(await loadImage(await readFile(join(out, id + '.png'))), 430, i * 420 + 80, 1000, 234)
    context.fillStyle = '#443b35'
    context.font = '24px sans-serif'
    context.fillText(id, 450, i * 420 + 50)
    context.font = '15px sans-serif'
    context.fillText('Flat texture preview; raised gems are position markers', 450, i * 420 + 350)
  }
  await writeFile(join(out, 'luxury-reference-comparison.png'), comparison.toBuffer('image/png'))
}
const html = `<!doctype html><html lang="th"><meta charset="utf-8"><title>Nail Studio reference review</title>
<style>body{margin:32px auto;max-width:1040px;padding:0 16px;background:#f4efec;color:#443b35;font:16px system-ui}img{width:100%;height:auto;border-radius:14px}h1{font-size:28px}a{color:#7b3d55}section{margin:32px 0}</style>
<h1>Nail Studio — reference patterns</h1><p>Flat texture previews from the real rasterizer. Pearl, cat-eye reflections and raised decorations require the 3D review.</p>
${comparisonAvailable ? '<section><h2>Luxury photo comparison</h2><img src="luxury-reference-comparison.png"></section>' : ''}
<section><h2>New patterns and French variants</h2><img src="new-patterns.png"></section>
${pages.map((name) => `<section><img src="${name}"></section>`).join('\n')}
<p>${Object.keys(PRESETS).length} presets available through list_presets.</p></html>`
await writeFile(join(out, 'index.html'), html)
console.log(`Saved new patterns and ${entries.length} reference sets to ${out}`)
