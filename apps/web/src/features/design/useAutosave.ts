import { useEffect, useRef, useState } from 'react'
import { useSaveDraft } from '@/features/projects/useProjects.ts'
import {
  conflictStateFromError,
  localizedTaskError,
  type ServerVersionConflict,
} from '@/features/projects/versionActions.ts'
import { useDesignStoreApi } from './DesignStoreProvider.tsx'

/** รอให้ผู้ใช้หยุดวาดเท่านี้ก่อนจึงบันทึก — นานพอให้ลากหลายเส้นติดกันได้โดยไม่ยิงซ้ำ */
export const AUTOSAVE_DELAY_MS = 3000

export type AutosaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

export interface AutosaveResult {
  status: AutosaveStatus
  message: string | null
  conflict: ServerVersionConflict | null
  /** ให้ผู้ใช้สั่งบันทึกทันทีโดยไม่ต้องรอครบเวลา */
  flush: () => void
}

export function autosaveFailureFromError(error: unknown): {
  conflict: ServerVersionConflict | null
  message: string | null
} {
  const conflict = conflictStateFromError(error, 'autosave')
  return {
    conflict,
    message: conflict
      ? null
      : localizedTaskError(error, 'บันทึกอัตโนมัติไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'),
  }
}

/**
 * บันทึกงานค้างอัตโนมัติเมื่อผู้ใช้หยุดวาด
 *
 * ทำไมต้องหน่วง ไม่บันทึกทุกเส้น: การลากเส้นหนึ่งทีอาจเกิดถี่กว่าวินาทีละครั้ง
 * การส่งเอกสารทั้งชิ้นทุกครั้งคือการอัปโหลดซ้ำของเดิมเกือบทั้งหมด
 *
 * ทำไมยังต้องบันทึกตอนปิดหน้า: การหน่วงแปลว่ามีช่วงเวลาที่งานล่าสุดยังไม่ถูกส่ง
 * ถ้าผู้ใช้ปิดแท็บพอดีในช่วงนั้น งานช่วงสุดท้ายจะหายไปโดยไม่มีใครรู้
 *
 * ติดตามด้วย revision ไม่ใช่เนื้อเอกสาร — เทียบตัวเลขเป็นการทำงานคงที่
 * ส่วนการเทียบเอกสารทั้งชิ้นคือการเดินโครงสร้างขนาดใหญ่ทุกครั้งที่วาดเสร็จหนึ่งเส้น
 */
export function useAutosave(projectId: string, baseVersion: number): AutosaveResult {
  const store = useDesignStoreApi()
  const saveDraft = useSaveDraft()
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [message, setMessage] = useState<string | null>(null)
  const [conflict, setConflict] = useState<ServerVersionConflict | null>(null)

  // เก็บใน ref เพราะ effect ด้านล่างต้องอ่านค่าล่าสุดโดยไม่ผูกเป็น dependency
  // ไม่งั้นตัวจับเวลาจะถูกตั้งใหม่ทุกครั้งที่สถานะเปลี่ยน แล้วไม่มีวันครบเวลา
  const saved = useRef(store.getState().revision)
  const inFlight = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const save = useRef<() => void>(() => undefined)

  save.current = () => {
    const { revision, document } = store.getState()
    if (inFlight.current || revision === saved.current) return
    inFlight.current = true
    setStatus('saving')
    saveDraft.mutate(
      { projectId, document, baseVersion },
      {
        onSuccess: () => {
          saved.current = revision
          inFlight.current = false
          setStatus('saved')
          setMessage(null)
          setConflict(null)
        },
        onError: (error: unknown) => {
          const failure = autosaveFailureFromError(error)
          inFlight.current = false
          setStatus('error')
          setMessage(failure.message)
          setConflict(failure.conflict)
        },
      },
    )
  }

  useEffect(() => {
    const unsubscribe = store.subscribe((state) => {
      if (state.revision === saved.current) return
      setStatus('pending')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => save.current(), AUTOSAVE_DELAY_MS)
    })

    // ปิดแท็บระหว่างที่ยังหน่วงอยู่ต้องไม่ทำให้งานช่วงสุดท้ายหาย
    const onHide = () => {
      if (window.document.visibilityState === 'hidden') save.current()
    }
    window.document.addEventListener('visibilitychange', onHide)

    return () => {
      unsubscribe()
      window.document.removeEventListener('visibilitychange', onHide)
      if (timer.current) clearTimeout(timer.current)
      // ออกจากหน้าแก้ไขก็เป็นการ "หยุดวาด" อย่างหนึ่ง — บันทึกก่อนไป
      save.current()
    }
  }, [store])

  return {
    status,
    message,
    conflict,
    flush: () => {
      if (timer.current) clearTimeout(timer.current)
      save.current()
    },
  }
}
