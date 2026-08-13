import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { useCreateProject, useDeleteProject, useProjects } from '@/features/projects/useProjects.ts'

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

  return (
    <section className="page">
      <header className="page-head">
        <h1>งานออกแบบของฉัน</h1>
        <form className="inline-form" onSubmit={handleCreate}>
          <input
            aria-label="ชื่องานใหม่"
            placeholder="ชื่องานใหม่"
            maxLength={120}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={createProject.isPending || name.trim().length === 0}
          >
            {createProject.isPending ? 'กำลังสร้าง…' : 'สร้างงานใหม่'}
          </button>
        </form>
      </header>

      {createProject.error instanceof ApiRequestError && (
        <p className="error" role="alert">{createProject.error.message}</p>
      )}

      {projects.isPending && <p className="muted">กำลังโหลดรายการงาน…</p>}

      {projects.error && (
        <p className="error" role="alert">
          โหลดรายการงานไม่สำเร็จ
          {projects.error instanceof ApiRequestError ? ` — ${projects.error.message}` : ''}
        </p>
      )}

      {projects.data?.length === 0 && (
        <p className="muted">ยังไม่มีงาน — สร้างงานแรกได้จากช่องด้านบน</p>
      )}

      <ul className="project-grid">
        {projects.data?.map((project) => (
          <li key={project.id} className="card project-card">
            <Link to={`/editor/${project.id}`} className="project-link">
              <span className="project-name">{project.name}</span>
              <span className="muted">
                {project.versionCount} เวอร์ชัน · แก้ไขล่าสุด{' '}
                {new Date(project.updatedAt).toLocaleString('th-TH')}
              </span>
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              disabled={deleteProject.isPending}
              onClick={() => {
                if (window.confirm(`ลบงาน "${project.name}" ใช่หรือไม่?`)) {
                  deleteProject.mutate(project.id)
                }
              }}
            >
              ลบ
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
