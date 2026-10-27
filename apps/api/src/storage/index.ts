import { env } from '../config/env.ts'
import { LocalDiskProvider } from './LocalDiskProvider.ts'
import { VercelBlobProvider } from './VercelBlobProvider.ts'
import type { StorageProvider } from './StorageProvider.ts'

export function createStorageProvider(): StorageProvider {
  switch (env.STORAGE_DRIVER) {
    case 'local':
      return new LocalDiskProvider(env.STORAGE_ROOT)
    case 'vercel-blob':
      // env.ts บังคับให้มี BLOB_STORE_ID (OIDC) หรือ token อย่างใดอย่างหนึ่งแล้ว
      return new VercelBlobProvider(env.BLOB_READ_WRITE_TOKEN)
    default: {
      // exhaustiveness check — ถ้าเพิ่มค่าใน STORAGE_DRIVER union แล้วลืมเพิ่มเคสตรงนี้
      // TypeScript จะฟ้องตอน build ไม่ใช่ runtime
      const exhaustive: never = env.STORAGE_DRIVER
      throw new Error(`ไม่รู้จัก STORAGE_DRIVER: ${String(exhaustive)}`)
    }
  }
}

export const storage: StorageProvider = createStorageProvider()

/**
 * อ่านไฟล์ที่ DB อ้างถึงแต่อาจไม่มีอยู่จริงแล้ว (เช่น thumbnail เก่าที่เคยอยู่บนดิสก์ของ Render)
 * ไม่มีไฟล์ → null ให้ route ตอบ 404 แทน 500; error ชนิดอื่นยังโยนต่อตามเดิม
 */
export async function readIfExists(key: string): Promise<Buffer | null> {
  try {
    return await storage.get(key)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}
