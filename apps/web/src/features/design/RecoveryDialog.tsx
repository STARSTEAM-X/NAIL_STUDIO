interface Props {
  isUsingServer: boolean
  onRecoverLocal: () => void
  onUseServer: () => void
}

export function RecoveryDialog({ isUsingServer, onRecoverLocal, onUseServer }: Props) {
  return (
    <div className="dialog-backdrop">
      <section
        className="recovery-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recovery-title"
        aria-describedby="recovery-description"
      >
        <h2 id="recovery-title">พบงานสำรองในเครื่องที่ใหม่กว่า</h2>
        <p id="recovery-description">
          เลือกกู้คืนงานที่บันทึกไว้ในเบราว์เซอร์นี้ หรือใช้ข้อมูลล่าสุดจากเซิร์ฟเวอร์
        </p>
        <p className="hint">ระบบจะไม่แทนที่งานจนกว่าคุณจะเลือก</p>
        <div className="recovery-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={isUsingServer}
            data-recovery-action="recover-local"
            onClick={onRecoverLocal}
          >
            กู้คืนงานในเครื่อง
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isUsingServer}
            data-recovery-action="use-server"
            onClick={onUseServer}
          >
            {isUsingServer ? 'กำลังใช้ข้อมูลจากเซิร์ฟเวอร์…' : 'ใช้งานจากเซิร์ฟเวอร์'}
          </button>
        </div>
      </section>
    </div>
  )
}
