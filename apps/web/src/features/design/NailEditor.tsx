import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useCurrentUserId } from '@/features/auth/useAuth.ts'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { ThumbnailCapture, type ThumbnailCaptureHandle } from '@/3d/scene/ThumbnailCapture.tsx'
import { SnapshotCapture, type SnapshotCaptureHandle } from '@/3d/scene/SnapshotCapture.tsx'
import { exportProjectJson } from '@/3d/scene/exporters/exportProjectJson.ts'
import { DesignScene } from '@/3d/scene/DesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { useNailTextures } from '@/3d/painting/useNailTextures.ts'
import {
  captureAndUploadThumbnail,
  fetchProjectDetail,
  openingDocument,
  projectKeys,
  useDuplicateProject,
  useSaveVersion,
  type ProjectDetail,
} from '@/features/projects/useProjects.ts'
import {
  buildDuplicateCurrentInput,
  localizedTaskError,
  createExplicitSaveUiController,
  type ServerVersionConflict,
} from '@/features/projects/versionActions.ts'
import { useDesign, useDesignStoreApi } from './DesignStoreProvider.tsx'
import { ConflictDialog } from './ConflictDialog.tsx'
import { RecoveryDialog } from './RecoveryDialog.tsx'
import { NailCanvas2D } from './NailCanvas2D.tsx'
import { NailStrip } from './NailStrip.tsx'
import { PaintToolbar } from './PaintToolbar.tsx'
import { DecorationPanel } from './DecorationPanel.tsx'
import { HandPanel } from './HandPanel.tsx'
import { HistoryControls } from './HistoryControls.tsx'
import { VersionHistoryPanel } from './VersionHistoryPanel.tsx'
import { EditorToolRail, type EditorPanelId } from './EditorToolRail.tsx'
import { useAutosave, type AutosaveStatus } from './useAutosave.ts'
import { useOfflineDraft } from './useOfflineDraft.ts'
import { downloadBlob, sanitizeFilename } from '@/utils/downloadBlob.ts'
import { AiAssistantPanel } from '@/features/ai/AiAssistantPanel.tsx'

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

const PANEL_TITLES: Record<EditorPanelId, { title: string; description: string }> = {
  paint: { title: 'วาด', description: 'สี แปรง และรูปทรงเล็บ' },
  decorate: { title: 'ตกแต่ง', description: 'เพิ่มและจัดวางของตกแต่ง' },
  hand: { title: 'มือ', description: 'ปรับสีผิวและสัดส่วนมือ' },
  ai: { title: 'ผู้ช่วย AI', description: 'สร้างไอเดียและแก้ไขด้วยคำสั่ง' },
}

export function NailEditor({ projectId, detail }: Props) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useCurrentUserId()
  const store = useDesignStoreApi()
  const [activePanel, setActivePanel] = useState<EditorPanelId>('paint')
  const [rightPanel, setRightPanel] = useState<'canvas' | 'history'>('canvas')
  const handScale = useDesign((state) => state.document.hand.proportions.handScale)
  const notice = useDesign((state) => state.notice)
  const dismissNotice = useDesign((state) => state.dismissNotice)

  const openPanel = (panel: EditorPanelId) => {
    setActivePanel(panel)
    store.getState().setMode(panel === 'decorate' ? 'decorate' : 'paint')
  }

  // ชิ้นส่วนมือและชุดเท็กซ์เจอร์ถูกถือไว้ที่ระดับนี้ เพราะทั้งฉาก 3 มิติและแผงวาด
  // แบบแบนต้องใช้ชุดเดียวกัน — มีสองชุดเมื่อไร วาดในโหมดหนึ่งแล้วอีกโหมดจะไม่เห็น
  const [parts, setParts] = useState<HandParts | null>(null)
  const thumbnailRef = useRef<ThumbnailCaptureHandle>(null)
  const snapshotRef = useRef<SnapshotCaptureHandle>(null)
  const textures = useNailTextures(parts)
  // identity ต้องคงที่ — HandModel เรียก onReady จาก effect ที่มี onReady ใน deps
  const handleReady = useCallback((next: HandParts) => setParts(next), [])

  // ฐานบันทึกเปลี่ยนเฉพาะเมื่อเราบันทึกสำเร็จหรือผู้ใช้เลือกโหลดล่าสุดอย่างชัดเจน
  // การ refetch เบื้องหลังต้องไม่ทำให้เอกสารเก่าผ่าน optimistic concurrency โดยไม่ตั้งใจ
  const [saveBaseVersion, setSaveBaseVersion] = useState(detail.version.number)
  const offlineDraft = useOfflineDraft({
    userId,
    projectId,
    baseVersion: saveBaseVersion,
    serverDocument: openingDocument(detail),
    serverUpdatedAt: detail.draft?.updatedAt ?? detail.version.createdAt,
  })
  const autosave = useAutosave(projectId, saveBaseVersion, offlineDraft)
  const saveVersion = useSaveVersion()
  const duplicateProject = useDuplicateProject()
  const [draftSourceVersion, setDraftSourceVersion] = useState<number | null>(null)
  const [conflict, setConflict] = useState<ServerVersionConflict | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const [conflictActionError, setConflictActionError] = useState<string | null>(null)
  const latestVersion = saveBaseVersion
  const explicitSaveUi = useRef(createExplicitSaveUiController({
    setBaseVersion: setSaveBaseVersion,
    clearDraftSource: () => setDraftSourceVersion(null),
    showConflict: setConflict,
    clearConflictError: () => setConflictActionError(null),
  }))

  useEffect(() => {
    explicitSaveUi.current.activate()
    return () => explicitSaveUi.current.dispose()
  }, [])

  useEffect(() => {
    if (!autosave.conflict) return
    setConflictActionError(null)
    setConflict(autosave.conflict)
  }, [autosave.conflict])

  const handleReloadServer = async () => {
    setIsReloading(true)
    setConflictActionError(null)
    try {
      await queryClient.invalidateQueries({
        queryKey: projectKeys.detail(projectId),
        exact: true,
        refetchType: 'none',
      })
      const latest = await queryClient.fetchQuery({
        queryKey: projectKeys.detail(projectId),
        queryFn: () => fetchProjectDetail(projectId),
      })
      // loadDocument ล้าง undo/redo ด้วย จึงไม่มีทางย้อนกลับไปปนกับเอกสารที่ขัดแย้ง
      await offlineDraft.useServerDocument(openingDocument(latest))
      setSaveBaseVersion(latest.version.number)
      setDraftSourceVersion(null)
      saveVersion.reset()
      setConflict(null)
    } catch (error) {
      setConflictActionError(
        localizedTaskError(error, 'โหลดเวอร์ชันล่าสุดไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'),
      )
    } finally {
      setIsReloading(false)
    }
  }

  const handleDuplicateCurrent = (name: string) => {
    setConflictActionError(null)
    duplicateProject.mutate(
      {
        projectId,
        ...buildDuplicateCurrentInput(name, () => store.getState().document),
      },
      {
        onSuccess: (project) => navigate(`/editor/${project.id}`),
        onError: (error) => setConflictActionError(localizedTaskError(
          error,
          'ทำสำเนางานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
        )),
      },
    )
  }

  return (
    <section className="editor">
      <header className="editor-head">
        <div>
          <h1>{detail.project.name}</h1>
          <p className="muted">
            {draftSourceVersion === null
              ? `เวอร์ชัน ${latestVersion}`
              : `ฉบับร่างจากเวอร์ชัน ${draftSourceVersion} · ฐานบันทึกเวอร์ชัน ${latestVersion}`}
            {autosave.status !== 'idle' ? ` · ${AUTOSAVE_LABELS[autosave.status]}` : ''}
            {detail.draft && autosave.status === 'idle' ? ' · เปิดจากงานค้างล่าสุด' : ''}
          </p>
        </div>
        <div className="editor-actions">
          <HistoryControls />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              void (async () => {
                try {
                  if (!snapshotRef.current) throw new Error('canvas ยังไม่พร้อม')
                  const blob = await snapshotRef.current.capture()
                  downloadBlob(blob, `${sanitizeFilename(detail.project.name)}.png`)
                } catch (error) {
                  store.setState({ notice: 'ดาวน์โหลดภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
                  console.error('[export] PNG capture failed', error)
                }
              })()
            }}
          >
            ดาวน์โหลด PNG
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              try {
                const json = exportProjectJson(store.getState().document)
                downloadBlob(new Blob([json], { type: 'application/json' }), `${sanitizeFilename(detail.project.name)}.nail.json`)
              } catch (error) {
                store.setState({ notice: 'ดาวน์โหลดไฟล์งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
                console.error('[export] JSON export failed', error)
              }
            }}
          >
            ดาวน์โหลด JSON
          </button>
          {autosave.message && <span className="error" role="alert">{autosave.message}</span>}
          {saveVersion.error && !conflict && (
            <span className="error" role="alert">
              {localizedTaskError(
                saveVersion.error,
                'บันทึกเวอร์ชันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
              )}
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={saveVersion.isPending || autosave.isVersionSavePending}
            onClick={() => {
              void autosave.runVersionSave(async ({ document }, lifecycle) => {
                const result = await saveVersion.mutateAsync({
                  projectId,
                  document,
                  expectedVersion: latestVersion,
                })
                if (lifecycle.isActive()) explicitSaveUi.current.success(result.versionNumber)
                void captureAndUploadThumbnail(projectId, thumbnailRef, queryClient).catch((error) => {
                  console.warn('[thumbnail] อัปโหลดภาพตัวอย่างไม่สำเร็จ ไม่กระทบการบันทึกเวอร์ชัน', error)
                })
                return result
              }).catch((error: unknown) => {
                explicitSaveUi.current.failure(error)
              })
            }}
          >
            {saveVersion.isPending || autosave.isVersionSavePending ? 'กำลังบันทึก…' : 'บันทึกเป็นเวอร์ชัน'}
          </button>
        </div>
      </header>

      {notice && (
        <p className="editor-notice" role="alert">
          {notice}
          <button type="button" className="btn btn-ghost" onClick={dismissNotice}>ปิด</button>
        </p>
      )}

      {offlineDraft.warning && (
        <p className="editor-notice" role="alert">
          {offlineDraft.warning}
          <button type="button" className="btn btn-ghost" onClick={offlineDraft.dismissWarning}>ปิด</button>
        </p>
      )}

      <div className="editor-body">
        <aside className="editor-sidebar">
          <EditorToolRail activePanel={activePanel} onChange={openPanel} />
          <div className="editor-inspector">
            <header className="editor-inspector-head">
              <div>
                <p className="editor-inspector-kicker">เครื่องมือ</p>
                <h2>{PANEL_TITLES[activePanel].title}</h2>
                <p className="muted">{PANEL_TITLES[activePanel].description}</p>
              </div>
            </header>
            <div className="editor-inspector-scroll">
              {activePanel === 'paint' && <PaintToolbar />}
              {activePanel === 'decorate' && <DecorationPanel />}
              {activePanel === 'hand' && <HandPanel />}
              {activePanel === 'ai' && <AiAssistantPanel />}
            </div>
          </div>
        </aside>
        <div className="viewport">
          <WebGlGuard>
            <NailScene fallback={null}>
              <DesignScene
                scale={handScale}
                parts={parts}
                textures={textures}
                onReady={handleReady}
              />
              <ThumbnailCapture ref={thumbnailRef} />
              <SnapshotCapture ref={snapshotRef} />
            </NailScene>
          </WebGlGuard>
        </div>
        <aside className="editor-right-panel">
          <div className="editor-panel-tabs" role="tablist" aria-label="แผงด้านขวา">
            <button
              type="button"
              role="tab"
              aria-selected={rightPanel === 'canvas'}
              className={`editor-panel-tab ${rightPanel === 'canvas' ? 'editor-panel-tab-active' : ''}`}
              onClick={() => setRightPanel('canvas')}
            >
              <span aria-hidden="true">▧</span> แคนวาส
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={rightPanel === 'history'}
              className={`editor-panel-tab ${rightPanel === 'history' ? 'editor-panel-tab-active' : ''}`}
              onClick={() => setRightPanel('history')}
            >
              <span aria-hidden="true">↺</span> ประวัติ
            </button>
          </div>
          <div className="editor-right-panel-scroll">
            {rightPanel === 'canvas' && (
              parts && textures
                ? <NailCanvas2D parts={parts} textures={textures} />
                : <p className="muted editor-panel-loading">กำลังเตรียมแคนวาส…</p>
            )}
            {rightPanel === 'history' && (
              <VersionHistoryPanel
                projectId={projectId}
                projectName={detail.project.name}
                latestVersion={latestVersion}
                onLoadedVersion={setDraftSourceVersion}
              />
            )}
          </div>
        </aside>
      </div>

      <NailStrip />

      {conflict && (
        <ConflictDialog
          projectName={detail.project.name}
          isReloading={isReloading}
          isDuplicating={duplicateProject.isPending}
          errorMessage={conflictActionError}
          onReloadServer={() => { void handleReloadServer() }}
          onDuplicateCurrent={handleDuplicateCurrent}
        />
      )}
      {offlineDraft.recoveryRecord && !conflict && (
        <RecoveryDialog
          isUsingServer={offlineDraft.isUsingServer}
          onRecoverLocal={offlineDraft.recoverLocal}
          onUseServer={() => { void offlineDraft.useServerDocument() }}
        />
      )}
    </section>
  )
}
