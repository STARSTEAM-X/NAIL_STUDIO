import { useState, type FormEvent } from 'react'
import type { CreateTemplateInput } from '@nail-studio/contracts'
import { TEMPLATE_CATEGORIES, TEMPLATE_PRIMARY_COLORS } from '@nail-studio/contracts'

type ShareTemplateFormInput = Pick<CreateTemplateInput, 'name' | 'caption' | 'category' | 'primaryColor'>

interface Props {
  defaultName: string
  pending: boolean
  errorMessage: string | null
  onClose: () => void
  onSubmit: (input: ShareTemplateFormInput) => void
}

export function ShareTemplateDialog({
  defaultName,
  pending,
  errorMessage,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState(defaultName)
  const [caption, setCaption] = useState('')
  const [category, setCategory] = useState<ShareTemplateFormInput['category'] | ''>('')
  const [primaryColor, setPrimaryColor] = useState<ShareTemplateFormInput['primaryColor'] | ''>('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSubmit({
      name: name.trim(),
      caption: caption.trim() || undefined,
      category: category || undefined,
      primaryColor: primaryColor || undefined,
    })
  }

  return (
    <div className="dialog-backdrop">
      <form
        className="share-template-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-template-title"
        onSubmit={handleSubmit}
      >
        <div className="share-template-dialog-head">
          <div>
            <p className="eyebrow">COMMUNITY</p>
            <h2 id="share-template-title">แชร์ผลงาน</h2>
          </div>
          <button type="button" className="dialog-close" aria-label="ปิด" disabled={pending} onClick={onClose}>×</button>
        </div>
        <p className="hint">ผลงานนี้จะแสดงใน Community และโปรไฟล์ของคุณให้คนอื่นเข้าชมได้</p>

        <label className="share-template-field">
          <span>ชื่อผลงาน</span>
          <input value={name} maxLength={120} required disabled={pending} onChange={(event) => setName(event.target.value)} />
        </label>

        <label className="share-template-field">
          <span>คำอธิบาย <small>(ไม่บังคับ)</small></span>
          <textarea value={caption} maxLength={500} rows={3} disabled={pending} onChange={(event) => setCaption(event.target.value)} />
        </label>

        <div className="share-template-fields-row">
          <label className="share-template-field">
            <span>หมวดหมู่ <small>(ไม่บังคับ)</small></span>
            <select value={category} disabled={pending} onChange={(event) => setCategory(event.target.value as ShareTemplateFormInput['category'] | '')}>
              <option value="">เลือกหมวดหมู่</option>
              {TEMPLATE_CATEGORIES.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="share-template-field">
            <span>สีหลัก <small>(ไม่บังคับ)</small></span>
            <select value={primaryColor} disabled={pending} onChange={(event) => setPrimaryColor(event.target.value as ShareTemplateFormInput['primaryColor'] | '')}>
              <option value="">เลือกสี</option>
              {TEMPLATE_PRIMARY_COLORS.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
        </div>

        {errorMessage && <p className="error" role="alert">{errorMessage}</p>}

        <div className="share-template-actions">
          <button type="button" className="btn btn-ghost" disabled={pending} onClick={onClose}>ยกเลิก</button>
          <button type="submit" className="btn btn-primary" disabled={pending || !name.trim()}>
            {pending ? 'กำลังแชร์…' : 'แชร์ลง Community'}
          </button>
        </div>
      </form>
    </div>
  )
}
