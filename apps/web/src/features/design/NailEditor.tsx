import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import type { CreateTemplateInput } from '@nail-studio/contracts'
import { useCurrentUser, useLogout } from '@/features/auth/useAuth.ts'
import { useCreateTemplate } from '@/features/community/useTemplates.ts'
import { NotificationBell } from '@/components/NotificationBell.tsx'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { ThumbnailCapture, type ThumbnailCaptureHandle } from '@/3d/scene/ThumbnailCapture.tsx'
import { SnapshotCapture, type SnapshotCaptureHandle } from '@/3d/scene/SnapshotCapture.tsx'
import { exportProjectJson } from '@/3d/scene/exporters/exportProjectJson.ts'
import { DesignScene } from '@/3d/scene/DesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import type { HandParts } from '@/3d/models/HandModel.tsx'
import { computeNailHulls } from '@/3d/geometry/nailHulls.ts'
import { useNailTextures } from '@/3d/painting/useNailTextures.ts'
import {
  captureAndUploadThumbnail,
  fetchProjectDetail,
  openingDocument,
  projectKeys,
  useRenameProject,
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
import { EditorProfileDropdown } from './EditorProfileDropdown.tsx'
import { ShareTemplateDialog } from './ShareTemplateDialog.tsx'
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
  const { data: user } = useCurrentUser()
  const userId = user?.id ?? null
  const logout = useLogout()
  const store = useDesignStoreApi()
  const [activePanel, setActivePanel] = useState<EditorPanelId>('paint')
  const [rightPanel, setRightPanel] = useState<'canvas' | 'history'>('canvas')
  const [projectName, setProjectName] = useState(detail.project.name)
  const [editingProjectName, setEditingProjectName] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
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
  const hulls = useMemo(() => parts ? computeNailHulls(parts) : new Map(), [parts])
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
  const renameProject = useRenameProject()
  const saveVersion = useSaveVersion()
  const createTemplate = useCreateTemplate()
  const duplicateProject = useDuplicateProject()
  const [draftSourceVersion, setDraftSourceVersion] = useState<number | null>(null)
  const [conflict, setConflict] = useState<ServerVersionConflict | null>(null)
  const [isReloading, setIsReloading] = useState(false)
  const [conflictActionError, setConflictActionError] = useState<string | null>(null)
  const [shareDialogOpen, setShareDialogOpen] = useState(false)
  const [shareError, setShareError] = useState<string | null>(null)
  const latestVersion = saveBaseVersion
  const versionSummary = draftSourceVersion === null
    ? `เวอร์ชัน ${latestVersion}`
    : `ฉบับร่างจากเวอร์ชัน ${draftSourceVersion} · ฐานบันทึกเวอร์ชัน ${latestVersion}`
  const autosaveLabel = autosave.status !== 'idle'
    ? AUTOSAVE_LABELS[autosave.status]
    : detail.draft
      ? 'เปิดจากงานค้างล่าสุด'
      : 'บันทึกแล้ว'
  const autosaveTone = autosave.status === 'error'
    ? 'error'
    : autosave.status === 'saving' || autosave.status === 'pending'
      ? 'busy'
      : 'saved'
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

  useEffect(() => {
    setProjectName(detail.project.name)
  }, [detail.project.name])

  const beginProjectRename = () => {
    setEditingProjectName(true)
    setProjectNameDraft(projectName)
  }

  const cancelProjectRename = () => {
    setEditingProjectName(false)
    setProjectNameDraft('')
  }

  const commitProjectRename = () => {
    const value = projectNameDraft.trim()
    if (!value) {
      store.setState({ notice: 'กรุณาตั้งชื่อโปรเจกต์' })
      cancelProjectRename()
      return
    }
    if (value === projectName) {
      cancelProjectRename()
      return
    }

    renameProject.mutate(
      { projectId, name: value },
      {
        onSuccess: (updatedProject) => {
          setProjectName(updatedProject.name)
          cancelProjectRename()
        },
        onError: (error) => {
          store.setState({ notice: localizedTaskError(error, 'เปลี่ยนชื่อโปรเจกต์ไม่สำเร็จ') })
          cancelProjectRename()
        },
      },
    )
  }

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })
  }

  const saveCurrentVersion = () => autosave.runVersionSave(async ({ document }, lifecycle) => {
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
  })

  const handleShareTemplate = (input: Omit<CreateTemplateInput, 'projectId' | 'versionNumber'>) => {
    setShareError(null)
    void saveCurrentVersion().then((saved) => {
      if (!saved) {
        setShareError('กำลังบันทึกงานอยู่ กรุณาลองแชร์อีกครั้ง')
        return
      }
      createTemplate.mutate(
        { ...input, projectId, versionNumber: saved.versionNumber },
        {
          onSuccess: () => {
            setShareDialogOpen(false)
            store.setState({ notice: 'แชร์ผลงานลง Community และโปรไฟล์ของคุณแล้ว' })
          },
          onError: (error) => setShareError(localizedTaskError(error, 'แชร์ผลงานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง')),
        },
      )
    }).catch((error: unknown) => {
      explicitSaveUi.current.failure(error)
      setShareError(localizedTaskError(error, 'บันทึกงานก่อนแชร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'))
    })
  }

  return (
    <section className="editor">
      <header className="editor-topbar">
        <div className="editor-topbar-left">
          <button
            type="button"
            className="editor-topbar-icon-button editor-topbar-back"
            aria-label="กลับไปงานของฉัน"
            title="กลับไปงานของฉัน"
            onClick={() => navigate('/projects')}
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="editor-topbar-brand"
            aria-label="กลับไปหน้าโปรเจกต์ Nail Studio"
            title="กลับไปหน้าโปรเจกต์ Nail Studio"
            onClick={() => navigate('/projects')}
          >
            <span className="editor-topbar-logo" aria-hidden="true">NS</span>
            <span className="editor-topbar-brand-name">Nail Studio</span>
          </button>
          <span className="editor-topbar-divider" aria-hidden="true" />
          <div className="editor-topbar-project">
            {editingProjectName ? (
              <input
                className="editor-topbar-project-input"
                autoFocus
                value={projectNameDraft}
                maxLength={120}
                disabled={renameProject.isPending}
                aria-label="ชื่อโปรเจกต์"
                onChange={(event) => setProjectNameDraft(event.target.value)}
                onBlur={commitProjectRename}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    event.currentTarget.blur()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    cancelProjectRename()
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="editor-topbar-project-name"
                title="คลิกเพื่อเปลี่ยนชื่อโปรเจกต์"
                onClick={beginProjectRename}
              >
                {projectName}
              </button>
            )}
            <span>{versionSummary}</span>
          </div>
        </div>

        <div className="editor-topbar-status" role="status" aria-live="polite">
          <span className={`editor-save-dot editor-save-dot-${autosaveTone}`} aria-hidden="true" />
          <span>{autosaveLabel}</span>
        </div>

        <div className="editor-topbar-actions">
          <HistoryControls />
          <span className="editor-topbar-divider" aria-hidden="true" />
          <button
            type="button"
            className="editor-topbar-action"
            title="ดาวน์โหลดภาพ PNG"
            onClick={() => {
              void (async () => {
                try {
                  if (!snapshotRef.current) throw new Error('canvas ยังไม่พร้อม')
                  const blob = await snapshotRef.current.capture()
                  downloadBlob(blob, `${sanitizeFilename(projectName)}.png`)
                } catch (error) {
                  store.setState({ notice: 'ดาวน์โหลดภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
                  console.error('[export] PNG capture failed', error)
                }
              })()
            }}
          >
            <span className="editor-topbar-action-icon" aria-hidden="true">↓</span>
            <span className="editor-topbar-action-label">PNG</span>
          </button>
          <button
            type="button"
            className="editor-topbar-action"
            title="ดาวน์โหลดไฟล์งาน JSON"
            onClick={() => {
              try {
                const json = exportProjectJson(store.getState().document)
                downloadBlob(new Blob([json], { type: 'application/json' }), `${sanitizeFilename(projectName)}.nail.json`)
              } catch (error) {
                store.setState({ notice: 'ดาวน์โหลดไฟล์งานไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' })
                console.error('[export] JSON export failed', error)
              }
            }}
          >
            <span className="editor-topbar-action-icon" aria-hidden="true">⇩</span>
            <span className="editor-topbar-action-label">JSON</span>
          </button>
          <button
            type="button"
            className="editor-topbar-action editor-topbar-share"
            title="แชร์ผลงานลง Community"
            disabled={saveVersion.isPending || autosave.isVersionSavePending || createTemplate.isPending}
            onClick={() => {
              setShareError(null)
              setShareDialogOpen(true)
            }}
          >
            <span className="editor-topbar-action-icon" aria-hidden="true">↗</span>
            <span className="editor-topbar-action-label">แชร์</span>
          </button>
          <div className="editor-topbar-nav" aria-label="ทางลัด">
            <button type="button" className="editor-topbar-link" onClick={() => navigate('/community')}>ชุมชน</button>
            <button type="button" className="editor-topbar-link" onClick={() => navigate('/appointments')}>นัดหมาย</button>
            <NotificationBell />
          </div>
          <EditorProfileDropdown
            user={user}
            isLoggingOut={logout.isPending}
            onLogout={handleLogout}
            onViewProfile={() => {
              if (user) navigate(`/users/${user.id}`)
            }}
            onUnavailableAction={(label) => {
              store.setState({ notice: `${label}ยังไม่เปิดใช้งานในรุ่นนี้` })
            }}
          />
          <div className="editor-topbar-feedback" aria-live="polite">
            {autosave.message && <span className="error" role="alert">{autosave.message}</span>}
            {saveVersion.error && !conflict && (
              <span className="error" role="alert">
                {localizedTaskError(
                  saveVersion.error,
                  'บันทึกเวอร์ชันไม่สำเร็จ กรุณาลองใหม่อีกครั้ง',
                )}
              </span>
            )}
          </div>
          <button
            type="button"
            className="editor-topbar-primary"
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
            <span aria-hidden="true">✓</span>
            <span>{saveVersion.isPending || autosave.isVersionSavePending ? 'กำลังบันทึก…' : 'บันทึก'}</span>
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
              {activePanel === 'ai' && <AiAssistantPanel hulls={hulls} />}
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
                projectName={projectName}
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
          projectName={projectName}
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
      {shareDialogOpen && (
        <ShareTemplateDialog
          defaultName={projectName}
          pending={saveVersion.isPending || autosave.isVersionSavePending || createTemplate.isPending}
          errorMessage={shareError}
          onClose={() => setShareDialogOpen(false)}
          onSubmit={handleShareTemplate}
        />
      )}
    </section>
  )
}
