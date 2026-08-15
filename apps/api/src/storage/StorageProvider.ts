export interface ObjectMeta {
  contentType: string
}

export interface StoredObject {
  key: string
  sizeBytes: number
}

export interface StorageProvider {
  put(key: string, data: Buffer, meta: ObjectMeta): Promise<StoredObject>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
}
