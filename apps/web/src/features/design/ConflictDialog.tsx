import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'

interface Props {
  projectName: string
  isReloading: boolean
  isDuplicating: boolean
  errorMessage: string | null
  onReloadServer: () => void
  onDuplicateCurrent: (name: string) => void
}

/**
 * เวอร์ชันบนเซิร์ฟเวอร์ใหม่กว่างานบนหน้าจอ
 *
 * ปิดเองไม่ได้โดยตั้งใจ — ผู้ใช้ต้องเลือกอย่างใดอย่างหนึ่ง ไม่งั้นงานฝั่งใดฝั่งหนึ่งจะหาย
 */
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
    <Dialog
      title="มีเวอร์ชันใหม่กว่าบนเซิร์ฟเวอร์"
      description="งานบนหน้าจอนี้ยังไม่ถูกทิ้ง เลือกโหลดงานล่าสุดจากเซิร์ฟเวอร์ หรือเก็บงานบนหน้าจอเป็นสำเนาใหม่"
      dismissible={false}
    >
      <p className="hint">การโหลดล่าสุดจะแทนที่งานบนหน้าจอและล้างประวัติย้อนกลับของเอกสารนี้</p>
      {errorMessage && <p className="error" role="alert">{errorMessage}</p>}

      <div className="conflict-actions">
        <Button
          variant="ghost"
          block
          disabled={pending}
          loading={isReloading}
          loadingLabel="กำลังโหลด…"
          data-conflict-action="reload-server"
          onClick={onReloadServer}
        >
          โหลดเวอร์ชันล่าสุด
        </Button>

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
          <Button
            type="submit"
            variant="primary"
            block
            disabled={pending}
            loading={isDuplicating}
            loadingLabel="กำลังทำสำเนา…"
            data-conflict-action="duplicate-current"
          >
            ทำสำเนางานบนหน้าจอ
          </Button>
        </form>
      </div>
    </Dialog>
  )
}
