import { useParams } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { LoadingScreen } from '@/components/Loading.tsx'
import { openingDocument, useProject, type ProjectDetail } from '@/features/projects/useProjects.ts'
import { NailEditor } from '@/features/design/NailEditor.tsx'
import { DesignStoreProvider } from '@/features/design/DesignStoreProvider.tsx'

export function EditorPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const project = useProject(projectId)

  if (!projectId) return <p className="error center">ไม่พบรหัสงาน</p>
  if (project.isPending) return <LoadingScreen label="กำลังโหลดงาน…" />

  if (project.error) {
    return (
      <p className="error center" role="alert">
        เปิดงานไม่สำเร็จ
        {project.error instanceof ApiRequestError ? ` — ${project.error.message}` : ''}
      </p>
    )
  }

  const detail: ProjectDetail | undefined = project.data
  if (!detail) return <p className="error center">ไม่พบงานที่ต้องการ</p>

  return (
    // key ผูกกับรหัสงาน — เปลี่ยนไปเปิดงานอีกชิ้นต้องได้สถานะใหม่ทั้งชุด
    // ไม่ใช่เอาเส้นของงานก่อนหน้าติดไปด้วย
    <DesignStoreProvider key={projectId} document={openingDocument(detail)}>
      <NailEditor projectId={projectId} detail={detail} />
    </DesignStoreProvider>
  )
}
