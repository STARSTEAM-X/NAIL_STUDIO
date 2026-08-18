import { Button } from '@/components/ui/Button.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'

interface Props {
  isUsingServer: boolean
  onRecoverLocal: () => void
  onUseServer: () => void
}

/**
 * พบงานสำรองในเครื่องที่ใหม่กว่าข้อมูลบนเซิร์ฟเวอร์
 *
 * ปิดเองไม่ได้ — ต้องเลือกก่อนว่าจะใช้ข้อมูลชุดไหน ไม่งั้นระบบจะไม่รู้ว่าควรเปิดงานจากที่ใด
 */
export function RecoveryDialog({ isUsingServer, onRecoverLocal, onUseServer }: Props) {
  return (
    <Dialog
      title="พบงานสำรองในเครื่องที่ใหม่กว่า"
      description="เลือกกู้คืนงานที่บันทึกไว้ในเบราว์เซอร์นี้ หรือใช้ข้อมูลล่าสุดจากเซิร์ฟเวอร์"
      size="sm"
      dismissible={false}
      footer={
        <>
          <Button
            variant="ghost"
            disabled={isUsingServer}
            loading={isUsingServer}
            loadingLabel="กำลังใช้ข้อมูลจากเซิร์ฟเวอร์…"
            data-recovery-action="use-server"
            onClick={onUseServer}
          >
            ใช้งานจากเซิร์ฟเวอร์
          </Button>
          <Button
            variant="primary"
            disabled={isUsingServer}
            data-recovery-action="recover-local"
            onClick={onRecoverLocal}
          >
            กู้คืนงานในเครื่อง
          </Button>
        </>
      }
    >
      <p className="hint">ระบบจะไม่แทนที่งานจนกว่าคุณจะเลือก</p>
    </Dialog>
  )
}
