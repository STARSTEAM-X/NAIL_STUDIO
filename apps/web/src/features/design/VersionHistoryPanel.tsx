import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useDuplicateProject,
  useLoadVersion,
  useRenameVersion,
  useVersions,
} from '@/features/projects/useProjects.ts'
import {
  buildDuplicateCurrentInput,
  loadHistoricalVersion,
  localizedTaskError,
} from '@/features/projects/versionActions.ts'
import { useDesignStoreApi } from './DesignStoreProvider.tsx'

interface Props {
  projectId: string
  projectName: string
  latestVersion: number
  onLoadedVersion: (versionNumber: number) => void
}

const DATE_FORMAT = new Intl.DateTimeFormat('th-TH', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} ไบต์`
  return `${(bytes / 1024).toFixed(1)} KB`
}

export function VersionHistoryPanel({
  projectId,
  projectName,
  latestVersion,
  onLoadedVersion,
}: Props) {
  const navigate = useNavigate()
  const store = useDesignStoreApi()
  const versions = useVersions(projectId)
  const loadVersion = useLoadVersion()
  const renameVersion = useRenameVersion()
  const duplicateProject = useDuplicateProject()
  const [draftLabels, setDraftLabels] = useState<Record<number, string>>({})
  const [duplicateName, setDuplicateName] = useState(`${projectName} (สำเนา)`)
  const [loadedMessage, setLoadedMessage] = useState<string | null>(null)

  const handleDuplicate = (event: FormEvent) => {
    event.preventDefault()
    duplicateProject.mutate(
      {
        projectId,
        ...buildDuplicateCurrentInput(duplicateName, () => store.getState().document),
      },
      { onSuccess: (project) => navigate(`/editor/${project.id}`) },
    )
  }

  return (
    <aside className="version-panel" aria-labelledby="version-history-title">
      <div className="version-panel-head">
        <h2 id="version-history-title">ประวัติเวอร์ชัน</h2>
        <span className="muted">ล่าสุด {latestVersion}</span>
      </div>

      <p className="hint">
        เวอร์ชันเก่าจะเปิดเป็นฉบับร่างใหม่ การบันทึกครั้งถัดไปยังต่อจากเวอร์ชันล่าสุด
      </p>

      {versions.isPending && <p className="muted">กำลังโหลดประวัติ…</p>}
      {versions.error && (
        <p className="error" role="alert">
          {localizedTaskError(versions.error, 'โหลดประวัติเวอร์ชันไม่สำเร็จ')}
        </p>
      )}
      {loadVersion.error && (
        <p className="error" role="alert">
          {localizedTaskError(loadVersion.error, 'เปิดเวอร์ชันนี้ไม่สำเร็จ')}
        </p>
      )}
      {renameVersion.error && (
        <p className="error" role="alert">
          {localizedTaskError(renameVersion.error, 'เปลี่ยนชื่อเวอร์ชันไม่สำเร็จ')}
        </p>
      )}
      {loadedMessage && <p className="ok" role="status">{loadedMessage}</p>}

      {versions.data && versions.data.length === 0 && (
        <p className="muted">ยังไม่มีเวอร์ชันที่บันทึกไว้</p>
      )}

      <ol className="version-list">
        {versions.data?.map((version) => {
          const label = draftLabels[version.number] ?? version.label ?? ''
          return (
            <li key={version.number} className="version-card">
              <div className="version-meta">
                <strong>เวอร์ชัน {version.number}</strong>
                <span>{DATE_FORMAT.format(new Date(version.createdAt))}</span>
                <span>{formatBytes(version.documentBytes)}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={loadVersion.isPending}
                onClick={() => {
                  loadVersion.mutate(
                    { projectId, versionNumber: version.number },
                    {
                      onSuccess: (loaded) => {
                        const result = loadHistoricalVersion(
                          loaded,
                          latestVersion,
                          store.getState().loadDocument,
                        )
                        onLoadedVersion(result.loadedVersion)
                        setLoadedMessage(
                          `เปิดเวอร์ชัน ${result.loadedVersion} เป็นฉบับร่างแล้ว ฐานบันทึกยังเป็นเวอร์ชัน ${result.saveBaseVersion}`,
                        )
                      },
                    },
                  )
                }}
              >
                เปิดเป็นฉบับร่าง
              </button>
              <form
                className="version-label-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  const trimmed = label.trim()
                  renameVersion.mutate({
                    projectId,
                    versionNumber: version.number,
                    label: trimmed.length > 0 ? trimmed : null,
                  })
                }}
              >
                <label htmlFor={`version-label-${version.number}`}>ชื่อกำกับ</label>
                <div className="version-label-row">
                  <input
                    id={`version-label-${version.number}`}
                    value={label}
                    maxLength={120}
                    placeholder="ยังไม่มีชื่อกำกับ"
                    onChange={(event) => setDraftLabels((current) => ({
                      ...current,
                      [version.number]: event.target.value,
                    }))}
                  />
                  <button
                    type="submit"
                    className="btn btn-ghost"
                    disabled={renameVersion.isPending}
                  >
                    บันทึกชื่อ
                  </button>
                </div>
              </form>
            </li>
          )
        })}
      </ol>

      <form className="version-duplicate" onSubmit={handleDuplicate}>
        <label htmlFor="duplicate-project-name">ทำสำเนาจากงานบนหน้าจอตอนนี้</label>
        <input
          id="duplicate-project-name"
          value={duplicateName}
          maxLength={120}
          required
          onChange={(event) => setDuplicateName(event.target.value)}
        />
        {duplicateProject.error && (
          <p className="error" role="alert">
            {localizedTaskError(duplicateProject.error, 'ทำสำเนางานไม่สำเร็จ')}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-ghost"
          disabled={duplicateProject.isPending}
        >
          {duplicateProject.isPending ? 'กำลังทำสำเนา…' : 'ทำสำเนางานปัจจุบัน'}
        </button>
      </form>
    </aside>
  )
}
