import type { DesignDocument } from '@nail-studio/contracts'

const DATABASE_NAME = 'nail-studio'
const DATABASE_VERSION = 1
const DRAFT_STORE_NAME = 'drafts'

export interface OfflineDraftRecord {
  key: string
  userId: string
  projectId: string
  document: DesignDocument
  baseVersion: number
  revision: number
  updatedAt: string
}

export interface OfflineDraftStore {
  get(userId: string, projectId: string): Promise<OfflineDraftRecord | null>
  put(record: OfflineDraftRecord): Promise<void>
  delete(userId: string, projectId: string): Promise<void>
}

export interface OfflineDraftBackend {
  get(key: string): Promise<OfflineDraftRecord | null>
  put(record: OfflineDraftRecord): Promise<void>
  delete(key: string): Promise<void>
}

export function offlineDraftKey(userId: string, projectId: string): string {
  return `${userId}:${projectId}`
}

export function createOfflineDraftStore(backend: OfflineDraftBackend): OfflineDraftStore {
  return {
    get: (userId, projectId) => backend.get(offlineDraftKey(userId, projectId)),
    put: (record) => backend.put({
      ...record,
      key: offlineDraftKey(record.userId, record.projectId),
    }),
    delete: (userId, projectId) => backend.delete(offlineDraftKey(userId, projectId)),
  }
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(DRAFT_STORE_NAME)) {
        database.createObjectStore(DRAFT_STORE_NAME, { keyPath: 'key' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB could not be opened'))
    request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked'))
  })
}

function browserIndexedDbFactory(): IDBFactory {
  const factory = globalThis.indexedDB
  if (!factory) throw new Error('IndexedDB is unavailable')
  return factory
}

export function createIndexedDbBackend(
  factory: () => IDBFactory = browserIndexedDbFactory,
): OfflineDraftBackend {
  const run = async <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const database = await openDatabase(factory())
    try {
      const transaction = database.transaction(DRAFT_STORE_NAME, mode)
      const completion = transactionToPromise(transaction)
      const [result] = await Promise.all([
        requestToPromise(operation(transaction.objectStore(DRAFT_STORE_NAME))),
        completion,
      ])
      return result
    } finally {
      database.close()
    }
  }

  return {
    get: async (key) => {
      const record = await run<OfflineDraftRecord | undefined>('readonly', (store) => store.get(key))
      return record ?? null
    },
    put: async (record) => {
      await run<IDBValidKey>('readwrite', (store) => store.put(record))
    },
    delete: async (key) => {
      await run<undefined>('readwrite', (store) => store.delete(key))
    },
  }
}

export const indexedDbDraftStore = createOfflineDraftStore(createIndexedDbBackend())
