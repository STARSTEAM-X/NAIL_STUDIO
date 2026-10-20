import type { StudioScene } from './sceneSchema.ts'

export interface SceneHistory { past: StudioScene[]; present: StudioScene; future: StudioScene[]; mergeKey: string | undefined }
export function sceneHistory(present: StudioScene): SceneHistory { return { past: [], present, future: [], mergeKey: undefined } }
export function commitScene(history: SceneHistory, present: StudioScene, mergeKey?: string): SceneHistory {
  if (present === history.present) return history
  const merged = mergeKey !== undefined && mergeKey === history.mergeKey && history.future.length === 0
  return { past: merged ? history.past : [...history.past.slice(-59), history.present], present, future: [], mergeKey }
}
export function undoScene(history: SceneHistory): SceneHistory {
  const previous = history.past.at(-1)
  return previous ? { past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future], mergeKey: undefined } : history
}
export function redoScene(history: SceneHistory): SceneHistory {
  const next = history.future[0]
  return next ? { past: [...history.past, history.present], present: next, future: history.future.slice(1), mergeKey: undefined } : history
}
