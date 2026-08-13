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
  let pending: OfflineDraftRecord | null = null
  let versionSavePending = false

  const flush = async () => {
    if (timer) clearTimeout(timer)
    timer = null
    const record = pending
    pending = null
    if (!record) return
    try {
      await store.put(record)
    } catch {
      onWarning(OFFLINE_DRAFT_WARNING)
    }
  }

  return {
    schedule(document: DesignDocument, baseVersion: number, revision: number) {
      if (timer) clearTimeout(timer)
      const createdAt = now().toISOString()
      pending = {
        key: `${userId}:${projectId}`,
        userId,
        projectId,
        document,
        baseVersion,
        revision,
        updatedAt: createdAt,
        createdAt,
        ...(versionSavePending ? { provenance: 'pending-version-save' as const } : {}),
      }
      timer = setTimeout(() => { void flush() }, delayMs)
    },
    beginVersionSave() { versionSavePending = true },
    endVersionSave() { versionSavePending = false },
    flush,
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      pending = null
    },
  }
}

interface CreateOfflineDraftRecoveryControllerInput {
  persistence: ReturnType<typeof createOfflineDraftPersistence>
  deleteLocal: (record: OfflineDraftRecord) => Promise<void>
  loadDocument: (document: DesignDocument) => void
  onWarning?: (warning: string) => void
  clearPendingFallback?: (revision: number) => Promise<void>
  retainPendingFallback?: (revision: number, baseVersion: number) => Promise<void>
}

export function createOfflineDraftRecoveryController({
  persistence,
  deleteLocal,
  loadDocument,
  onWarning = () => undefined,
  clearPendingFallback = async () => undefined,
  retainPendingFallback = async () => undefined,
}: CreateOfflineDraftRecoveryControllerInput) {
  let suspended = false
  let disposed = false
  let serverChoice: Promise<{ warning: string | null }> | null = null
  let cleanup: Promise<void> | null = null

  return {
    schedule(document: DesignDocument, baseVersion: number, revision: number) {
      if (suspended || disposed) return
      persistence.schedule(document, baseVersion, revision)
    },
    beginVersionSave() { persistence.beginVersionSave() },
    endVersionSave() { persistence.endVersionSave() },
    async clearPendingVersionFallback(revision: number) {
      await (cleanup ?? persistence.flush())
      await clearPendingFallback(revision)
    },
    async retainPendingVersionFallback(revision: number, baseVersion: number) {
      await (cleanup ?? persistence.flush())
      await retainPendingFallback(revision, baseVersion)
    },
    useServer(
      record: OfflineDraftRecord,
      serverDocument: DesignDocument,
    ): Promise<{ warning: string | null }> {
      if (serverChoice) return serverChoice
      suspended = true
      persistence.cancel()
      const operation = (async () => {
        let warning: string | null = null
        try {
          await deleteLocal(record)
        } catch {
          warning = OFFLINE_DRAFT_WARNING
          onWarning(warning)
        }
        loadDocument(serverDocument)
        return { warning }
      })()
      serverChoice = operation.finally(() => {
        suspended = false
        serverChoice = null
      })
      return serverChoice
    },
    cancel() {
      if (cleanup) return cleanup
      disposed = true
      cleanup = persistence.flush()
      return cleanup
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
  const createdAt = record.createdAt ?? record.updatedAt
  if (createdAt <= server.updatedAt) return false
  return record.baseVersion === server.baseVersion || record.provenance === 'pending-version-save'
}

export async function clearPendingVersionFallback(
  store: OfflineDraftStore,
  expected: Pick<OfflineDraftRecord, 'userId' | 'projectId' | 'revision'>,
): Promise<void> {
  const current = await store.get(expected.userId, expected.projectId)
  if (current?.provenance !== 'pending-version-save' || current.revision !== expected.revision) return
  await store.delete(expected.userId, expected.projectId)
}

export async function retainPendingVersionFallback(
  store: OfflineDraftStore,
  expected: Pick<OfflineDraftRecord, 'userId' | 'projectId' | 'revision'>,
  baseVersion: number,
  now: () => Date = () => new Date(),
): Promise<void> {
  const current = await store.get(expected.userId, expected.projectId)
  if (current?.provenance !== 'pending-version-save' || current.revision !== expected.revision) return
  const createdAt = now().toISOString()
  await store.put({ ...current, baseVersion, createdAt, updatedAt: createdAt })
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
  isUsingServer: boolean
  recoverLocal: () => void
  useServerDocument: (document?: DesignDocument) => Promise<void>
  dismissWarning: () => void
  beginVersionSave: () => void
  endVersionSave: () => void
  clearPendingVersionFallback: (revision: number) => Promise<void>
  retainPendingVersionFallback: (revision: number, baseVersion: number) => Promise<void>
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
  const [isUsingServer, setIsUsingServer] = useState(false)
  const recoveryController = useRef<ReturnType<typeof createOfflineDraftRecoveryController> | null>(null)

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
    let active = true
    const persistence = createOfflineDraftPersistence({
      store: draftStore,
      userId,
      projectId,
      onWarning: (nextWarning) => { if (active) setWarning(nextWarning) },
    })
    const controller = createOfflineDraftRecoveryController({
      persistence,
      deleteLocal: (record) => draftStore.delete(record.userId, record.projectId),
      loadDocument: designStore.getState().loadDocument,
      onWarning: (nextWarning) => { if (active) setWarning(nextWarning) },
      clearPendingFallback: (revision) => clearPendingVersionFallback(draftStore, {
        userId,
        projectId,
        revision,
      }),
      retainPendingFallback: (revision, pendingBaseVersion) => retainPendingVersionFallback(
        draftStore,
        { userId, projectId, revision },
        pendingBaseVersion,
      ),
    })
    recoveryController.current = controller
    const unsubscribe = designStore.subscribe((state, previous) => {
      if (state.revision === previous.revision) return
      controller.schedule(state.document, baseVersion, state.revision)
    })
    return () => {
      active = false
      unsubscribe()
      const cleanup = controller.cancel()
      void cleanup.finally(() => {
        if (recoveryController.current === controller) recoveryController.current = null
      })
    }
  }, [baseVersion, designStore, draftStore, projectId, userId])

  const recoverLocal = useCallback(() => {
    if (!recoveryRecord) return
    designStore.getState().loadDocument(recoveryRecord.document)
    setRecoveryRecord(null)
  }, [designStore, recoveryRecord])

  const useServerDocument = useCallback(async (document = serverDocument) => {
    if (!userId) {
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
    setIsUsingServer(true)
    try {
      const controller = recoveryController.current
      const result = controller
        ? await controller.useServer(record, document)
        : await applyOfflineDraftChoice({
            choice: 'use-server',
            store: draftStore,
            record,
            serverDocument: document,
            loadDocument: designStore.getState().loadDocument,
          })
      if (result.warning) setWarning(result.warning)
      setRecoveryRecord(null)
    } finally {
      setIsUsingServer(false)
    }
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
    isUsingServer,
    recoverLocal,
    useServerDocument,
    dismissWarning: () => setWarning(null),
    beginVersionSave: () => recoveryController.current?.beginVersionSave(),
    endVersionSave: () => recoveryController.current?.endVersionSave(),
    clearPendingVersionFallback: async (revision) => {
      if (!userId) return
      const controller = recoveryController.current
      if (controller) await controller.clearPendingVersionFallback(revision)
      else await clearPendingVersionFallback(draftStore, { userId, projectId, revision })
    },
    retainPendingVersionFallback: async (revision, pendingBaseVersion) => {
      if (!userId) return
      const controller = recoveryController.current
      if (controller) await controller.retainPendingVersionFallback(revision, pendingBaseVersion)
      else await retainPendingVersionFallback(
        draftStore,
        { userId, projectId, revision },
        pendingBaseVersion,
      )
    },
  }
}
