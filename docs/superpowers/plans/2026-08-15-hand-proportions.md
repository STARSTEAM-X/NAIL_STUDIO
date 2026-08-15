# Hand Proportions + Skin Color Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user adjust hand/finger proportions and skin color from a new UI panel, with changes undoable and decorations staying attached to the nail surface automatically.

**Architecture:** Port `handBones.ts`/`handProportions.ts` from the old reference source (`Source/NailDesine-TEST/src/three/`) into `apps/web/src/3d/models/`, wire two new Commands (`SetSkinToneCommand`, `SetProportionsCommand`) through the existing `designStore`/`HistoryStack` pattern, and apply the bone-scale + skin-color mutation from a new effect hook whenever `document.hand` changes identity. `DecorationInstances` already rebuilds from live `nailMatrix` output, so no decoration code changes are needed.

**Tech Stack:** React 19, react-three-fiber 9 / three.js 0.185, Zustand (vanilla store), TypeScript 7 strict, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-15-hand-proportions-design.md`

## Global Constraints

- `handScale` range: 0.8–1.2. `palmWidth`/`fingerLength`/`fingerWidth` range: 0.7–1.3 (already enforced by `handSettingsSchema` in `packages/contracts/src/design.ts:135-143` — do not change these values).
- Finger-chain root bone names: `Palm` (palm root), `Thumb2`, `Index1`, `Middle1`, `Ring1`, `Pinky1` (finger roots — thumb uses `Thumb2` because `Thumb1` is a leaf sibling, not the chain root).
- Scale is set only at chain roots (`Palm`, the 5 finger roots) — never at every bone in a chain, because three.js scale compounds down the hierarchy.
- `CommandResult.affects` for hand-level commands must be an empty `ReadonlySet<NailKey>` — proportions/skin tone never invalidate nail textures (`useNailTextures.ts` keys its dirty-check off `affects`).
- No component-level (DOM/RTL) tests anywhere in this plan — the repo has no jsdom/RTL setup. All new UI is verified manually on a real browser per Task 9's final step.
- Every task ends with `npm run typecheck` and `npm run test` passing in `apps/web` (run from repo root: `npm run typecheck --workspace=apps/web` / `npm run test --workspace=apps/web`, or `cd apps/web` first — check `package.json` scripts if unsure).

---

## Task 1: Export `HandSettings` type from contracts

**Files:**
- Modify: `packages/contracts/src/design.ts:135-167` (add type export after `handSettingsSchema`)
- Test: `packages/contracts/src/design.test.ts` (append)

**Interfaces:**
- Produces: `export type HandSettings = z.infer<typeof handSettingsSchema>` — `{ skinTone: string; proportions: { handScale: number; palmWidth: number; fingerLength: number; fingerWidth: number } }`. Re-exported automatically via `packages/contracts/src/index.ts:3` (`export * from './design.ts'`).

- [ ] **Step 1: Write the failing test**

Append to `packages/contracts/src/design.test.ts`:

```ts
import type { HandSettings } from './design.ts'

describe('HandSettings', () => {
  it('อนุมานชนิดตรงกับ schema', () => {
    const settings: HandSettings = {
      skinTone: '#e8bfa0',
      proportions: { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 },
    }
    expect(handSettingsSchema.safeParse(settings).success).toBe(true)
  })
})
```

Also add `handSettingsSchema` to the existing `import { ... } from './design.ts'` line at the top of the test file (it currently imports `NAIL_KEYS, createEmptyDocument, designDocumentSchema` — add `handSettingsSchema`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=@nail-studio/contracts` (or `cd packages/contracts && npx vitest run`)
Expected: FAIL — `HandSettings` is not exported / `handSettingsSchema` not imported.

- [ ] **Step 3: Add the type export**

In `packages/contracts/src/design.ts`, immediately after `export type DesignDocument = z.infer<typeof designDocumentSchema>` (line 167), add:

```ts
export type HandSettings = z.infer<typeof handSettingsSchema>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=@nail-studio/contracts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/design.ts packages/contracts/src/design.test.ts
git commit -m "feat(contracts): export HandSettings type"
```

---

## Task 2: `replaceHand` document-edit helper

**Files:**
- Modify: `apps/web/src/3d/history/commands/documentEdits.ts`

**Interfaces:**
- Consumes: `NO_AFFECTS` (already exported at `documentEdits.ts:14`), `CommandResult` from `../Command.ts`, `HandSettings`/`DesignDocument` from `@nail-studio/contracts`.
- Produces: `export function replaceHand(document: DesignDocument, update: (hand: HandSettings) => HandSettings): CommandResult` — used by Task 3's commands.

There is no standalone test file for `documentEdits.ts` in this codebase (`replaceNail`/`replaceLayer` are only exercised indirectly through command tests) — `replaceHand` is verified the same way in Task 3's command tests. This task just adds the function.

- [ ] **Step 1: Add the import**

In `apps/web/src/3d/history/commands/documentEdits.ts`, change the top import line:

```ts
import type { DesignDocument, HandSettings, Layer, Nail, NailKey } from '@nail-studio/contracts'
```

- [ ] **Step 2: Add `replaceHand`**

Add after `replaceNail` (after line 30, before the `replaceLayer` comment):

```ts
/** แทนที่การตั้งค่ามือ (สัดส่วน/สีผิว) — ไม่กระทบ affects เพราะไม่ทำให้เท็กซ์เจอร์เล็บนิ้วไหน dirty */
export function replaceHand(
  document: DesignDocument,
  update: (hand: HandSettings) => HandSettings,
): CommandResult {
  const current = document.hand
  const next = update(current)
  if (next === current) return { document, affects: NO_AFFECTS }
  return { document: { ...document, hand: next }, affects: NO_AFFECTS }
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck --workspace=apps/web`
Expected: PASS (no test yet exercises this function directly, but it must compile)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/3d/history/commands/documentEdits.ts
git commit -m "feat: add replaceHand document-edit helper"
```

---

## Task 3: `SetSkinToneCommand` and `SetProportionsCommand`

**Files:**
- Create: `apps/web/src/3d/history/commands/handCommands.ts`
- Modify: `apps/web/src/3d/history/commands/commands.test.ts` (append tests)

**Interfaces:**
- Consumes: `replaceHand` from `./documentEdits.ts` (Task 2), `HandSettings` from `@nail-studio/contracts`, `Command`/`CommandResult` from `../Command.ts`.
- Produces:
  - `export class SetSkinToneCommand implements Command` — `constructor(before: string, after: string)`
  - `export class SetProportionsCommand implements Command` — `constructor(before: HandSettings['proportions'], after: HandSettings['proportions'], mergeKey?: string)`
  - Both used by `designStore.ts` in Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/src/3d/history/commands/commands.test.ts`. First add the import (near the other command imports, after the `layerCommands.ts` import block):

```ts
import { SetProportionsCommand, SetSkinToneCommand } from './handCommands.ts'
```

Then add a new `describe` block at the end of the file:

```ts
describe('hand commands', () => {
  it('SetSkinToneCommand: ตั้งสีผิวแล้ว undo กลับค่าเดิม', () => {
    const document = createEmptyDocument()
    const command = new SetSkinToneCommand(document.hand.skinTone, '#4f382f')
    expectRoundTrip(document, command)

    const after = command.do(document).document
    expect(after.hand.skinTone).toBe('#4f382f')
    expect(command.do(document).affects.size).toBe(0)
  })

  it('SetSkinToneCommand: do() คืน document เดิมถ้าค่าไม่เปลี่ยน', () => {
    const document = createEmptyDocument()
    const command = new SetSkinToneCommand(document.hand.skinTone, document.hand.skinTone)
    expect(command.do(document).document).toBe(document)
  })

  it('SetProportionsCommand: ปรับสัดส่วนแล้ว undo กลับค่าเดิม', () => {
    const document = createEmptyDocument()
    const before = document.hand.proportions
    const after = { handScale: 1.1, palmWidth: 1.2, fingerLength: 0.9, fingerWidth: 1 }
    const command = new SetProportionsCommand(before, after)
    expectRoundTrip(document, command)

    const result = command.do(document).document
    expect(result.hand.proportions).toEqual(after)
  })

  it('SetProportionsCommand: merge รวม 2 คำสั่งที่มี mergeKey เดียวกันเป็นรายการเดียว', () => {
    const before = { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 }
    const mid = { handScale: 1, palmWidth: 1.1, fingerLength: 1, fingerWidth: 1 }
    const after = { handScale: 1, palmWidth: 1.2, fingerLength: 1, fingerWidth: 1 }
    const first = new SetProportionsCommand(before, mid, 'hand-proportions')
    const second = new SetProportionsCommand(mid, after, 'hand-proportions')

    const merged = first.merge?.(second)
    expect(merged).toBeInstanceOf(SetProportionsCommand)
    expect((merged as SetProportionsCommand).before).toEqual(before)
    expect((merged as SetProportionsCommand).after).toEqual(after)
  })

  it('SetProportionsCommand: merge คืน null เมื่อ mergeKey ไม่ตรงกัน', () => {
    const proportions = { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 }
    const first = new SetProportionsCommand(proportions, proportions, 'a')
    const second = new SetProportionsCommand(proportions, proportions, 'b')
    expect(first.merge?.(second)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test --workspace=apps/web -- commands.test.ts`
Expected: FAIL — `handCommands.ts` does not exist.

- [ ] **Step 3: Write `handCommands.ts`**

```ts
import type { DesignDocument, HandSettings } from '@nail-studio/contracts'
import type { Command, CommandResult } from '../Command.ts'
import { replaceHand } from './documentEdits.ts'

export class SetSkinToneCommand implements Command {
  readonly label = 'เปลี่ยนสีผิว'
  readonly before: string
  readonly after: string

  constructor(before: string, after: string) {
    this.before = before
    this.after = after
  }

  do(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.skinTone === this.after ? hand : { ...hand, skinTone: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.skinTone === this.before ? hand : { ...hand, skinTone: this.before })
  }
}

export class SetProportionsCommand implements Command {
  readonly label = 'ปรับสัดส่วนมือ'
  readonly before: HandSettings['proportions']
  readonly after: HandSettings['proportions']
  readonly mergeKey?: string

  constructor(
    before: HandSettings['proportions'],
    after: HandSettings['proportions'],
    mergeKey?: string,
  ) {
    this.before = before
    this.after = after
    if (mergeKey !== undefined) this.mergeKey = mergeKey
  }

  do(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.proportions === this.after ? hand : { ...hand, proportions: this.after })
  }

  undo(document: DesignDocument): CommandResult {
    return replaceHand(document, (hand) =>
      hand.proportions === this.before ? hand : { ...hand, proportions: this.before })
  }

  merge(next: Command): Command | null {
    if (!(next instanceof SetProportionsCommand)) return null
    if (this.mergeKey === undefined || next.mergeKey !== this.mergeKey) return null
    return new SetProportionsCommand(this.before, next.after, this.mergeKey)
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test --workspace=apps/web -- commands.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/history/commands/handCommands.ts apps/web/src/3d/history/commands/commands.test.ts
git commit -m "feat: add SetSkinToneCommand and SetProportionsCommand"
```

---

## Task 4: Wire `setSkinTone`/`setProportions` actions into `designStore`

**Files:**
- Modify: `apps/web/src/features/design/designStore.ts`

**Interfaces:**
- Consumes: `SetSkinToneCommand`, `SetProportionsCommand` from `@/3d/history/commands/handCommands.ts` (Task 3).
- Produces: `DesignActions.setSkinTone(hex: string): void` and `DesignActions.setProportions(partial: Partial<HandSettings['proportions']>, mergeKey?: string): void` — consumed by `HandPanel.tsx` in Task 9.

- [ ] **Step 1: Write the failing test**

Create a focused test near the end of `apps/web/src/3d/history/commands/commands.test.ts` is for Commands only — store-level behavior belongs in a store test. Check whether one exists:

Run: `ls apps/web/src/features/design/*.test.ts` (or use the Glob tool) to see if `designStore.test.ts` exists. If it does not, create `apps/web/src/features/design/designStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createDesignStore } from './designStore.ts'

describe('designStore hand actions', () => {
  it('setSkinTone เปลี่ยนสีผิวและบันทึกลง history', () => {
    const store = createDesignStore()
    store.getState().setSkinTone('#4f382f')
    expect(store.getState().document.hand.skinTone).toBe('#4f382f')
    expect(store.getState().history.state().canUndo).toBe(true)

    store.getState().undo()
    expect(store.getState().document.hand.skinTone).toBe('#e8bfa0')
  })

  it('setProportions ปรับเฉพาะฟิลด์ที่ส่งมา คงฟิลด์อื่นไว้', () => {
    const store = createDesignStore()
    store.getState().setProportions({ palmWidth: 1.2 })
    expect(store.getState().document.hand.proportions).toEqual({
      handScale: 1, palmWidth: 1.2, fingerLength: 1, fingerWidth: 1,
    })
  })

  it('setProportions สอง call ที่มี mergeKey เดียวกันรวมเป็น history รายการเดียว', () => {
    const store = createDesignStore()
    store.getState().setProportions({ palmWidth: 1.1 }, 'hand-proportions')
    store.getState().setProportions({ palmWidth: 1.2 }, 'hand-proportions')
    expect(store.getState().document.hand.proportions.palmWidth).toBe(1.2)

    store.getState().undo()
    expect(store.getState().document.hand.proportions.palmWidth).toBe(1)
  })
})
```

If a `designStore.test.ts` file already exists, append the `describe` block to it instead of creating a new file (check its imports first and reuse them).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- designStore.test.ts`
Expected: FAIL — `setSkinTone`/`setProportions` are not functions.

- [ ] **Step 3: Add the actions**

In `apps/web/src/features/design/designStore.ts`:

1. Add to the import block from `@nail-studio/contracts` (around line 6-15): add `type HandSettings` to the named imports.
2. Add the import for the new commands, next to the existing `nailCommands.ts` import block:

```ts
import { SetProportionsCommand, SetSkinToneCommand } from '@/3d/history/commands/handCommands.ts'
```

3. Add to the `DesignActions` interface (after `setBaseColor`, around line 84):

```ts
  setSkinTone: (hex: string) => void
  setProportions: (partial: Partial<HandSettings['proportions']>, mergeKey?: string) => void
```

4. Add the implementations in the store body, after `setBaseColor` (around line 334, before `setMode`):

```ts
      setSkinTone: (hex) => {
        const state = get()
        execute(new SetSkinToneCommand(state.document.hand.skinTone, hex))
      },

      setProportions: (partial, mergeKey) => {
        const state = get()
        const before = state.document.hand.proportions
        const after = { ...before, ...partial }
        execute(new SetProportionsCommand(before, after, mergeKey))
      },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- designStore.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite and typecheck**

Run: `npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web`
Expected: PASS (confirms nothing else broke)

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/design/designStore.ts apps/web/src/features/design/designStore.test.ts
git commit -m "feat: wire setSkinTone and setProportions actions into designStore"
```

---

## Task 5: `handBones.ts` — collect Palm and finger-root bones

**Files:**
- Create: `apps/web/src/3d/models/handBones.ts`
- Test: `apps/web/src/3d/models/handBones.test.ts`

**Interfaces:**
- Consumes: `Bone`, `Object3D` from `three`; `Finger`, `FINGERS` from `@nail-studio/contracts`.
- Produces:
  - `export interface HandBones { palm: Bone; fingerRoots: Record<Finger, Bone> }`
  - `export function collectBones(root: Object3D): HandBones`
  - Consumed by Task 6 (`handProportions.ts`) and Task 7 (`PartsRegistry.ts`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/3d/models/handBones.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Bone, Group } from 'three'
import { collectBones } from './handBones.ts'

const CHAIN_BONE_NAMES = ['Palm', 'Thumb2', 'Index1', 'Middle1', 'Ring1', 'Pinky1']

function makeSkeleton(names: string[]): Group {
  const root = new Group()
  for (const name of names) {
    const bone = new Bone()
    bone.name = name
    root.add(bone)
  }
  return root
}

describe('collectBones', () => {
  it('จับบอร์นครบ 6 ตัว (ฝ่ามือ + รากนิ้ว 5 นิ้ว)', () => {
    const bones = collectBones(makeSkeleton(CHAIN_BONE_NAMES))
    expect(bones.palm.name).toBe('Palm')
    expect(bones.fingerRoots.thumb.name).toBe('Thumb2')
    expect(bones.fingerRoots.index.name).toBe('Index1')
    expect(bones.fingerRoots.middle.name).toBe('Middle1')
    expect(bones.fingerRoots.ring.name).toBe('Ring1')
    expect(bones.fingerRoots.little.name).toBe('Pinky1')
  })

  it('โยนข้อผิดพลาดที่ระบุชื่อบอร์นที่หาย เมื่อขาดบอร์นใดบอร์นหนึ่ง', () => {
    const names = CHAIN_BONE_NAMES.filter((name) => name !== 'Thumb2')
    expect(() => collectBones(makeSkeleton(names))).toThrow(/Thumb2/)
  })

  it('โยนข้อผิดพลาดเมื่อขาดบอร์น Palm', () => {
    const names = CHAIN_BONE_NAMES.filter((name) => name !== 'Palm')
    expect(() => collectBones(makeSkeleton(names))).toThrow(/Palm/)
  })

  it('ไม่สับสนกับ Object3D ธรรมดาที่ชื่อซ้ำกัน (ต้องเป็น Bone จริง)', () => {
    const root = new Group()
    root.name = 'Palm'
    expect(() => collectBones(root)).toThrow(/Palm/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- handBones.test.ts`
Expected: FAIL — `handBones.ts` does not exist.

- [ ] **Step 3: Write `handBones.ts`**

```ts
import { Bone, type Object3D } from 'three'
import { FINGERS, type Finger } from '@nail-studio/contracts'

const PALM_BONE = 'Palm'

/**
 * ชื่อรากของแต่ละ chain นิ้ว — thumb ใช้ Thumb2 ไม่ใช่ Thumb1 เพราะ Thumb1
 * เป็นใบไม้ข้างเคียงใน rig ไม่ใช่รากของ chain จริง (ยกจาก NailDesine-TEST)
 */
const FINGER_CHAIN_ROOTS: Record<Finger, string> = {
  thumb: 'Thumb2',
  index: 'Index1',
  middle: 'Middle1',
  ring: 'Ring1',
  little: 'Pinky1',
}

export interface HandBones {
  palm: Bone
  fingerRoots: Record<Finger, Bone>
}

function findBone(root: Object3D, name: string): Bone {
  let found: Bone | null = null
  root.traverse((object) => {
    if (found) return
    if ((object as Bone).isBone && object.name === name) found = object as Bone
  })
  if (!found) {
    throw new Error(`โมเดลขาดบอร์นชื่อ ${name} — ตรวจไฟล์ hand.glb ว่ายังคง armature ไว้หรือไม่`)
  }
  return found
}

/**
 * เดิน scene หาบอร์นรากของฝ่ามือและแต่ละนิ้ว — ใช้เป็นจุดตั้ง scale สำหรับสไลเดอร์
 * สัดส่วนมือ (handProportions.ts) throw ถ้าหาบอร์นไม่เจอ ตามแพทเทิร์นเดียวกับ
 * buildPartsRegistry ที่ throw เมื่อ mesh เล็บ/ผิวหาย
 */
export function collectBones(root: Object3D): HandBones {
  const palm = findBone(root, PALM_BONE)
  const fingerRoots = Object.fromEntries(
    FINGERS.map((finger) => [finger, findBone(root, FINGER_CHAIN_ROOTS[finger])]),
  ) as Record<Finger, Bone>
  return { palm, fingerRoots }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- handBones.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/models/handBones.ts apps/web/src/3d/models/handBones.test.ts
git commit -m "feat: add collectBones for hand-proportion bone lookup"
```

---

## Task 6: `handProportions.ts` — apply scale and refresh skinned bounds

**Files:**
- Create: `apps/web/src/3d/models/handProportions.ts`
- Test: `apps/web/src/3d/models/handProportions.test.ts`

**Interfaces:**
- Consumes: `HandBones` from `./handBones.ts` (Task 5), `HandSettings` from `@nail-studio/contracts`, `Bone`, `SkinnedMesh` from `three`.
- Produces:
  - `export function applyProportions(bones: HandBones, proportions: HandSettings['proportions']): void`
  - `export function refreshSkinnedBounds(meshes: readonly SkinnedMesh[]): void`
  - Both consumed by Task 8 (`useHandProportions.ts`).

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/3d/models/handProportions.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { Bone, BufferAttribute, BufferGeometry, Skeleton, SkinnedMesh } from 'three'
import type { Finger } from '@nail-studio/contracts'
import type { HandBones } from './handBones.ts'
import { applyProportions, refreshSkinnedBounds } from './handProportions.ts'

const FINGERS: Finger[] = ['thumb', 'index', 'middle', 'ring', 'little']

function makeBones(): HandBones {
  const palm = new Bone()
  palm.name = 'Palm'
  const fingerRoots = Object.fromEntries(FINGERS.map((finger) => {
    const bone = new Bone()
    bone.name = finger
    palm.add(bone)
    return [finger, bone]
  })) as Record<Finger, Bone>
  return { palm, fingerRoots }
}

describe('applyProportions', () => {
  it('ตั้ง scale ของ Palm ตาม palmWidth บนแกน x/z เท่านั้น แกน y คงที่ 1', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1.3, fingerLength: 1, fingerWidth: 1 })
    expect(bones.palm.scale.x).toBeCloseTo(1.3)
    expect(bones.palm.scale.y).toBeCloseTo(1)
    expect(bones.palm.scale.z).toBeCloseTo(1.3)
  })

  it('ตั้ง scale ของรากนิ้วโดยหาร palmWidth ออก เพื่อไม่ให้นิ้วอ้วนขึ้นตามฝ่ามือ', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1.3, fingerLength: 1, fingerWidth: 1 })
    // fingerWidth(1) / palmWidth(1.3) ≈ 0.7692
    expect(bones.fingerRoots.index.scale.x).toBeCloseTo(1 / 1.3, 4)
    expect(bones.fingerRoots.index.scale.z).toBeCloseTo(1 / 1.3, 4)
    expect(bones.fingerRoots.index.scale.y).toBeCloseTo(1)
  })

  it('fingerLength ตั้งเฉพาะแกน y ของรากนิ้ว', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1, fingerLength: 0.85, fingerWidth: 1 })
    expect(bones.fingerRoots.thumb.scale.y).toBeCloseTo(0.85)
    expect(bones.fingerRoots.thumb.scale.x).toBeCloseTo(1)
  })

  it('ค่าตั้งต้นทั้งหมด = 1 ทำให้ scale ทุกบอร์นเป็น 1 (ไม่เปลี่ยนรูป)', () => {
    const bones = makeBones()
    applyProportions(bones, { handScale: 1, palmWidth: 1, fingerLength: 1, fingerWidth: 1 })
    expect(bones.palm.scale.x).toBeCloseTo(1)
    for (const finger of FINGERS) {
      expect(bones.fingerRoots[finger].scale.x).toBeCloseTo(1)
      expect(bones.fingerRoots[finger].scale.y).toBeCloseTo(1)
    }
  })
})

function makeSkinnedMesh(): SkinnedMesh {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3))
  const bone = new Bone()
  const mesh = new SkinnedMesh(geometry)
  mesh.bind(new Skeleton([bone]))
  return mesh
}

describe('refreshSkinnedBounds', () => {
  it('คำนวณ boundingSphere/boundingBox ใหม่ (ไม่ null หลังเรียก)', () => {
    const mesh = makeSkinnedMesh()
    expect(mesh.geometry.boundingSphere).toBeNull()
    expect(mesh.geometry.boundingBox).toBeNull()

    refreshSkinnedBounds([mesh])

    expect(mesh.geometry.boundingSphere).not.toBeNull()
    expect(mesh.geometry.boundingBox).not.toBeNull()
  })

  it('ทำงานกับ mesh หลายตัวในคราวเดียว', () => {
    const meshes = [makeSkinnedMesh(), makeSkinnedMesh()]
    expect(() => refreshSkinnedBounds(meshes)).not.toThrow()
    for (const mesh of meshes) expect(mesh.geometry.boundingSphere).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- handProportions.test.ts`
Expected: FAIL — `handProportions.ts` does not exist.

- [ ] **Step 3: Write `handProportions.ts`**

```ts
import type { SkinnedMesh } from 'three'
import { FINGERS, type HandSettings } from '@nail-studio/contracts'
import type { HandBones } from './handBones.ts'

/**
 * ตั้ง scale เฉพาะที่บอร์นราก (Palm + รากนิ้วแต่ละนิ้ว) เท่านั้น — scale สืบทอด
 * ลงบอร์นลูกอัตโนมัติใน three.js ตั้งทุกข้อต่อจะทบเป็นกำลังสูงขึ้นเรื่อย ๆ
 *
 * fingerWidth หารด้วย palmWidth ออก เพราะบอร์นรากนิ้วเป็นลูกของ Palm ใน
 * hierarchy — ถ้าไม่หารออก การขยาย palmWidth จะทำให้นิ้วอ้วนขึ้นไปด้วยโดยไม่ตั้งใจ
 *
 * สมมติฐาน: rest-pose scale ของ Palm และรากนิ้วทุกตัวใน hand.glb เป็น 1.0 พอดี
 * ฟังก์ชันนี้เขียนทับ scale แบบ absolute ไม่ใช่คูณสะสมจากค่าปัจจุบัน
 */
export function applyProportions(bones: HandBones, proportions: HandSettings['proportions']): void {
  const { palmWidth, fingerLength, fingerWidth } = proportions
  bones.palm.scale.set(palmWidth, 1, palmWidth)
  const fingerScale = fingerWidth / palmWidth
  for (const finger of FINGERS) {
    bones.fingerRoots[finger].scale.set(fingerScale, fingerLength, fingerScale)
  }
}

/**
 * รีเฟรช bounding volume ของ mesh ที่ผูก skeleton หลังสเกลบอร์นเปลี่ยน
 *
 * three.js แคช boundingSphere/boundingBox ไว้ที่ geometry ไม่รู้ตัวว่าบอร์น
 * ขยับ ถ้าไม่เรียกฟังก์ชันนี้ raycast วาดสี (picking.ts) และ frustum culling
 * จะใช้ bounding เดิมที่ผิดไปแล้วเงียบ ๆ ไม่มี error ให้เห็น
 */
export function refreshSkinnedBounds(meshes: readonly SkinnedMesh[]): void {
  for (const mesh of meshes) {
    for (const bone of mesh.skeleton.bones) bone.updateWorldMatrix(true, false)
    mesh.updateMatrixWorld(true)
    mesh.geometry.computeBoundingSphere()
    mesh.geometry.computeBoundingBox()
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- handProportions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/3d/models/handProportions.ts apps/web/src/3d/models/handProportions.test.ts
git commit -m "feat: add applyProportions and refreshSkinnedBounds"
```

---

## Task 7: Add `bones` to `HandParts` / `PartsRegistry`

**Files:**
- Modify: `apps/web/src/3d/models/PartsRegistry.ts`
- Modify: `apps/web/src/3d/models/PartsRegistry.test.ts`

**Interfaces:**
- Consumes: `collectBones`, `HandBones` from `./handBones.ts` (Task 5).
- Produces: `HandParts.bones: HandBones` — consumed by Task 8 (`useHandProportions.ts`).

- [ ] **Step 1: Write the failing test**

In `apps/web/src/3d/models/PartsRegistry.test.ts`, add `Bone` to the three.js import (`import { BufferGeometry, Bone, Group, Mesh, MeshBasicMaterial } from 'three'`), add a helper, and a new test. Insert after the existing `makeHand` helper (after line 24):

```ts
const CHAIN_BONE_NAMES = ['Palm', 'Thumb2', 'Index1', 'Middle1', 'Ring1', 'Pinky1']

function makeHandWithBones(meshNames: string[]): Group {
  const group = makeHand(meshNames)
  for (const name of CHAIN_BONE_NAMES) {
    const bone = new Bone()
    bone.name = name
    group.add(bone)
  }
  return group
}
```

Add this test inside the `describe('buildPartsRegistry', ...)` block, after the last existing `it(...)`:

```ts
  it('เก็บบอร์นฝ่ามือ+รากนิ้วไว้ใน bones สำหรับสไลเดอร์สัดส่วนมือ', () => {
    const registry = buildPartsRegistry(makeHandWithBones(['Hand', ...ALL_NAILS]), 'right')
    expect(registry.bones.palm.name).toBe('Palm')
    expect(registry.bones.fingerRoots.index.name).toBe('Index1')
  })

  it('โยนข้อผิดพลาดเมื่อโมเดลขาดบอร์นที่จำเป็นสำหรับสัดส่วนมือ', () => {
    const hand = makeHand(['Hand', ...ALL_NAILS]) // ไม่มี bones เลย
    expect(() => buildPartsRegistry(hand, 'right')).toThrow(/Palm/)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- PartsRegistry.test.ts`
Expected: FAIL — `registry.bones` is undefined.

- [ ] **Step 3: Update `PartsRegistry.ts`**

In `apps/web/src/3d/models/PartsRegistry.ts`:

1. Add the import: `import { collectBones, type HandBones } from './handBones.ts'`
2. Add `bones: HandBones` to the `HandParts` interface (after `hand: Hand` at line 9):

```ts
export interface HandParts {
  hand: Hand
  bones: HandBones
  nails: Map<NailKey, Mesh>
  nailOf: Map<Object3D, NailKey>
  occluders: Mesh[]
  skin: Mesh
}
```

3. In `buildPartsRegistry`, call `collectBones` and include it in the returned object. Change the final section (lines 62-71) to:

```ts
  if (!skin) {
    throw new Error(`โมเดลขาด mesh ผิวมือชื่อ ${SKIN_MESH_NAME} — ตรวจไฟล์ hand.glb`)
  }
  if (nails.size !== FINGERS.length) {
    const missing = FINGERS.filter((finger) => !nails.has(nailKey(hand, finger)))
    throw new Error(`โมเดลขาด mesh เล็บ: ${missing.map((finger) => `Nail_${finger}`).join(', ')}`)
  }

  const bones = collectBones(root)

  return { hand, bones, nails, nailOf, occluders, skin }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- PartsRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full test suite (this touches a widely-used type)**

Run: `npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web`
Expected: PASS — confirms no other file destructures `HandParts` in a way that breaks.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/3d/models/PartsRegistry.ts apps/web/src/3d/models/PartsRegistry.test.ts
git commit -m "feat: collect hand bones into PartsRegistry"
```

---

## Task 8: `useHandProportions` hook — apply proportions/skin tone on document change

**Files:**
- Create: `apps/web/src/3d/models/useHandProportions.ts`
- Test: `apps/web/src/3d/models/useHandProportions.test.ts`
- Modify: `apps/web/src/3d/scene/DesignScene.tsx`

**Interfaces:**
- Consumes: `applyProportions`, `refreshSkinnedBounds` from `./handProportions.ts` (Task 6); `HandParts` from `./PartsRegistry.ts` (Task 7); `useDesignStoreApi`/`useDesign` from `@/features/design/DesignStoreProvider.tsx`; `HandSettings` from `@nail-studio/contracts`.
- Produces: `export function useHandProportions(parts: HandParts | null): void` — a side-effect-only hook, called from `DesignScene.tsx`.

This hook follows the same subscription style as `useNailTextures.ts` (`store.subscribe`, compare by reference, skip if unchanged) rather than a plain `useEffect` on a Zustand-selected value, because it must run **exactly once per distinct `document.hand` object**, not once per unrelated re-render. The pure "did the reference change and should we apply" decision is extracted into a plain function so it can be unit-tested without mounting React or three.js meshes.

- [ ] **Step 1: Write the failing test (pure logic only)**

Create `apps/web/src/3d/models/useHandProportions.test.ts`. This tests the extracted pure helper `shouldApplyHand`, not the hook itself (hooks need a renderer; the project has no RTL, so keep the decision logic pure and testable per the "no component-level tests" constraint):

```ts
import { describe, expect, it } from 'vitest'
import { createEmptyDocument } from '@nail-studio/contracts'
import { shouldApplyHand } from './useHandProportions.ts'

describe('shouldApplyHand', () => {
  it('คืน true ครั้งแรก (last เป็น undefined)', () => {
    const hand = createEmptyDocument().hand
    expect(shouldApplyHand(hand, undefined)).toBe(true)
  })

  it('คืน false เมื่อ hand เป็น object เดิม (reference เท่ากัน)', () => {
    const hand = createEmptyDocument().hand
    expect(shouldApplyHand(hand, hand)).toBe(false)
  })

  it('คืน true เมื่อ hand เป็นคนละ object แม้ค่าข้างในเท่ากัน', () => {
    const a = createEmptyDocument().hand
    const b = createEmptyDocument().hand
    expect(shouldApplyHand(b, a)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --workspace=apps/web -- useHandProportions.test.ts`
Expected: FAIL — `useHandProportions.ts` does not exist.

- [ ] **Step 3: Write `useHandProportions.ts`**

```ts
import { useEffect } from 'react'
import { MeshStandardMaterial, type SkinnedMesh } from 'three'
import type { HandSettings } from '@nail-studio/contracts'
import { useDesignStoreApi } from '@/features/design/DesignStoreProvider.tsx'
import type { HandParts } from './PartsRegistry.ts'
import { applyProportions, refreshSkinnedBounds } from './handProportions.ts'

/** ตัดสินใจล้วน ๆ ว่าต้อง apply สัดส่วน/สีผิวใหม่ไหม — แยกออกมาให้เทสได้โดยไม่ต้อง mount */
export function shouldApplyHand(current: HandSettings, last: HandSettings | undefined): boolean {
  return current !== last
}

/**
 * ผูกสไลเดอร์สัดส่วนมือ/สีผิวเข้ากับบอร์น+วัสดุจริงของโมเดลที่โหลดอยู่
 *
 * ใช้ store.subscribe ตรง ๆ (ไม่ใช่ useDesign selector) แบบเดียวกับ useNailTextures.ts
 * เพราะต้องรันครั้งเดียวต่อการเปลี่ยน document.hand หนึ่งครั้ง ไม่ใช่ทุก re-render
 * ที่ไม่เกี่ยวข้อง — เทียบด้วย reference ผ่าน shouldApplyHand
 */
export function useHandProportions(parts: HandParts | null): void {
  const store = useDesignStoreApi()

  useEffect(() => {
    if (!parts) return undefined

    let last: HandSettings | undefined

    const apply = (hand: HandSettings): void => {
      if (!shouldApplyHand(hand, last)) return
      applyProportions(parts.bones, hand.proportions)
      if (!(parts.skin.material instanceof MeshStandardMaterial)) {
        throw new Error(
          `วัสดุผิวมือไม่ใช่ MeshStandardMaterial (ได้ ${parts.skin.material.constructor.name}) — ตั้งสีผิวไม่ได้`,
        )
      }
      parts.skin.material.color.set(hand.skinTone)
      const skinnedMeshes = [...parts.nails.values(), parts.skin]
        .filter((mesh): mesh is SkinnedMesh => (mesh as SkinnedMesh).isSkinnedMesh === true)
      refreshSkinnedBounds(skinnedMeshes)
      last = hand
    }

    apply(store.getState().document.hand)
    const unsubscribe = store.subscribe((state) => apply(state.document.hand))
    return unsubscribe
  }, [parts, store])
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --workspace=apps/web -- useHandProportions.test.ts`
Expected: PASS

- [ ] **Step 5: Wire the hook into `DesignScene.tsx`**

In `apps/web/src/3d/scene/DesignScene.tsx`, add the import:

```ts
import { useHandProportions } from '@/3d/models/useHandProportions.ts'
```

Call it inside the component body, before the `return`:

```ts
export function DesignScene({ scale, parts, textures, onReady }: Props) {
  const mode = useDesign((state) => state.mode)
  useHandProportions(parts)
  return (
    <>
```

- [ ] **Step 6: Run full test suite and typecheck**

Run: `npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/3d/models/useHandProportions.ts apps/web/src/3d/models/useHandProportions.test.ts apps/web/src/3d/scene/DesignScene.tsx
git commit -m "feat: apply hand proportions and skin tone from document changes"
```

---

## Task 9: `HandPanel.tsx` UI and toolbar wiring

**Files:**
- Create: `apps/web/src/features/design/HandPanel.tsx`
- Modify: `apps/web/src/features/design/NailEditor.tsx`

**Interfaces:**
- Consumes: `useDesign` from `./DesignStoreProvider.tsx`; `state.document.hand`, `state.setSkinTone`, `state.setProportions` (Task 4).
- Produces: `export function HandPanel()` — a React component, rendered unconditionally in `NailEditor.tsx` (hand settings apply regardless of paint/decorate mode, per design decision D-34 — this is a separate panel, not nested inside `PaintToolbar`/`DecorationPanel`).

No test file for this task — component-level tests are out of scope for this repo (see Global Constraints). Verified manually in Step 4.

- [ ] **Step 1: Write `HandPanel.tsx`**

```tsx
import type { HandSettings } from '@nail-studio/contracts'
import { useDesign } from './DesignStoreProvider.tsx'

const PROPORTION_RANGES: Record<keyof HandSettings['proportions'], { min: number; max: number }> = {
  handScale: { min: 0.8, max: 1.2 },
  palmWidth: { min: 0.7, max: 1.3 },
  fingerLength: { min: 0.7, max: 1.3 },
  fingerWidth: { min: 0.7, max: 1.3 },
}

const PROPORTION_LABELS: Record<keyof HandSettings['proportions'], string> = {
  handScale: 'ขนาดมือ',
  palmWidth: 'ความกว้างฝ่ามือ',
  fingerLength: 'ความยาวนิ้ว',
  fingerWidth: 'ความกว้างนิ้ว',
}

const PROPORTION_KEYS = Object.keys(PROPORTION_RANGES) as Array<keyof HandSettings['proportions']>

/** แผงปรับสัดส่วนมือ + สีผิว — แยกจาก PaintToolbar/DecorationPanel เพราะเป็นการตั้งค่า
 * ระดับ "ทั้งมือ" คนละ scope กับเลเยอร์/ของตกแต่งที่เป็นระดับ "ต่อเล็บ" (D-34) */
export function HandPanel() {
  const proportions = useDesign((state) => state.document.hand.proportions)
  const skinTone = useDesign((state) => state.document.hand.skinTone)
  const setProportions = useDesign((state) => state.setProportions)
  const setSkinTone = useDesign((state) => state.setSkinTone)

  return (
    <aside className="toolbar" aria-label="สัดส่วนมือและสีผิว">
      <h2>มือ</h2>

      <label className="field">
        สีผิว
        <input
          type="color"
          value={skinTone}
          onChange={(event) => setSkinTone(event.target.value)}
        />
      </label>

      {PROPORTION_KEYS.map((key) => {
        const range = PROPORTION_RANGES[key]
        return (
          <label className="field" key={key}>
            {PROPORTION_LABELS[key]} {Math.round(proportions[key] * 100)}%
            <input
              type="range"
              min={range.min}
              max={range.max}
              step={0.01}
              value={proportions[key]}
              onChange={(event) => setProportions(
                { [key]: Number(event.target.value) },
                `hand-proportions:${key}`,
              )}
            />
          </label>
        )
      })}
    </aside>
  )
}
```

- [ ] **Step 2: Wire into `NailEditor.tsx`**

In `apps/web/src/features/design/NailEditor.tsx`:

1. Add the import, next to the `DecorationPanel` import (around line 30):

```ts
import { HandPanel } from './HandPanel.tsx'
```

2. Add `<HandPanel />` in the `editor-body` div, next to `<PaintToolbar />` and `<DecorationPanel />` (around line 207-209):

```tsx
      <div className="editor-body">
        <PaintToolbar />
        <DecorationPanel />
        <HandPanel />
        <div className="viewport">
```

- [ ] **Step 3: Run typecheck and full test suite**

Run: `npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web`
Expected: PASS

- [ ] **Step 4: Manual browser verification (required — see Global Constraints)**

Start the dev server (`npm run dev --workspace=apps/web` or per repo's usual dev command) and open the editor in a browser:

1. Open a project in the editor. Confirm the "มือ" panel appears with a color swatch and 4 sliders.
2. Drag the "สีผิว" color picker to a new color → confirm the hand skin changes color in the 3D view, and nails do **not** change color.
3. Drag "ความกว้างฝ่ามือ" (palmWidth) slider → confirm the hand visibly widens/narrows in real time as you drag.
4. Add a decoration to a nail (switch to "ของตกแต่ง" mode, click a catalog item), switch back, drag "ความยาวนิ้ว" (fingerLength) → confirm the decoration stays attached to the nail surface, not floating or sunk into the mesh.
5. While a decoration is placed, drag a proportion slider, then try picking/painting on a nail (switch to "วาด" mode, click on a nail) → confirm the click still registers on the correct nail (proves `refreshSkinnedBounds` fixed raycasting, not just that nothing crashed).
6. Press Ctrl+Z after dragging a proportion slider → confirm the hand returns to its prior shape in one undo step (not multiple steps for one drag gesture).
7. Press Ctrl+Z after picking a skin color → confirm the skin color reverts.

If any step fails, fix the underlying code before proceeding — do not mark this task done on faith.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/design/HandPanel.tsx apps/web/src/features/design/NailEditor.tsx
git commit -m "feat: add HandPanel UI for hand proportions and skin color"
```

---

## Task 10: Close out Slice 4 item 5 in the implementation plan

**Files:**
- Modify: `docs/implementation-plan.md`

**Interfaces:** None — documentation only.

- [ ] **Step 1: Update the Slice 4 checklist**

In `docs/implementation-plan.md`, find the Slice 4 section (§6, item 5, currently reading `5. สัดส่วนมือ + สีผิว (`handProportions` + `refreshSkinnedBounds`)`). Mark it done and add a status note in the same style as items 1-4 above it (see the `[x]` bullets under item 3/4 for the existing format — a short paragraph describing what shipped, referencing this plan and spec file).

- [ ] **Step 2: Run the full test suite one last time**

Run: `npm run typecheck --workspace=apps/web && npm run test --workspace=apps/web && npm run typecheck --workspace=@nail-studio/contracts && npm run test --workspace=@nail-studio/contracts`
Expected: PASS across both workspaces

- [ ] **Step 3: Commit**

```bash
git add docs/implementation-plan.md
git commit -m "docs: close out hand proportions and skin color (Slice 4 item 5)"
```
