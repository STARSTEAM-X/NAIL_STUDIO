import { useEffect } from 'react'
import { FINGERS, nailKey, type Finger } from '@nail-studio/contracts'
import { EDITABLE_HAND } from './designStore.ts'
import { useDesign } from './DesignStoreProvider.tsx'
import { fingerIndexFromShortcut } from './fingerShortcuts.ts'

const FINGER_LABELS: Record<Finger, string> = {
  thumb: 'โป้ง',
  index: 'ชี้',
  middle: 'กลาง',
  ring: 'นาง',
  little: 'ก้อย',
}

const HAND_LABEL = EDITABLE_HAND === 'right' ? 'มือขวา' : 'มือซ้าย'

/**
 * เลือกเล็บที่จะวาด
 *
 * ตอนนี้มีมือเดียว (EDITABLE_HAND) จึงไม่มีตัวสลับมือ — ถ้าเปิดมือที่สองกลับมา
 * ให้เพิ่มแถวเลือกมือไว้เหนือแถวนิ้ว แล้วให้ selectAll ครอบคลุมทั้งสองมือ
 */
export function NailStrip() {
  const selection = useDesign((state) => state.selection)
  const selectNail = useDesign((state) => state.selectNail)
  const selectAll = useDesign((state) => state.selectAll)
  const focusNail = useDesign((state) => state.focusNail)
  const focusHome = useDesign((state) => state.focusHome)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const index = fingerIndexFromShortcut(event)
      if (index === null) return

      const finger = FINGERS[index]
      if (!finger) return
      const key = nailKey(EDITABLE_HAND, finger)
      event.preventDefault()
      selectNail(key, 'replace')
      focusNail(key)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusNail, selectNail])

  return (
    <section className="nail-strip" aria-label="เลือกเล็บ">
      <div className="nail-buttons" role="group" aria-label={`เล็บ${HAND_LABEL}`}>
        {FINGERS.map((finger, index) => {
          const key = nailKey(EDITABLE_HAND, finger)
          const on = selection.has(key)
          return (
            <button
              key={key}
              type="button"
              className={`chip ${on ? 'chip-on' : ''}`}
              aria-pressed={on}
              aria-keyshortcuts={String(index + 1)}
              title={`${FINGER_LABELS[finger]} · กด ${index + 1}`}
              // คลิกธรรมดา = เลือกนิ้วเดียว, กด Shift หรือ Ctrl ค้าง = เลือกเพิ่ม
              // เป็นข้อตกลงเดียวกับการเลือกไฟล์ในระบบปฏิบัติการ จึงไม่ต้องสอน
              //
              // เลือกจากแถบนี้ = จ่อกล้องไปที่นิ้วนั้นด้วย เพราะผู้ใช้เพิ่งบอกว่าจะทำงานกับนิ้วนี้
              // (ส่วนการคลิกบนโมเดล 3 มิติไม่จ่อ — ผู้ใช้เห็นนิ้วนั้นอยู่แล้วจึงคลิกโดนได้)
              onClick={(event) => {
                const additive = event.shiftKey || event.ctrlKey
                selectNail(key, additive ? 'toggle' : 'replace')
                if (!additive) focusNail(key)
              }}
            >
              <span className="nail-chip-key" aria-hidden="true">{index + 1}</span>
              <span>{FINGER_LABELS[finger]}</span>
            </button>
          )
        })}
      </div>

      <div className="strip-actions">
        <button type="button" className="btn btn-ghost" onClick={selectAll}>
          ทุกนิ้ว
        </button>
        <button type="button" className="btn btn-ghost" onClick={focusHome}>
          ดูทั้งมือ
        </button>
      </div>

      <p className="hint">เลือกอยู่ {selection.size} นิ้ว · กด Shift ค้างเพื่อเลือกเพิ่ม</p>
    </section>
  )
}
