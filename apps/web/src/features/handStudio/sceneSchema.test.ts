import { describe, expect, it } from 'vitest'
import { FINGERS } from '@nail-studio/contracts'
import { createPose, createStudioScene, MAX_SCENE_BYTES, nailTextureSchema, parseStudioJson, POSES, studioSceneSchema, updateNails } from './sceneSchema.ts'
import { commitScene, redoScene, sceneHistory, undoScene } from './sceneHistory.ts'

describe('original hand scene state', () => {
  it('round trips all ten nails, per-hand joints, proportions, decorations and camera', () => {
    let scene = createStudioScene()
    scene.hands.left.enabled = true
    scene.hands.left.pose = createPose('pinch')
    scene.hands.right.pose = createPose('v')
    scene.hands.left.proportions.fingerLengths.ring = 1.12
    scene.scene.camera.position = [.1, .3, .4]
    scene = updateNails(scene, 'left', 'ring', 'nail', { length: .83, shape: 'coffin', finish: 'jelly', decorations: [{ id: 'pearl', type: 'pearl', u: .5, v: .4, scale: 1, rotation: 30, color: '#fffaff' }] })
    scene.presets.poses.push({ name: 'Pinch', value: createPose('pinch') })
    expect(parseStudioJson(JSON.stringify(scene))).toEqual(scene)
  })
  it('edits exactly one nail, one hand, or both hands without mutating originals', () => {
    const scene = createStudioScene()
    const one = updateNails(scene, 'right', 'index', 'nail', { baseColor: '#112233' })
    expect(one.hands.left).toBe(scene.hands.left)
    expect(one.hands.right.nails.middle).toBe(scene.hands.right.nails.middle)
    expect(scene.hands.right.nails.index.baseColor).not.toBe('#112233')
    const hand = updateNails(one, 'left', 'ring', 'hand', { shape: 'square' })
    for (const finger of FINGERS) expect(hand.hands.left.nails[finger].shape).toBe('square')
    expect(hand.hands.right).toBe(one.hands.right)
    const both = updateNails(hand, 'right', 'ring', 'both', { length: .71 })
    for (const side of ['left', 'right'] as const) for (const finger of FINGERS) expect(both.hands[side].nails[finger].length).toBe(.71)
  })
  it('each hand and nail has independent mutable values', () => {
    const scene = createStudioScene()
    scene.hands.left.nails.index.decorations.push({ id: 'gem', type: 'diamond', u: .5, v: .5, scale: 1, rotation: 0, color: '#ffffff' })
    scene.hands.left.pose.joints.index.mcp = 30
    expect(scene.hands.right.pose.joints.index.mcp).toBe(0)
    expect(scene.hands.right.nails.index.decorations).toHaveLength(0)
    expect(scene.hands.left.nails.middle.decorations).toHaveLength(0)
  })
  it('all required poses obey their joint limits and retain the same model ID', () => {
    for (const preset of POSES) {
      const scene = createStudioScene()
      scene.hands.right.pose = createPose(preset)
      expect(studioSceneSchema.safeParse(scene).success, preset).toBe(true)
    }
  })
  it.each([
    (s: ReturnType<typeof createStudioScene>) => { s.hands.right.pose.joints.index.pip = 110 },
    (s: ReturnType<typeof createStudioScene>) => { s.hands.right.pose.joints.thumb.mcp = 70 },
    (s: ReturnType<typeof createStudioScene>) => { s.hands.left.nails.index.length = Infinity },
    (s: ReturnType<typeof createStudioScene>) => { s.hands.left.skin.tone = 'url(secret)' },
    (s: ReturnType<typeof createStudioScene>) => { s.scene.camera.position = [...s.scene.camera.target] },
  ])('rejects invalid external scene values', (mutate) => {
    const scene = createStudioScene(); mutate(scene)
    expect(studioSceneSchema.safeParse(scene).success).toBe(false)
  })
  it('rejects unknown schema/model and oversized JSON before parsing', () => {
    expect(() => parseStudioJson(' '.repeat(MAX_SCENE_BYTES + 1))).toThrow(/2 MB/)
    expect(() => parseStudioJson(JSON.stringify({ ...createStudioScene(), modelId: 'old-hand' }))).toThrow()
    expect(() => parseStudioJson(JSON.stringify({ ...createStudioScene(), schemaVersion: '2.0' }))).toThrow()
  })
  it('validates PNG signatures and dimensions before decoding external textures', () => {
    const header = new Uint8Array(33)
    header.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
    header.set([73, 72, 68, 82], 12)
    header[19] = 1; header[23] = 1
    const encode = () => 'data:image/png;base64,' + btoa(String.fromCharCode(...header))
    expect(nailTextureSchema.safeParse(encode()).success).toBe(true)
    header[16] = 1
    expect(nailTextureSchema.safeParse(encode()).success).toBe(false)
    expect(nailTextureSchema.safeParse('data:image/svg+xml;base64,PHN2Zz4=').success).toBe(false)
  })
})

describe('scene history', () => {
  it('undoes and redoes geometry, decoration and pose together without sharing snapshots', () => {
    const initial = createStudioScene()
    const next = updateNails(initial, 'right', 'ring', 'nail', { shape: 'stiletto', length: 1 })
    next.hands = { ...next.hands, right: { ...next.hands.right, pose: createPose('soft_fist') } }
    const history = commitScene(sceneHistory(initial), next)
    expect(undoScene(history).present).toBe(initial)
    expect(redoScene(undoScene(history)).present).toBe(next)
  })
  it('merges one drag, keeps separate gestures and invalidates the redo branch', () => {
    const a = createStudioScene(), b = structuredClone(a), c = structuredClone(a)
    let history = commitScene(sceneHistory(a), b, 'drag:1')
    history = commitScene(history, c, 'drag:1')
    expect(history.past).toEqual([a])
    history = commitScene(history, structuredClone(a), 'drag:2')
    expect(history.past).toHaveLength(2)
    history = commitScene(undoScene(history), structuredClone(c), 'drag:3')
    expect(history.future).toHaveLength(0)
  })
  it('bounds memory at 60 history snapshots', () => {
    let history = sceneHistory(createStudioScene())
    for (let index = 0; index < 100; index += 1) history = commitScene(history, createStudioScene())
    expect(history.past).toHaveLength(60)
  })
})
