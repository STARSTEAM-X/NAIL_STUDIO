import { describe, expect, it } from 'vitest'
import {
  MAX_DECORATIONS_PER_NAIL,
  NAIL_KEYS,
  createEmptyDocument,
  type Decoration,
  type DesignDocument,
  type Layer,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import { EDITABLE_NAILS } from '@/features/design/designStore.ts'
import type { Command } from '../Command.ts'
import { CompositeCommand } from './CompositeCommand.ts'
import {
  AddDecorationCommand,
  MoveDecorationCommand,
  RemoveDecorationCommand,
  ScaleDecorationCommand,
} from './decorationCommands.ts'
import {
  AddStrokeCommand,
  ClearNailCommand,
  CopyNailCommand,
  SetBaseColorCommand,
  SetFinishCommand,
  SetLengthCommand,
  SetShapeCommand,
} from './nailCommands.ts'
import {
  AddLayerCommand,
  MoveLayerCommand,
  RemoveLayerCommand,
  RenameLayerCommand,
  SetLayerBlendCommand,
  SetLayerOpacityCommand,
  SetLayerVisibilityCommand,
} from './layerCommands.ts'

const RIGHT_INDEX = 'right.index' as NailKey

const STROKE: Stroke = {
  kind: 'brush', brush: 'round', color: '#b5314c',
  size: 100, opacity: 1, softness: 0.25,
  points: [{ x: 0.5, y: 0.5, p: 0.7 }],
}

function layer(id: string, name = id): Layer {
  return { id, name, visible: true, opacity: 1, blend: 'normal', strokes: [] }
}

function withTwoLayers(): DesignDocument {
  const document = createEmptyDocument()
  document.nails[RIGHT_INDEX] = {
    ...document.nails[RIGHT_INDEX],
    layers: [
      { ...document.nails[RIGHT_INDEX].layers[0]!, strokes: [STROKE] },
      layer('layer-2'),
    ],
  }
  return document
}

function expectRoundTrip(document: DesignDocument, command: {
  do: (current: DesignDocument) => { document: DesignDocument }
  undo: (current: DesignDocument) => { document: DesignDocument }
}): void {
  const original = structuredClone(document)
  const changed = command.do(original).document
  expect(command.undo(changed).document).toEqual(original)
}

function markerCommand(marker: string): Command {
  return {
    label: `Add ${marker}`,
    do(document) {
      const baseColor = document.nails[RIGHT_INDEX].baseColor
      return {
        document: {
          ...document,
          nails: {
            ...document.nails,
            [RIGHT_INDEX]: {
              ...document.nails[RIGHT_INDEX],
              baseColor: `${baseColor}${marker}`,
            },
          },
        },
        affects: new Set([RIGHT_INDEX]),
      }
    },
    undo(document) {
      const baseColor = document.nails[RIGHT_INDEX].baseColor
      if (!baseColor.endsWith(marker)) {
        throw new Error(`Expected ${marker} to be the final marker`)
      }
      return {
        document: {
          ...document,
          nails: {
            ...document.nails,
            [RIGHT_INDEX]: {
              ...document.nails[RIGHT_INDEX],
              baseColor: baseColor.slice(0, -marker.length),
            },
          },
        },
        affects: new Set([RIGHT_INDEX]),
      }
    },
  }
}

describe('document commands', () => {
  it('restores a stroke appended to one layer', () => {
    expectRoundTrip(createEmptyDocument(), new AddStrokeCommand(RIGHT_INDEX, 'layer-1', STROKE))
  })

  it('restores a nail base color', () => {
    expectRoundTrip(
      createEmptyDocument(),
      new SetBaseColorCommand(RIGHT_INDEX, '#ffffff', '#112233'),
    )
  })

  it('restores a nail finish', () => {
    expectRoundTrip(createEmptyDocument(), new SetFinishCommand(RIGHT_INDEX, 'glossy', 'chrome'))
  })

  it('restores a nail shape', () => {
    expectRoundTrip(createEmptyDocument(), new SetShapeCommand(RIGHT_INDEX, 'round', 'stiletto'))
  })

  it('restores a nail length', () => {
    expectRoundTrip(createEmptyDocument(), new SetLengthCommand(RIGHT_INDEX, 'medium', 'long'))
  })

  it('restores all cleared strokes from one nail', () => {
    const document = withTwoLayers()
    const strokes = document.nails[RIGHT_INDEX].layers.map((item) => item.strokes)
    expectRoundTrip(document, new ClearNailCommand(RIGHT_INDEX, strokes))
  })

  it('restores a copied target without changing the source or other nails', () => {
    const original = createEmptyDocument()
    original.nails['right.index'] = {
      ...original.nails['right.index'],
      baseColor: '#112233',
      finish: 'chrome',
      layers: [{ ...original.nails['right.index'].layers[0]!, strokes: [STROKE] }],
    }
    original.nails['right.middle'] = {
      ...original.nails['right.middle'],
      baseColor: '#445566',
      finish: 'matte',
    }
    original.nails['left.index'] = {
      ...original.nails['left.index'],
      baseColor: '#778899',
    }
    const sourceBefore = structuredClone(original.nails['right.index'])
    const otherBefore = structuredClone(original.nails['left.index'])
    const command = new CopyNailCommand(
      'right.middle',
      original.nails['right.middle'],
      original.nails['right.index'],
    )

    const changed = command.do(original).document

    expect(changed.nails['right.middle']).toEqual(sourceBefore)
    expect(changed.nails['right.index']).toEqual(sourceBefore)
    expect(changed.nails['left.index']).toEqual(otherBefore)
    expect(command.undo(changed).document).toEqual(original)
  })

  it('restores an inserted layer at its original index', () => {
    expectRoundTrip(createEmptyDocument(), new AddLayerCommand(RIGHT_INDEX, layer('layer-2'), 1))
  })

  it('restores a removed layer at its original index', () => {
    const document = withTwoLayers()
    expectRoundTrip(document, new RemoveLayerCommand(RIGHT_INDEX, layer('layer-2'), 1))
  })

  it('restores a layer name', () => {
    expectRoundTrip(createEmptyDocument(), new RenameLayerCommand(RIGHT_INDEX, 'layer-1', 'เลเยอร์ 1', 'Accent'))
  })

  it('restores a layer visibility setting', () => {
    expectRoundTrip(createEmptyDocument(), new SetLayerVisibilityCommand(RIGHT_INDEX, 'layer-1', true, false))
  })

  it('restores a layer opacity setting', () => {
    expectRoundTrip(createEmptyDocument(), new SetLayerOpacityCommand(RIGHT_INDEX, 'layer-1', 1, 0.4))
  })

  it('restores a layer blend setting', () => {
    expectRoundTrip(createEmptyDocument(), new SetLayerBlendCommand(RIGHT_INDEX, 'layer-1', 'normal', 'screen'))
  })

  it('restores a layer move', () => {
    expectRoundTrip(withTwoLayers(), new MoveLayerCommand(RIGHT_INDEX, 'layer-2', 1, 0))
  })

  it('undoes composite children in reverse order', () => {
    const document = createEmptyDocument()
    const command = new CompositeCommand('Add markers', [
      markerCommand('A'),
      markerCommand('B'),
    ])

    const applied = command.do(document).document
    expect(applied.nails[RIGHT_INDEX].baseColor).toBe('#ffffffAB')
    expect(command.undo(applied).document).toEqual(document)
  })

  it('keeps every left-hand nail unchanged when a bulk command targets editable nails', () => {
    const original = structuredClone(createEmptyDocument())
    const command = new CompositeCommand('Set color for editable nails', EDITABLE_NAILS.map((key) =>
      new SetBaseColorCommand(key, '#ffffff', '#112233'),
    ))

    const changed = command.do(original).document

    for (const key of NAIL_KEYS.filter((key) => key.startsWith('left.'))) {
      expect(changed.nails[key]).toEqual(original.nails[key])
    }
    expect(command.undo(changed).document).toEqual(original)
  })
})

function decoration(id: string, u = 0.5, v = 0.5): Decoration {
  return { id, catalogId: 'gem', u, v, rotation: 0, scale: 0.1 }
}

describe('decoration commands', () => {
  it('adds and removes a decoration, restoring the exact original document', () => {
    const document = createEmptyDocument()
    const deco = decoration('deco-1')
    expectRoundTrip(document, new AddDecorationCommand(RIGHT_INDEX, deco, 0))
  })

  it('does not add a decoration beyond MAX_DECORATIONS_PER_NAIL', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: Array.from({ length: MAX_DECORATIONS_PER_NAIL }, (_, i) => decoration(`d-${i}`)),
    }
    const command = new AddDecorationCommand(RIGHT_INDEX, decoration('overflow'), MAX_DECORATIONS_PER_NAIL)
    const result = command.do(document)
    expect(result.document.nails[RIGHT_INDEX].decorations).toHaveLength(MAX_DECORATIONS_PER_NAIL)
    expect(result.affects.size).toBe(0)
  })

  it('restores a removed decoration at its original index', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a'), decoration('b'), decoration('c')],
    }
    const target = document.nails[RIGHT_INDEX].decorations[1]!
    expectRoundTrip(document, new RemoveDecorationCommand(RIGHT_INDEX, target, 1))
  })

  it('restores decoration position and rotation after a move', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a', 0.3, 0.3)],
    }
    const command = new MoveDecorationCommand(
      RIGHT_INDEX, 'a',
      { u: 0.3, v: 0.3, rotation: 0 },
      { u: 0.6, v: 0.7, rotation: 1.2 },
    )
    expectRoundTrip(document, command)
  })

  it('merges two consecutive moves with the same mergeKey into one before/after pair', () => {
    const first = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.1, v: 0.1, rotation: 0 }, { u: 0.2, v: 0.2, rotation: 0 }, 'drag-1',
    )
    const second = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.2, v: 0.2, rotation: 0 }, { u: 0.3, v: 0.3, rotation: 0 }, 'drag-1',
    )
    const merged = first.merge?.(second) as MoveDecorationCommand | null
    expect(merged).not.toBeNull()
    expect(merged!.before).toEqual({ u: 0.1, v: 0.1, rotation: 0 })
    expect(merged!.after).toEqual({ u: 0.3, v: 0.3, rotation: 0 })
  })

  it('does not merge moves with different mergeKeys', () => {
    const first = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.1, v: 0.1, rotation: 0 }, { u: 0.2, v: 0.2, rotation: 0 }, 'drag-1',
    )
    const second = new MoveDecorationCommand(
      RIGHT_INDEX, 'a', { u: 0.2, v: 0.2, rotation: 0 }, { u: 0.3, v: 0.3, rotation: 0 }, 'drag-2',
    )
    expect(first.merge?.(second)).toBeNull()
  })

  it('restores a decoration scale after resizing', () => {
    const document = createEmptyDocument()
    document.nails[RIGHT_INDEX] = {
      ...document.nails[RIGHT_INDEX],
      decorations: [decoration('a')],
    }
    document.nails[RIGHT_INDEX].decorations[0] = { ...document.nails[RIGHT_INDEX].decorations[0]!, scale: 0.1 }
    expectRoundTrip(document, new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.1, 0.4))
  })

  it('merges two consecutive scale changes with the same mergeKey', () => {
    const first = new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.1, 0.2, 'resize-1')
    const second = new ScaleDecorationCommand(RIGHT_INDEX, 'a', 0.2, 0.3, 'resize-1')
    const merged = first.merge?.(second) as ScaleDecorationCommand | null
    expect(merged).not.toBeNull()
    expect(merged!.before).toBe(0.1)
    expect(merged!.after).toBe(0.3)
  })
})
