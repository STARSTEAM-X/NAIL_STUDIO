import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'

const root = join(process.cwd(), 'apps', 'web', 'dist')

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await filesUnder(path))
    else files.push(path)
  }
  return files
}

const started = performance.now()
const files = await filesUnder(root)
const sizes = await Promise.all(files.map(async (path) => ({ path, bytes: (await stat(path)).size })))
const totalBytes = sizes.reduce((sum, item) => sum + item.bytes, 0)
const largest = sizes.toSorted((a, b) => b.bytes - a.bytes).slice(0, 10).map((item) => ({
  file: relative(process.cwd(), item.path),
  bytes: item.bytes,
}))
console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  distFiles: files.length,
  totalBytes,
  largest,
  scanMs: Math.round(performance.now() - started),
  note: 'Bundle-size baseline only; capture Chrome Performance/renderer.info/heap separately before GPU changes.',
}, null, 2))
