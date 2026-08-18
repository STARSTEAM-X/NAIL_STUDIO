import { Icon } from '@/components/Icon.tsx'
import { BRUSHES, FINISHES, NAIL_LENGTHS, NAIL_SHAPES, type Nail } from '@nail-studio/contracts'
import type { BrushId } from '@/3d/painting/paintSettings.ts'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'
import { LayerPanel } from './LayerPanel.tsx'

const BRUSH_LABELS: Record<BrushId, string> = {
  round: 'กลม',
  flat: 'แบน',
  liner: 'เส้นเล็ก',
  glitter: 'กลิตเตอร์',
  airbrush: 'พ่นฝอย',
}

const FINISH_LABELS: Record<Nail['finish'], string> = {
  glossy: 'เงา',
  matte: 'ด้าน',
  chrome: 'โครม',
  glitter: 'กลิตเตอร์',
}

const SHAPE_LABELS: Record<Nail['shape'], string> = {
  round: 'มน',
  almond: 'อัลมอนด์',
  square: 'เหลี่ยม',
  squoval: 'เหลี่ยมมน',
  stiletto: 'แหลม',
}

const LENGTH_LABELS: Record<Nail['length'], string> = {
  short: 'สั้น',
  medium: 'กลาง',
  long: 'ยาว',
  extra: 'ยาวพิเศษ',
}

const SWATCHES = ['#b5314c', '#6b1e2b', '#e8bfa0', '#f2d5c4', '#2f3e46', '#ffffff', '#111111', '#d4af37']

export function PaintToolbar() {
  const settings = useDesign((state) => state.settings)
  const setSettings = useDesign((state) => state.setSettings)
  const selection = useDesign((state) => state.selection)
  const setFinish = useDesign((state) => state.setFinish)
  const clearSelectedNails = useDesign((state) => state.clearSelectedNails)
  const copyActiveNailToAll = useDesign((state) => state.copyActiveNailToAll)
  const finish = useDesign((state) => state.document.nails[primaryOf(state.selection)].finish)
  const setShape = useDesign((state) => state.setShape)
  const setLength = useDesign((state) => state.setLength)
  const shape = useDesign((state) => state.document.nails[primaryOf(state.selection)].shape)
  const length = useDesign((state) => state.document.nails[primaryOf(state.selection)].length)

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
            onClick={() => setSettings({ tool: 'brush' })}
          >
            <Icon name="palette" size={15} /> แปรง
          </button>
          <button
            type="button"
            className={`tool-choice ${settings.tool === 'erase' ? 'tool-choice-active' : ''}`}
            aria-pressed={settings.tool === 'erase'}
            onClick={() => setSettings({ tool: 'erase' })}
          >
            <Icon name="x" size={15} /> ยางลบ
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
            {SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                className={`swatch ${settings.color === color ? 'swatch-on' : ''}`}
                style={{ background: color }}
                aria-label={`สี ${color}`}
                aria-pressed={settings.color === color}
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
        <label className="field">
          ขนาด <output>{settings.size}</output>
          <input
            type="range" min={8} max={400} step={2}
            value={settings.size}
            onChange={(event) => setSettings({ size: Number(event.target.value) })}
          />
        </label>
        <label className="field">
          ความทึบ <output>{Math.round(settings.opacity * 100)}%</output>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(settings.opacity * 100)}
            onChange={(event) => setSettings({ opacity: Number(event.target.value) / 100 })}
          />
        </label>
        <label className="field">
          ความฟุ้ง <output>{Math.round(settings.softness * 100)}%</output>
          <input
            type="range" min={0} max={100} step={1}
            value={Math.round(settings.softness * 100)}
            onChange={(event) => setSettings({ softness: Number(event.target.value) / 100 })}
          />
        </label>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>ลักษณะเล็บ</span>
          <span className="toolbar-section-kicker">เลือกแล้ว {selection.size}</span>
        </div>
        <label className="field">
          ผิวเล็บ
          <select value={finish} onChange={(event) => setFinish(event.target.value as Nail['finish'])}>
            {FINISHES.map((option) => <option key={option} value={option}>{FINISH_LABELS[option]}</option>)}
          </select>
        </label>
        <label className="field">
          ทรงเล็บ
          <select value={shape} onChange={(event) => setShape(event.target.value as Nail['shape'])}>
            {NAIL_SHAPES.map((option) => <option key={option} value={option}>{SHAPE_LABELS[option]}</option>)}
          </select>
        </label>
        <label className="field">
          ความยาว
          <select value={length} onChange={(event) => setLength(event.target.value as Nail['length'])}>
            {NAIL_LENGTHS.map((option) => <option key={option} value={option}>{LENGTH_LABELS[option]}</option>)}
          </select>
        </label>
      </div>

      <div className="tool-actions">
        <button type="button" className="btn btn-ghost" onClick={copyActiveNailToAll}>
          ใช้กับทุกนิ้ว
        </button>
        <button type="button" className="btn btn-ghost btn-danger" onClick={clearSelectedNails}>
          ล้าง {selection.size} นิ้วที่เลือก
        </button>
      </div>
      <LayerPanel />
    </aside>
  )
}
