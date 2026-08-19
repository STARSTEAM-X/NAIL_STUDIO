import { FINISHES, NAIL_LENGTHS, NAIL_SHAPES, type Nail } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { useDesign } from './DesignStoreProvider.tsx'
import { primaryOf } from './designStore.ts'

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

/**
 * รูปทรงเล็บ — แยกจากแผงวาด
 *
 * ทรง ความยาว และผิวเล็บเป็นคุณสมบัติของ "ตัวเล็บ" ที่ตั้งครั้งเดียวแล้วแทบไม่แตะอีก
 * ส่วนแปรง สี และน้ำหนักเส้นคือเครื่องมือที่ปรับทุกไม่กี่วินาทีระหว่างวาด — การรวม
 * สองอย่างไว้แผงเดียวทำให้ต้องเลื่อนผ่านของที่ไม่ได้ใช้ตลอดเวลาเพื่อไปถึงของที่ใช้จริง
 */
export function NailShapePanel() {
  const selection = useDesign((state) => state.selection)
  const setFinish = useDesign((state) => state.setFinish)
  const setShape = useDesign((state) => state.setShape)
  const setLength = useDesign((state) => state.setLength)
  const copyActiveNailToAll = useDesign((state) => state.copyActiveNailToAll)
  const finish = useDesign((state) => state.document.nails[primaryOf(state.selection)].finish)
  const shape = useDesign((state) => state.document.nails[primaryOf(state.selection)].shape)
  const length = useDesign((state) => state.document.nails[primaryOf(state.selection)].length)

  return (
    <aside className="toolbar toolbar-paint" aria-label="รูปทรงและผิวเล็บ">
      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>ทรงเล็บ</span>
          <span className="toolbar-section-kicker">เลือกแล้ว {selection.size} นิ้ว</span>
        </div>

        <div className="choice-grid" role="group" aria-label="ทรงเล็บ">
          {NAIL_SHAPES.map((option) => (
            <button
              key={option}
              type="button"
              className={`tool-choice ${shape === option ? 'tool-choice-active' : ''}`}
              aria-pressed={shape === option}
              onClick={() => setShape(option)}
            >
              {SHAPE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>ความยาว</span>
        </div>
        <div className="choice-grid" role="group" aria-label="ความยาวเล็บ">
          {NAIL_LENGTHS.map((option) => (
            <button
              key={option}
              type="button"
              className={`tool-choice ${length === option ? 'tool-choice-active' : ''}`}
              aria-pressed={length === option}
              onClick={() => setLength(option)}
            >
              {LENGTH_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      <div className="toolbar-section">
        <div className="toolbar-section-title">
          <span>ผิวเล็บ</span>
        </div>
        <div className="choice-grid" role="group" aria-label="ผิวเล็บ">
          {FINISHES.map((option) => (
            <button
              key={option}
              type="button"
              className={`tool-choice ${finish === option ? 'tool-choice-active' : ''}`}
              aria-pressed={finish === option}
              onClick={() => setFinish(option)}
            >
              {FINISH_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {/* คัดลอกทั้งเล็บ (ทรง ผิว เลเยอร์ ของตกแต่ง) จึงอยู่ที่แผงเล็บ ไม่ใช่แผงวาด */}
      <div className="tool-actions">
        <button type="button" className="btn btn-ghost" onClick={copyActiveNailToAll}>
          <Icon name="layers" size={15} /> ใช้เล็บนี้กับทุกนิ้ว
        </button>
      </div>
    </aside>
  )
}
