import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore } from 'zustand'
import type { DesignDocument } from '@nail-studio/contracts'
import { createDesignStore, type DesignActions, type DesignState, type DesignStore } from './designStore.ts'

const DesignStoreContext = createContext<DesignStore | null>(null)

interface Props {
  document: DesignDocument
  children: ReactNode
}

/**
 * ผูกสถานะการแก้ไขไว้กับต้นไม้ React แทนที่จะเป็นตัวแปรระดับโมดูล
 *
 * ผลที่ได้จริง: เปลี่ยนหน้าไปเปิดงานอีกชิ้นแล้วสถานะเก่าถูกทิ้งไปพร้อมกับ component
 * ไม่มีเส้นของงานก่อนหน้าค้างมาให้เห็น และเทสสร้าง store แยกกันได้โดยไม่ต้องรีเซ็ต
 *
 * เอกสารตั้งต้นถูกใช้ครั้งเดียวตอนสร้าง — การที่ TanStack Query คืน object ใหม่
 * หลัง refetch ต้องไม่ไปทับงานที่ผู้ใช้กำลังวาดค้างอยู่
 */
export function DesignStoreProvider({ document, children }: Props) {
  const store = useRef<DesignStore>(null)
  store.current ??= createDesignStore({ document })
  return <DesignStoreContext value={store.current}>{children}</DesignStoreContext>
}

export function useDesignStoreApi(): DesignStore {
  const store = useContext(DesignStoreContext)
  if (!store) throw new Error('ต้องใช้ hook นี้ภายใน DesignStoreProvider เท่านั้น')
  return store
}

export function useDesign<T>(selector: (state: DesignState & DesignActions) => T): T {
  return useStore(useDesignStoreApi(), selector)
}
