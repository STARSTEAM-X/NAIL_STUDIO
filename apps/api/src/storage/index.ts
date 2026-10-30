import { env } from '../config/env.ts'
import { LocalDiskProvider } from './LocalDiskProvider.ts'
import type { StorageProvider } from './StorageProvider.ts'

export function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalDiskProvider(env.STORAGE_ROOT)
    default: {
      // exhaustiveness check — ถ้าเพิ่มค่าใน STORAGE_DRIVER union แล้วลืมเพิ่มเคสตรงนี้
      // TypeScript จะฟ้องตอน build ไม่ใช่ runtime
      const exhaustive: never = env.STORAGE_DRIVER
      throw new Error(`ไม่รู้จัก STORAGE_DRIVER: ${String(exhaustive)}`)
    }
  }
}

export const storage: StorageProvider = createStorageProvider()
