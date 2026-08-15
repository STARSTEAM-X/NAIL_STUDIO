import { Link, useParams } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { NailScene } from '@/3d/scene/NailScene.tsx'
import { ReadOnlyDesignScene } from '@/3d/scene/ReadOnlyDesignScene.tsx'
import { WebGlGuard } from '@/3d/scene/WebGlGuard.tsx'
import { useTemplate } from '@/features/community/useTemplates.ts'
import { DesignStoreProvider } from '@/features/design/DesignStoreProvider.tsx'

export function TemplatePreviewPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const template = useTemplate(templateId)

  if (!templateId) return <p className="error center">ไม่พบรหัสดีไซน์</p>
  if (template.isPending) return <p className="muted center">กำลังโหลดตัวอย่าง 3D…</p>
  if (template.error) {
    return (
      <p className="error center" role="alert">
        เปิดตัวอย่างไม่สำเร็จ
        {template.error instanceof ApiRequestError ? ` — ${template.error.message}` : ''}
      </p>
    )
  }
  if (!template.data) return <p className="error center">ไม่พบดีไซน์ที่ต้องการ</p>

  const detail = template.data
  return (
    <DesignStoreProvider key={templateId} document={detail.document}>
      <section className="page template-preview-page">
        <header className="page-head template-preview-head">
          <div>
            <Link to="/community" className="back-link">← กลับไปชุมชน</Link>
            <p className="eyebrow">READ-ONLY 3D PREVIEW</p>
            <h1>{detail.name}</h1>
            <p className="muted">โดย {detail.author.displayName}</p>
          </div>
          <div className="template-preview-stats" aria-label="สถิติการมีส่วนร่วม">
            <span>♥ {detail.likeCount}</span>
            <span>↻ {detail.remixCount}</span>
            <span>💬 {detail.commentCount}</span>
          </div>
        </header>

        <div className="template-preview-stage">
          <WebGlGuard>
            <NailScene fallback={null}>
              <ReadOnlyDesignScene />
            </NailScene>
          </WebGlGuard>
        </div>

        {detail.caption && <p className="template-preview-caption">{detail.caption}</p>}
      </section>
    </DesignStoreProvider>
  )
}
