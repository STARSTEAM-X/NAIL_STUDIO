import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectSummary } from '@nail-studio/contracts'
import { API_BASE } from '@/api/client.ts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx'
import { EmptyState, ErrorState, FeedSkeletonList } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import {
  fetchProjectDetail,
  openingDocument,
  useCreateProject,
  useDeleteProject,
  useDuplicateProject,
  useProjects,
} from '@/features/projects/useProjects.ts'
import { formatDate } from '@/lib/datetime.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

type SortKey = 'updated' | 'created' | 'name'

const SORT_LABELS: Record<SortKey, string> = {
  updated: 'แก้ไขล่าสุด',
  created: 'สร้างล่าสุด',
  name: 'ชื่อ ก–ฮ',
}

export function ProjectsPage() {
  usePageTitle('งานออกแบบของฉัน')
  const projects = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const duplicateProject = useDuplicateProject()
  const toast = useToast()

  const [name, setName] = useState('')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [pendingDelete, setPendingDelete] = useState<ProjectSummary | null>(null)
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null)

  const items = useMemo(() => {
    const all = projects.data ?? []
    const needle = search.trim().toLowerCase()
    const filtered = needle ? all.filter((project) => project.name.toLowerCase().includes(needle)) : all
    return [...filtered].sort((a, b) => {
      if (sort === 'name') return a.name.localeCompare(b.name, 'th')
      if (sort === 'created') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })
  }, [projects.data, search, sort])

  const projectCount = projects.data?.length ?? 0

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createProject.mutate(trimmed, {
      onSuccess: () => { setName(''); toast.success('สร้างงานใหม่แล้ว') },
      onError: (error) => toast.error(error instanceof Error ? error.message : 'สร้างงานไม่สำเร็จ'),
    })
  }

  /**
   * ทำสำเนาต้องส่งเอกสารงานไปด้วย (duplicateProjectSchema บังคับ)
   * จึงต้องดึงรายละเอียดงานก่อนหนึ่งครั้ง — หน้ารายการมีแค่ข้อมูลสรุป
   */
  const duplicate = async (project: ProjectSummary) => {
    setDuplicatingId(project.id)
    try {
      const detail = await fetchProjectDetail(project.id)
      await duplicateProject.mutateAsync({
        projectId: project.id,
        name: `${project.name} (สำเนา)`,
        document: openingDocument(detail),
      })
      toast.success('ทำสำเนางานแล้ว')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'ทำสำเนาไม่สำเร็จ')
    } finally {
      setDuplicatingId(null)
    }
  }

  return (
    <section className="page projects-page">
      <header className="projects-hero">
        <div className="projects-hero-copy">
          <p className="eyebrow">WORKSPACE</p>
          <h1>งานออกแบบของฉัน</h1>
          <p>เก็บไอเดียลายเล็บทั้งหมดไว้ในที่เดียว แล้วกลับมาแก้ไขต่อได้ทุกเมื่อ</p>
        </div>
        <div className="projects-summary" aria-label="สรุปงาน">
          <span className="projects-summary-icon"><Icon name="folder" size={18} /></span>
          <span>
            <strong>{projects.isPending ? '—' : projectCount}</strong>
            <small>งานทั้งหมด</small>
          </span>
        </div>
      </header>

      <form className="project-create-form" onSubmit={handleCreate}>
        <span className="project-create-icon" aria-hidden="true"><Icon name="plus" size={18} /></span>
        <label className="project-create-field">
          <span>เริ่มงานใหม่</span>
          <input
            aria-label="ชื่อโปรเจกต์ใหม่"
            placeholder="ตั้งชื่อโปรเจกต์ เช่น Summer nude collection"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <Button
          type="submit"
          variant="primary"
          icon="plus"
          className="project-create-button"
          disabled={name.trim().length === 0}
          loading={createProject.isPending}
          loadingLabel="กำลังสร้าง…"
        >
          สร้างงานใหม่
        </Button>
      </form>

      {projectCount > 0 && (
        <div className="projects-toolbar">
          <div className="nc-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              value={search}
              placeholder="ค้นหาชื่องาน"
              aria-label="ค้นหางานออกแบบ"
              onChange={(event) => setSearch(event.target.value)}
            />
            {search && (
              <button type="button" className="nc-search-clear" aria-label="ล้างคำค้นหา" onClick={() => setSearch('')}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>
          <label className="projects-sort">
            <span className="nc-visually-hidden">จัดเรียงตาม</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                <option key={key} value={key}>{SORT_LABELS[key]}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {projects.isPending && <FeedSkeletonList variant="tile" count={6} />}

      {projects.error && (
        <ErrorState
          title="โหลดรายการงานไม่สำเร็จ"
          error={projects.error}
          onRetry={() => void projects.refetch()}
        />
      )}

      {!projects.isPending && !projects.error && projectCount === 0 && (
        <EmptyState
          icon="sparkle"
          title="เริ่มสร้างงานแรกของคุณ"
          description="ตั้งชื่อโปรเจกต์ด้านบน แล้วเริ่มออกแบบลายเล็บ 3 มิติได้เลย"
        />
      )}

      {projectCount > 0 && items.length === 0 && (
        <EmptyState icon="search" title="ไม่พบงานที่ตรงกับคำค้นหา" description="ลองใช้คำอื่น หรือล้างคำค้นหา">
          <Button variant="ghost" onClick={() => setSearch('')}>ล้างคำค้นหา</Button>
        </EmptyState>
      )}

      {items.length > 0 && (
        <section className="projects-list-section" aria-labelledby="projects-list-title">
          <header className="projects-list-head">
            <div>
              <h2 id="projects-list-title">{search ? 'ผลการค้นหา' : 'งานล่าสุด'}</h2>
              <p>เลือกงานเพื่อกลับไปแก้ไขต่อ</p>
            </div>
            <span className="project-count">{items.length} งาน</span>
          </header>

          <ul className="project-grid">
            {items.map((project) => (
              <li key={project.id} className="card project-card">
                <Link to={`/editor/${project.id}`} className="project-link">
                  <div className="project-card-preview">
                    {project.hasThumbnail ? (
                      <img
                        src={`${API_BASE}/api/v1/projects/${project.id}/thumbnail`}
                        crossOrigin="use-credentials"
                        alt={`ภาพตัวอย่างของ ${project.name}`}
                        loading="lazy"
                        className="project-thumbnail"
                      />
                    ) : (
                      <div className="project-thumbnail-placeholder" aria-hidden="true">
                        <Icon name="sparkle" size={26} />
                        <span>ยังไม่มีภาพตัวอย่าง</span>
                      </div>
                    )}
                    <span className="project-card-badge">{project.versionCount} เวอร์ชัน</span>
                  </div>
                  <div className="project-card-info">
                    <div className="project-card-title">
                      <span className="project-name">{project.name}</span>
                      <span className="project-open-icon" aria-hidden="true"><Icon name="arrow-up-right" size={17} /></span>
                    </div>
                    <span className="project-card-meta">
                      <Icon name="clock" size={14} />
                      แก้ไขล่าสุด {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </Link>
                <div className="project-card-actions">
                  <button
                    type="button"
                    className="project-card-action"
                    aria-label={`ทำสำเนางาน ${project.name}`}
                    title="ทำสำเนา"
                    disabled={duplicatingId === project.id}
                    onClick={() => { void duplicate(project) }}
                  >
                    <Icon name={duplicatingId === project.id ? 'clock' : 'layers'} size={16} />
                  </button>
                  <button
                    type="button"
                    className="project-card-action project-card-delete"
                    aria-label={`ลบงาน ${project.name}`}
                    title="ลบงาน"
                    onClick={() => setPendingDelete(project)}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={`ลบงาน "${pendingDelete.name}"?`}
          message={`งานนี้มี ${pendingDelete.versionCount} เวอร์ชันที่จะถูกลบไปด้วย และผลงานที่เผยแพร่จากงานนี้จะไม่สามารถเปิดดูรายละเอียดได้อีก การกระทำนี้ย้อนกลับไม่ได้`}
          confirmLabel="ลบงานนี้"
          destructive
          pending={deleteProject.isPending}
          onConfirm={() =>
            deleteProject.mutate(pendingDelete.id, {
              onSuccess: () => { toast.success('ลบงานแล้ว'); setPendingDelete(null) },
              onError: (error) => toast.error(error instanceof Error ? error.message : 'ลบงานไม่สำเร็จ'),
            })
          }
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </section>
  )
}
