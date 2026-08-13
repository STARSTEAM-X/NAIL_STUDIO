import { pathToFileURL } from 'node:url'

const NAIL_KEYS = [
  'left.thumb', 'left.index', 'left.middle', 'left.ring', 'left.little',
  'right.thumb', 'right.index', 'right.middle', 'right.ring', 'right.little',
]
const COMMAND_COUNT = 100

function colorFor(index) {
  return `#${index.toString(16).padStart(6, '0')}`
}

function makeStroke(nailIndex, layerIndex, strokeIndex) {
  return {
    kind: 'brush',
    brush: 'round',
    color: colorFor((nailIndex + 1) * 10_000 + layerIndex * 100 + strokeIndex),
    size: 40 + strokeIndex,
    opacity: 0.85,
    softness: 0.25,
    points: Array.from({ length: 24 }, (_, pointIndex) => ({
      x: pointIndex / 23,
      y: ((nailIndex * 7 + layerIndex * 5 + strokeIndex * 3 + pointIndex) % 24) / 23,
      p: 0.5 + ((pointIndex % 6) / 12),
    })),
  }
}

export function createRepresentativeDocument() {
  return {
    schemaVersion: 2,
    hand: {
      skinTone: '#e8bfa0',
      proportions: { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 },
    },
    nails: Object.fromEntries(NAIL_KEYS.map((key, nailIndex) => [key, {
      shape: 'round',
      length: 'medium',
      finish: 'glossy',
      baseColor: '#ffffff',
      layers: Array.from({ length: 3 }, (_, layerIndex) => ({
        id: `${key}-layer-${layerIndex + 1}`,
        name: `Layer ${layerIndex + 1}`,
        visible: true,
        opacity: 1,
        blend: 'normal',
        strokes: Array.from({ length: 12 }, (_, strokeIndex) =>
          makeStroke(nailIndex, layerIndex, strokeIndex)),
      })),
      decorations: [],
    }])),
    editorSettings: { cameraMode: 'orbit', layout: 'split' },
  }
}

function serializedBytes(value) {
  return Buffer.byteLength(JSON.stringify(value), 'utf8')
}

export function measureHistoryStructures() {
  if (typeof globalThis.gc !== 'function') {
    throw new Error('Run this measurement with node --expose-gc tools/measure-history-memory.mjs')
  }

  globalThis.gc()
  let document = createRepresentativeDocument()
  const snapshots = []
  const commands = []

  for (let index = 1; index <= COMMAND_COUNT; index += 1) {
    const before = document.nails['right.index'].baseColor
    const after = colorFor(index)
    commands.push({ label: 'เปลี่ยนสีเล็บ', key: 'right.index', before, after })
    document = {
      ...document,
      nails: {
        ...document.nails,
        'right.index': { ...document.nails['right.index'], baseColor: after },
      },
    }
    snapshots.push(structuredClone(document))
  }

  globalThis.gc()
  const snapshotBytes = serializedBytes(snapshots)
  const commandBytes = serializedBytes(commands)

  return {
    node: process.version,
    commands: COMMAND_COUNT,
    snapshotBytes,
    commandBytes,
    ratio: Number((snapshotBytes / commandBytes).toFixed(2)),
  }
}

const entryPoint = process.argv[1] === undefined ? undefined : pathToFileURL(process.argv[1]).href
if (entryPoint === import.meta.url) {
  console.log(JSON.stringify(measureHistoryStructures()))
}
