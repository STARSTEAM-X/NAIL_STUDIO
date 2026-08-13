import type { DesignDocument, DuplicateProjectInput } from '@nail-studio/contracts'
import { ApiRequestError } from '@/api/client.ts'

export type ConflictSource = 'explicit-save' | 'autosave'
export type ConflictAction = 'reload-server' | 'duplicate-current'

export interface ServerVersionConflict {
  kind: 'server-version-conflict'
  source: ConflictSource
}

export function conflictStateFromError(
  error: unknown,
  source: ConflictSource,
): ServerVersionConflict | null {
  return error instanceof ApiRequestError && error.status === 409
    ? { kind: 'server-version-conflict', source }
    : null
}

/**
 * Task UI owns its localized context. Backend messages are diagnostic text and may be English,
 * so they must not replace the Thai instruction exposed to the user.
 */
export function localizedTaskError(_error: unknown, thaiContext: string): string {
  return thaiContext
}

interface HistoricalVersionDocument {
  number: number
  document: DesignDocument
}

export function loadHistoricalVersion(
  version: HistoricalVersionDocument,
  latestServerVersion: number,
  loadDocument: (document: DesignDocument) => void,
) {
  loadDocument(version.document)
  return {
    loadedVersion: version.number,
    saveBaseVersion: latestServerVersion,
  }
}

export function buildDuplicateCurrentInput(
  name: string,
  getCurrentDocument: () => DesignDocument,
): DuplicateProjectInput {
  return { name, document: getCurrentDocument() }
}
