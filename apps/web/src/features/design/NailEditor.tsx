import { useCallback, useState } from 'react'
import { ApiRequestError } from '@/api/client.ts'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { DesignScene } from '@/3d/scene/DesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { useNailTextures } from '@/3d/painting/useNailTextures.ts'
import { useSaveVersion, type ProjectDetail } from '@/features/projects/useProjects.ts'
import { useDesign, useDesignStoreApi } from './DesignStoreProvider.tsx'
import { NailCanvas2D } from './NailCanvas2D.tsx'
import { NailStrip } from './NailStrip.tsx'
import { PaintToolbar } from './PaintToolbar.tsx'
import { HistoryControls } from './HistoryControls.tsx'
import { useAutosave, type AutosaveStatus } from './useAutosave.ts'

interface Props {
  projectId: string
  detail: ProjectDetail
}

const AUTOSAVE_LABELS: Record<AutosaveStatus, string> = {
  idle: '',
  pending: 'มีการแก้ไขที่ยังไม่ได้บันทึก',
  saving: 'กำลังบันทึกอัตโนมัติ…',
  saved: 'บันทึกงานค้างแล้ว',
  error: 'บันทึกอัตโนมัติไม่สำเร็จ',
}

export function NailEditor({ projectId, detail }: Props) {
  const store = useDesignStoreApi()
  const handScale = useDesign((state) => state.document.hand.proportions.handScale)
  const notice = useDesign((state) => state.notice)
  const dismissNotice = useDesign((state) => state.dismissNotice)

  // ชิ้นส่วนมือและชุดเท็กซ์เจอร์ถูกถือไว้ที่ระดับนี้ เพราะทั้งฉาก 3 มิติและแผงวาด
  // แบบแบนต้องใช้ชุดเดียวกัน — มีสองชุดเมื่อไร วาดในโหมดหนึ่งแล้วอีกโหมดจะไม่เห็น
  const [parts, setParts] = useState<HandParts | null>(null)
  const textures = useNailTextures(parts)
  // identity ต้องคงที่ — HandModel เรียก onReady จาก effect ที่มี onReady ใน deps
  const handleReady = useCallback((next: HandParts) => setParts(next), [])

  const autosave = useAutosave(projectId, detail.version.number)
  const saveVersion = useSaveVersion()
  const [savedVersion, setSavedVersion] = useState<number | null>(null)

  return (
    <section className="editor">
      <header className="editor-head">
        <div>
          <h1>{detail.project.name}</h1>
          <p className="muted">
            เวอร์ชัน {savedVersion ?? detail.version.number}
            {autosave.status !== 'idle' ? ` · ${AUTOSAVE_LABELS[autosave.status]}` : ''}
            {detail.draft && autosave.status === 'idle' ? ' · เปิดจากงานค้างล่าสุด' : ''}
          </p>
        </div>
        <div className="editor-actions">
          <HistoryControls />
          {autosave.message && <span className="error" role="alert">{autosave.message}</span>}
          {saveVersion.error instanceof ApiRequestError && (
            <span className="error" role="alert">{saveVersion.error.message}</span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveVersion.isPending}
            onClick={() => {
              // งานค้างที่ยังไม่ถูกส่งต้องไม่หายไปกับการกดบันทึกเวอร์ชัน
              autosave.flush()
              saveVersion.mutate(
                {
                  projectId,
                  document: store.getState().document,
                  expectedVersion: savedVersion ?? detail.version.number,
                },
                { onSuccess: (result) => setSavedVersion(result.versionNumber) },
              )
            }}
          >
            {saveVersion.isPending ? 'กำลังบันทึก…' : 'บันทึกเป็นเวอร์ชัน'}
          </button>
        </div>
      </header>

      {notice && (
        <p className="editor-notice" role="alert">
          {notice}
          <button type="button" className="btn btn-ghost" onClick={dismissNotice}>ปิด</button>
        </p>
      )}

      <div className="editor-body">
        <PaintToolbar />
        <div className="viewport">
          <WebGlGuard>
            <NailScene fallback={null}>
              <DesignScene
                scale={handScale}
                parts={parts}
                textures={textures}
                onReady={handleReady}
              />
            </NailScene>
          </WebGlGuard>
        </div>
        {parts && textures && <NailCanvas2D parts={parts} textures={textures} />}
      </div>

      <NailStrip />
    </section>
  )
}
