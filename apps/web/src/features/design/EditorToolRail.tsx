import { useRef } from 'react'
import { Icon, type IconName } from '@/components/Icon.tsx'

export type EditorPanelId = 'hand' | 'nail' | 'paint' | 'decorate' | 'ai'

interface EditorToolRailProps {
  activePanel: EditorPanelId
  onChange: (panel: EditorPanelId) => void
}

/*
  เรียงจาก "ของที่ตั้งไว้ก่อนแล้วไม่ค่อยแตะ" ไปหา "ของที่ทำซ้ำตลอดเวลา"
  มือ → เล็บ (ทรง/ความยาว/ผิว) → วาด → ตกแต่ง ตามลำดับที่คนทำเล็บทำจริง
*/
const ITEMS: Array<{ id: EditorPanelId; icon: IconName; label: string; hint: string }> = [
  { id: 'hand', icon: 'hand', label: 'มือ', hint: 'สีผิวและสัดส่วนมือ' },
  { id: 'nail', icon: 'nail', label: 'เล็บ', hint: 'ทรง ความยาว และผิวเล็บ' },
  { id: 'paint', icon: 'brush', label: 'วาด', hint: 'แปรง สี และน้ำหนักเส้น' },
  { id: 'decorate', icon: 'sparkle', label: 'ตกแต่ง', hint: 'เพิ่มและปรับของตกแต่ง' },
  { id: 'ai', icon: 'wand', label: 'AI', hint: 'ผู้ช่วยออกแบบ' },
]

export function tabIdOf(panel: EditorPanelId): string {
  return `editor-tool-tab-${panel}`
}

/**
 * แถบเลือกกลุ่มเครื่องมือด้านซ้าย
 *
 * ใช้ role="tablist" ให้ตรงกับแผงแท็บด้านขวา — ก่อนหน้านี้ที่นี่เป็น <nav> + aria-pressed
 * ส่วนด้านขวาเป็น tablist ทั้งที่ทำงานเหมือนกัน คนใช้ screen reader จึงเจอสองรูปแบบ
 * ในหน้าจอเดียว
 */
export function EditorToolRail({ activePanel, onChange }: EditorToolRailProps) {
  const listRef = useRef<HTMLDivElement>(null)

  // ลูกศรเลื่อนระหว่างแท็บตามข้อตกลง WAI-ARIA — Tab เข้าออกทั้งกลุ่มครั้งเดียว
  // (roving tabindex) ไม่ใช่กด Tab สี่ครั้งเพื่อผ่านแถบเครื่องมือ
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight'
      ? 1
      : event.key === 'ArrowUp' || event.key === 'ArrowLeft'
        ? -1
        : event.key === 'Home'
          ? 'first'
          : event.key === 'End'
            ? 'last'
            : null
    if (step === null) return

    event.preventDefault()
    const current = ITEMS.findIndex((item) => item.id === activePanel)
    const next = step === 'first'
      ? 0
      : step === 'last'
        ? ITEMS.length - 1
        : (current + step + ITEMS.length) % ITEMS.length

    const target = ITEMS[next]
    if (!target) return
    onChange(target.id)
    listRef.current?.querySelector<HTMLButtonElement>(`#${tabIdOf(target.id)}`)?.focus()
  }

  return (
    <div
      ref={listRef}
      className="editor-tool-rail"
      role="tablist"
      aria-orientation="vertical"
      aria-label="กลุ่มเครื่องมือแก้ไขงาน"
      onKeyDown={onKeyDown}
    >
      {ITEMS.map((item) => {
        const active = activePanel === item.id
        return (
          <button
            key={item.id}
            id={tabIdOf(item.id)}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls="editor-inspector-panel"
            tabIndex={active ? 0 : -1}
            className={`editor-tool-button ${active ? 'editor-tool-button-active' : ''}`}
            data-tooltip={`${item.label} — ${item.hint}`}
            data-tooltip-side="right"
            onClick={() => onChange(item.id)}
          >
            <Icon name={item.icon} size={19} />
            <span className="editor-tool-label">{item.label}</span>
          </button>
        )
      })}
    </div>
  )
}
