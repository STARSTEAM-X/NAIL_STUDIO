import { useState, type FormEvent } from 'react'

interface Props {
  projectName: string
  isReloading: boolean
  isDuplicating: boolean
  errorMessage: string | null
  onReloadServer: () => void
  onDuplicateCurrent: (name: string) => void
}

export function ConflictDialog({
  projectName,
  isReloading,
  isDuplicating,
  errorMessage,
  onReloadServer,
  onDuplicateCurrent,
}: Props) {
  const [duplicateName, setDuplicateName] = useState(`${projectName} (สำเนาที่ขัดแย้ง)`)
  const pending = isReloading || isDuplicating

  const handleDuplicate = (event: FormEvent) => {
    event.preventDefault()
    onDuplicateCurrent(duplicateName)
  }

  return (
    <div className="dialog-backdrop">
      <section
        className="conflict-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        aria-describedby="conflict-description"
      >
        <h2 id="conflict-title">มีเวอร์ชันใหม่กว่าบนเซิร์ฟเวอร์</h2>
        <p id="conflict-description">
          งานบนหน้าจอนี้ยังไม่ถูกทิ้ง เลือกโหลดงานล่าสุดจากเซิร์ฟเวอร์ หรือเก็บงานบนหน้าจอเป็นสำเนาใหม่
        </p>
        <p className="hint">
          การโหลดล่าสุดจะแทนที่งานบนหน้าจอและล้างประวัติย้อนกลับของเอกสารนี้
        </p>
        {errorMessage && <p className="error" role="alert">{errorMessage}</p>}

        <div className="conflict-actions">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            data-conflict-action="reload-server"
            onClick={onReloadServer}
          >
            {isReloading ? 'กำลังโหลด…' : 'โหลดเวอร์ชันล่าสุด'}
          </button>

          <form onSubmit={handleDuplicate}>
            <label htmlFor="conflict-duplicate-name">ชื่อสำเนาใหม่</label>
            <input
              id="conflict-duplicate-name"
              value={duplicateName}
              maxLength={120}
              required
              disabled={pending}
              onChange={(event) => setDuplicateName(event.target.value)}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
              data-conflict-action="duplicate-current"
            >
              {isDuplicating ? 'กำลังทำสำเนา…' : 'ทำสำเนางานบนหน้าจอ'}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
