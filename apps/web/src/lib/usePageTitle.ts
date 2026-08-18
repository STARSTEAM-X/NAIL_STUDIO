import { useEffect } from 'react'

const BASE_TITLE = 'Nail Studio 3D'

/**
 * ตั้งชื่อแท็บเบราว์เซอร์ตามหน้าที่เปิดอยู่
 *
 * เดิมทุกหน้าใช้ชื่อ "Nail Studio 3D" เหมือนกันหมด ผู้ใช้ที่เปิดหลายแท็บ
 * หรือดูประวัติการเข้าชมจึงแยกไม่ออกว่าแท็บไหนคือหน้าอะไร
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE
    return () => {
      document.title = BASE_TITLE
    }
  }, [title])
}
