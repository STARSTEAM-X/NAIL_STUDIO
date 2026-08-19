import { useId, useState } from 'react'

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  /** หน่วยที่ต่อท้ายช่องตัวเลข เช่น '%' — ว่างไว้ถ้าเป็นค่าดิบ */
  suffix?: string
  onChange: (value: number) => void
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/**
 * สไลเดอร์ที่พิมพ์ค่าเป็นตัวเลขได้
 *
 * ทำไมต้องมีช่องตัวเลข: ขนาดหัวแปรงไล่ 8–400 บนรางกว้างราว 200px แปลว่า 1 พิกเซล
 * ของรางเท่ากับเกือบ 2 หน่วย — ตั้งค่าที่ต้องการเป๊ะ ๆ ด้วยเมาส์ไม่ได้เลย
 *
 * ทำไมต้องเก็บ draft ระหว่างพิมพ์: ถ้า clamp ทุกครั้งที่ onChange คนที่ต้องการ 150
 * จะพิมพ์ '1' แล้วโดนดันขึ้นเป็นค่าต่ำสุดทันที ตัวเลขที่พิมพ์ต่อจะไปต่อท้ายค่าที่ถูก
 * แก้แล้ว กลายเป็นคนละค่า — จึงปล่อยให้พิมพ์ค้างไว้ แล้วค่อย clamp ตอนออกจากช่อง
 */
export function SliderField({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = '',
  onChange,
}: SliderFieldProps) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  /**
   * ออกจากช่อง = ยืนยันค่าที่พิมพ์
   *
   * ช่องว่างต้องคืนค่าเดิม ไม่ใช่ตีเป็นศูนย์ — `Number('')` ได้ 0 ซึ่งผ่าน isFinite
   * แล้วโดน clamp ขึ้นเป็นค่าต่ำสุด คนที่เลือกทั้งช่องแล้วกดลบจะเห็นขนาดหัวแปรง
   * กระโดดไป 8 ทั้งที่ไม่ได้ตั้งใจเปลี่ยนอะไร
   */
  const commitDraft = () => {
    if (draft === null) return
    const trimmed = draft.trim()
    setDraft(null)
    if (trimmed === '') return
    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed)) return
    onChange(clamp(parsed, min, max))
  }

  return (
    <div className="slider-field">
      <div className="slider-field-head">
        <label htmlFor={`${id}-number`}>{label}</label>
        <div className="slider-field-value">
          <input
            id={`${id}-number`}
            type="number"
            className="slider-field-number"
            min={min}
            max={max}
            step={step}
            value={draft ?? value}
            onChange={(event) => {
              const next = event.target.value
              setDraft(next)
              const parsed = Number(next)
              // อยู่ในช่วงแล้วส่งต่อทันที ผู้ใช้จะได้เห็นผลระหว่างพิมพ์
              if (next !== '' && Number.isFinite(parsed) && parsed >= min && parsed <= max) {
                onChange(parsed)
              }
            }}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
          />
          {suffix && <span aria-hidden="true">{suffix}</span>}
        </div>
      </div>
      {/* ลากรางแล้วทิ้ง draft ที่ค้างอยู่ ไม่งั้นช่องตัวเลขจะแสดงค่าเก่าคาไว้ */}
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => {
          setDraft(null)
          onChange(Number(event.target.value))
        }}
      />
    </div>
  )
}
