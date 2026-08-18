import { useState } from 'react'
import type { TemplateCard } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { isLightPreview, previewGradient, thumbnailUrl } from '../format.ts'

interface TemplateThumbProps {
  template: Pick<TemplateCard, 'id' | 'name' | 'hasThumbnail' | 'primaryColor'>
  /** อัตราส่วนภาพ — ฟีดใช้กว้างกว่าการ์ดในกริด */
  ratio?: '16/10' | '4/3' | '1/1'
  className?: string
}

/**
 * ภาพตัวอย่างของดีไซน์
 *
 * ถ้าโหลดรูปจริงไม่สำเร็จ (เช่นไฟล์ถูกลบ) ต้องตกไปที่พื้นหลังไล่สีแทนที่จะเป็นกรอบรูปแตก
 * จึงเก็บสถานะ error ไว้ในคอมโพเนนต์นี้ที่เดียว
 */
export function TemplateThumb({ template, ratio = '16/10', className }: TemplateThumbProps) {
  const [failed, setFailed] = useState(false)
  const showImage = template.hasThumbnail && !failed

  return (
    <div
      className={`nc-thumb ${!showImage && isLightPreview(template.primaryColor) ? 'nc-thumb-light' : ''} ${className ?? ''}`}
      style={{
        aspectRatio: ratio.replace('/', ' / '),
        ...(showImage ? {} : { backgroundImage: previewGradient(template.primaryColor) }),
      }}
    >
      {showImage ? (
        <img
          src={thumbnailUrl(template.id)}
          crossOrigin="use-credentials"
          alt={`ภาพตัวอย่างของ ${template.name}`}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="nc-thumb-placeholder">
          <Icon name="image" size={20} />
          {template.primaryColor ?? 'Nail art'}
        </span>
      )}
    </div>
  )
}
