import { useCallback, useEffect, useRef, useState } from 'react'
import type { DesignDocument } from '@nail-studio/contracts'
import { useDesignStoreApi } from './DesignStoreProvider.tsx'
import { indexedDbDraftStore } from './offlineDraft.ts'
import type { OfflineDraftRecord, OfflineDraftStore } from './offlineDraft.ts'

export const OFFLINE_DRAFT_WARNING = 'ไม่สามารถสำรองข้อมูลในเครื่องได้ งานยังบันทึกบนเซิร์ฟเวอร์ตามปกติ'
export const OFFLINE_DRAFT_DELAY_MS = 1000

interface CreateOfflineDraftPersistenceInput {
  store: OfflineDraftStore
  userId: string
  projectId: string
  delayMs?: number
  now?: () => Date
  onWarning?: (warning: string) => void
}

export function createOfflineDraftPersistence({
  store,
  userId,
  projectId,
  delayMs = OFFLINE_DRAFT_DELAY_MS,
  now = () => new Date(),
  onWarning = () => undefined,
}: CreateOfflineDraftPersistenceInput) {
  let timer: ReturnType<typeof setTimeout> | null = null

  return {
    schedule(document: DesignDocument, baseVersion: number, revision: number) {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        void store.put({
          key: `${userId}:${projectId}`,
          userId,
          projectId,
          document,
          baseVersion,
          revision,
          updatedAt: now().toISOString(),
        }).catch(() => onWarning(OFFLINE_DRAFT_WARNING))
      }, delayMs)
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}

export interface ServerDraftMarker {
  baseVersion: number
  updatedAt: string
}

export function isOfflineDraftNewer(
  record: OfflineDraftRecord,
  server: ServerDraftMarker,
): boolean {
  return record.baseVersion === server.baseVersion && record.updatedAt > server.updatedAt
}

interface InspectOfflineDraftInput {
  store: OfflineDraftStore
  userId: string
  projectId: string
  server: ServerDraftMarker
}

export async function inspectOfflineDraft({
  store,
  userId,
  projectId,
  server,
}: InspectOfflineDraftInput): Promise<{ record: OfflineDraftRecord | null; warning: string | null }> {
  try {
    const record = await store.get(userId, projectId)
    return {
      record: record && isOfflineDraftNewer(record, server) ? record : null,
      warning: null,
    }
  } catch {
    return { record: null, warning: OFFLINE_DRAFT_WARNING }
  }
}

export type OfflineDraftChoice = 'recover-local' | 'use-server'

interface ApplyOfflineDraftChoiceInput {
  choice: OfflineDraftChoice
  store: OfflineDraftStore
  record: OfflineDraftRecord
  serverDocument: DesignDocument
  loadDocument: (document: DesignDocument) => void
}

export async function applyOfflineDraftChoice({
  choice,
  store,
  record,
  serverDocument,
  loadDocument,
}: ApplyOfflineDraftChoiceInput): Promise<{ warning: string | null }> {
  if (choice === 'recover-local') {
    loadDocument(record.document)
    return { warning: null }
  }

  let warning: string | null = null
  try {
    await store.delete(record.userId, record.projectId)
  } catch {
    warning = OFFLINE_DRAFT_WARNING
  }
  loadDocument(serverDocument)
  return { warning }
}

interface UseOfflineDraftInput {
  userId: string | null
  projectId: string
  baseVersion: number
  serverDocument: DesignDocument
  serverUpdatedAt: string
  draftStore?: OfflineDraftStore
}

export interface OfflineDraftResult {
  recoveryRecord: OfflineDraftRecord | null
  warning: string | null
  recoverLocal: () => void
  useServerDocument: (document?: DesignDocument) => Promise<void>
  dismissWarning: () => void
}

export function useOfflineDraft({
  userId,
  projectId,
  baseVersion,
  serverDocument,
  serverUpdatedAt,
  draftStore = indexedDbDraftStore,
}: UseOfflineDraftInput): OfflineDraftResult {
  const designStore = useDesignStoreApi()
  const [recoveryRecord, setRecoveryRecord] = useState<OfflineDraftRecord | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const suppressNextRevision = useRef(false)

  useEffect(() => {
    if (!userId) return
    let active = true
    void inspectOfflineDraft({
      store: draftStore,
      userId,
      projectId,
      server: { baseVersion, updatedAt: serverUpdatedAt },
    }).then((result) => {
      if (!active) return
      setRecoveryRecord(result.record)
      if (result.warning) setWarning(result.warning)
    })
    return () => { active = false }
  }, [baseVersion, draftStore, projectId, serverUpdatedAt, userId])

  useEffect(() => {
    if (!userId) return
    const persistence = createOfflineDraftPersistence({
      store: draftStore,
      userId,
      projectId,
      onWarning: setWarning,
    })
    const unsubscribe = designStore.subscribe((state, previous) => {
      if (state.revision === previous.revision) return
      if (suppressNextRevision.current) {
        suppressNextRevision.current = false
        return
      }
      persistence.schedule(state.document, baseVersion, state.revision)
    })
    return () => {
      unsubscribe()
      persistence.cancel()
    }
  }, [baseVersion, designStore, draftStore, projectId, userId])

  const recoverLocal = useCallback(() => {
    if (!recoveryRecord) return
    designStore.getState().loadDocument(recoveryRecord.document)
    setRecoveryRecord(null)
  }, [designStore, recoveryRecord])

  const useServerDocument = useCallback(async (document = serverDocument) => {
    if (!userId) {
      suppressNextRevision.current = true
      designStore.getState().loadDocument(document)
      setRecoveryRecord(null)
      return
    }
    const record = recoveryRecord ?? {
      key: `${userId}:${projectId}`,
      userId,
      projectId,
      document,
      baseVersion,
      revision: designStore.getState().revision,
      updatedAt: serverUpdatedAt,
    }
    suppressNextRevision.current = true
    const result = await applyOfflineDraftChoice({
      choice: 'use-server',
      store: draftStore,
      record,
      serverDocument: document,
      loadDocument: designStore.getState().loadDocument,
    })
    if (result.warning) setWarning(result.warning)
    setRecoveryRecord(null)
  }, [
    baseVersion,
    designStore,
    draftStore,
    projectId,
    recoveryRecord,
    serverDocument,
    serverUpdatedAt,
    userId,
  ])

  return {
    recoveryRecord,
    warning,
    recoverLocal,
    useServerDocument,
    dismissWarning: () => setWarning(null),
  }
}
