import { Icon } from '@/components/Icon.tsx'
import { BRUSHES } from '@nail-studio/contracts'
import {
  BRUSH_SIZE_MAX,
  BRUSH_SIZE_MIN,
  BRUSH_SIZE_STEP,
  type BrushId,
} from '@/3d/painting/paintSettings.ts'
import { useDesign } from './DesignStoreProvider.tsx'
import { SliderField } from './SliderField.tsx'

const BRUSH_LABELS: Record<BrushId, string> = {
  round: 'กลม',
  flat: 'แบน',
  liner: 'เส้นเล็ก',
  glitter: 'กลิตเตอร์',
  airbrush: 'พ่นฝอย',
}

/**
 * สีตั้งต้น — มีชื่อเป็นคำ ไม่ใช่แค่ค่า hex
 *
 * เดิม aria-label เป็น "สี #b5314c" ซึ่ง screen reader อ่านออกมาเป็นตัวอักษรทีละตัว
 * และคนที่มองเห็นก็ไม่รู้ว่าปุ่มไหนคือสีอะไรจนกว่าจะกดลอง
 */
const SWATCHES: Array<{ color: string; name: string }> = [
  { color: '#b5314c', name: 'แดงเลือดหมู' },
  { color: '#6b1e2b', name: 'แดงเข้ม' },
  { color: '#e8bfa0', name: 'สีเนื้อ' },
  { color: '#f2d5c4', name: 'ชมพูนวล' },
  { color: '#2f3e46', name: 'เทาเขียวเข้ม' },
  { color: '#ffffff', name: 'ขาว' },
  { color: '#111111', name: 'ดำ' },
  { color: '#d4af37', name: 'ทอง' },
]

export function PaintToolbar() {
  const settings = useDesign((state) => state.settings)
  const setSettings = useDesign((state) => state.setSettings)
  const selection = useDesign((state) => state.selection)
  const clearSelectedNails = useDesign((state) => state.clearSelectedNails)

  return (
    <aside className="toolbar toolbar-paint" aria-label="เครื่องมือวาด">
      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>เครื่องมือ</span>
          <span className="toolbar-section-kicker">วาดบนเล็บ</span>
        </div>
        <div className="tool-group" role="group" aria-label="เครื่องมือ">
          <button
            type="button"
            className={`tool-choice ${settings.tool === 'brush' ? 'tool-choice-active' : ''}`}
            aria-pressed={settings.tool === 'brush'}
            data-tooltip="แปรง · B"
            onClick={() => setSettings({ tool: 'brush' })}
          >
            <Icon name="brush" size={15} /> แปรง
          </button>
          <button
            type="button"
            className={`tool-choice ${settings.tool === 'erase' ? 'tool-choice-active' : ''}`}
            aria-pressed={settings.tool === 'erase'}
            data-tooltip="ยางลบ · E"
            onClick={() => setSettings({ tool: 'erase' })}
          >
            <Icon name="eraser" size={15} /> ยางลบ
          </button>
        </div>
        <label className="field">
          หัวแปรง
          <select
            value={settings.brush}
            onChange={(event) => setSettings({ brush: event.target.value as BrushId })}
          >
            {BRUSHES.map((brush) => (
              <option key={brush} value={brush}>{BRUSH_LABELS[brush]}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>สีและน้ำหนักเส้น</span>
          <span className="toolbar-section-kicker">แปรง</span>
        </div>
        <div className="field">
          สี
          <div className="swatches">
            {SWATCHES.map(({ color, name }) => (
              <button
                key={color}
                type="button"
                className={`swatch ${settings.color === color ? 'swatch-on' : ''}`}
                style={{ background: color }}
                aria-label={`สี${name}`}
                aria-pressed={settings.color === color}
                data-tooltip={name}
                onClick={() => setSettings({ color })}
              />
            ))}
            <input
              type="color"
              className="swatch-picker"
              value={settings.color}
              aria-label="เลือกสีเอง"
              onChange={(event) => setSettings({ color: event.target.value })}
            />
          </div>
        </div>
        <SliderField
          label="ขนาด"
          min={BRUSH_SIZE_MIN}
          max={BRUSH_SIZE_MAX}
          step={BRUSH_SIZE_STEP}
          value={settings.size}
          onChange={(size) => setSettings({ size })}
        />
        <SliderField
          label="ความทึบ"
          min={0}
          max={100}
          suffix="%"
          value={Math.round(settings.opacity * 100)}
          onChange={(percent) => setSettings({ opacity: percent / 100 })}
        />
        <SliderField
          label="ความฟุ้ง"
          min={0}
          max={100}
          suffix="%"
          value={Math.round(settings.softness * 100)}
          onChange={(percent) => setSettings({ softness: percent / 100 })}
        />
      </div>

      <div className="tool-actions">
        <button type="button" className="btn btn-ghost btn-danger" onClick={clearSelectedNails}>
          <Icon name="eraser" size={15} /> ล้างที่วาดใน {selection.size} นิ้วที่เลือก
        </button>
      </div>
    </aside>
  )
}
