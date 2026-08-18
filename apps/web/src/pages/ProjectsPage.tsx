import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { Icon } from '@/components/Icon.tsx'
import { SkeletonGrid } from '@/components/Loading.tsx'
import { useCreateProject, useDeleteProject, useProjects } from '@/features/projects/useProjects.ts'

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000'
const PROJECT_DATE_FORMAT = new Intl.DateTimeFormat('th-TH', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

export function ProjectsPage() {
  const projects = useProjects()
  const createProject = useCreateProject()
  const deleteProject = useDeleteProject()
  const [name, setName] = useState('')

  function handleCreate(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    createProject.mutate(trimmed, { onSuccess: () => setName('') })
  }

  const projectCount = projects.data?.length ?? 0

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
        <button
          type="submit"
          className="btn btn-primary project-create-button"
          disabled={createProject.isPending || name.trim().length === 0}
        >
          <Icon name="plus" size={17} />
          <span>{createProject.isPending ? 'กำลังสร้าง…' : 'สร้างงานใหม่'}</span>
        </button>
      </form>

      {createProject.error instanceof ApiRequestError && (
        <p className="error project-feedback" role="alert">{createProject.error.message}</p>
      )}

      {projects.isPending && (
        <SkeletonGrid count={6} className="project-grid" />
      )}

      {projects.error && (
        <p className="error project-feedback" role="alert">
          โหลดรายการงานไม่สำเร็จ
          {projects.error instanceof ApiRequestError ? ` — ${projects.error.message}` : ''}
        </p>
      )}

      {projects.data?.length === 0 && (
        <div className="project-empty-state">
          <span className="project-empty-icon" aria-hidden="true"><Icon name="sparkle" size={24} /></span>
          <h2>เริ่มสร้างงานแรกของคุณ</h2>
          <p>ตั้งชื่อโปรเจกต์ด้านบน แล้วเริ่มออกแบบลายเล็บได้เลย</p>
        </div>
      )}

      {projects.data && projects.data.length > 0 && (
        <section className="projects-list-section" aria-labelledby="projects-list-title">
          <header className="projects-list-head">
            <div>
              <h2 id="projects-list-title">งานล่าสุด</h2>
              <p>เลือกงานเพื่อกลับไปแก้ไขต่อ</p>
            </div>
            <span className="project-count">{projectCount} งาน</span>
          </header>

          <ul className="project-grid">
            {projects.data.map((project) => (
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
                      แก้ไขล่าสุด {PROJECT_DATE_FORMAT.format(new Date(project.updatedAt))}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  className="project-card-delete"
                  aria-label={`ลบงาน ${project.name}`}
                  title="ลบงาน"
                  disabled={deleteProject.isPending}
                  onClick={() => {
                    if (window.confirm(`ลบงาน "${project.name}" ใช่หรือไม่?`)) {
                      deleteProject.mutate(project.id)
                    }
                  }}
                >
                  <Icon name="trash" size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  )
}
