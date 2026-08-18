export type EditorPanelId = 'paint' | 'decorate' | 'hand' | 'ai'

interface EditorToolRailProps {
  activePanel: EditorPanelId
  onChange: (panel: EditorPanelId) => void
}

const ITEMS: Array<{ id: EditorPanelId; icon: string; label: string; hint: string }> = [
  { id: 'hand', icon: '☝', label: 'มือ', hint: 'สีผิวและสัดส่วนมือ' },
  { id: 'paint', icon: '✎', label: 'วาด', hint: 'สี แปรง และรูปทรงเล็บ' },
  { id: 'decorate', icon: '✦', label: 'ตกแต่ง', hint: 'เพิ่มและปรับของตกแต่ง' },
  { id: 'ai', icon: '✧', label: 'AI', hint: 'ผู้ช่วยออกแบบ' },
]

export function EditorToolRail({ activePanel, onChange }: EditorToolRailProps) {
  return (
    <nav className="editor-tool-rail" aria-label="เครื่องมือแก้ไขงาน">
      <div className="editor-tool-rail-items">
        {ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`editor-tool-button ${activePanel === item.id ? 'editor-tool-button-active' : ''}`}
            aria-pressed={activePanel === item.id}
            title={`${item.label} — ${item.hint}`}
            onClick={() => onChange(item.id)}
          >
            <span className="editor-tool-icon" aria-hidden="true">{item.icon}</span>
            <span className="editor-tool-label">{item.label}</span>
          </button>
        ))}
      </div>
      <p className="editor-tool-rail-footer">TOOLS</p>
    </nav>
  )
}
