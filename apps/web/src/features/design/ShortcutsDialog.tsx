import { Button } from '@/components/ui/Button.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'

interface Props {
  onClose: () => void
}

const GROUPS: Array<{ title: string; items: Array<{ keys: string[]; label: string }> }> = [
  {
    title: 'เครื่องมือ',
    items: [
      { keys: ['B'], label: 'แปรง' },
      { keys: ['E'], label: 'ยางลบ' },
      { keys: ['['], label: 'ลดขนาดหัวแปรง' },
      { keys: [']'], label: 'เพิ่มขนาดหัวแปรง' },
    ],
  },
  {
    title: 'เลือกเล็บ',
    items: [
      { keys: ['1', '–', '5'], label: 'เลือกนิ้วโป้งถึงก้อย' },
      { keys: ['Shift', '+', 'คลิก'], label: 'เลือกเพิ่มทีละนิ้ว' },
    ],
  },
  {
    title: 'ประวัติ',
    items: [
      { keys: ['Ctrl', '+', 'Z'], label: 'เลิกทำ' },
      { keys: ['Ctrl', '+', 'Y'], label: 'ทำซ้ำ' },
    ],
  },
  {
    title: 'ทั่วไป',
    items: [
      { keys: ['?'], label: 'เปิดตารางคีย์ลัดนี้' },
      { keys: ['Esc'], label: 'ปิดหน้าต่างที่เปิดอยู่' },
    ],
  },
]

/** ตารางคีย์ลัด — เปิดด้วย `?` หรือปุ่มคีย์บอร์ดในแถบบน */
export function ShortcutsDialog({ onClose }: Props) {
  return (
    <Dialog
      title="คีย์ลัด"
      description="ใช้ได้เมื่อโฟกัสไม่ได้อยู่ในช่องกรอกข้อความ"
      size="md"
      onClose={onClose}
      footer={<Button variant="primary" onClick={onClose}>เข้าใจแล้ว</Button>}
    >
      <div className="shortcut-groups">
        {GROUPS.map((group) => (
          <section className="shortcut-group" key={group.title}>
            <h3>{group.title}</h3>
            <dl>
              {group.items.map((item) => (
                <div className="shortcut-row" key={item.label}>
                  <dt>
                    {item.keys.map((key, index) => (
                      key === '+' || key === '–'
                        ? <span className="shortcut-join" key={`${item.label}-${index}`}>{key}</span>
                        : <kbd key={`${item.label}-${index}`}>{key}</kbd>
                    ))}
                  </dt>
                  <dd>{item.label}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Dialog>
  )
}
