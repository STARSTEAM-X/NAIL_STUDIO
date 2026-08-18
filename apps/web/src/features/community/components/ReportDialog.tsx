import { useState } from 'react'
import { TEMPLATE_REPORT_REASONS, type TemplateReportInput } from '@nail-studio/contracts'
import { Button } from '@/components/ui/Button.tsx'
import { Dialog } from '@/components/ui/Dialog.tsx'

const REASON_LABELS: Record<TemplateReportInput['reason'], string> = {
  spam: 'สแปมหรือโฆษณา',
  inappropriate: 'เนื้อหาไม่เหมาะสม',
  copyright: 'ละเมิดลิขสิทธิ์ผลงาน',
  harassment: 'คุกคามหรือสร้างความเกลียดชัง',
  other: 'เหตุผลอื่น',
}

interface ReportDialogProps {
  templateName: string
  pending: boolean
  onClose: () => void
  onSubmit: (input: TemplateReportInput) => void
}

/**
 * แจ้งรายงานผลงาน
 *
 * POST /templates/:id/report มีมาตั้งแต่ต้นแต่ไม่เคยมีปุ่มใน UI
 * ชุมชนสาธารณะที่ไม่มีช่องทางรายงานเป็นความเสี่ยงด้านการกำกับดูแลเนื้อหา
 */
export function ReportDialog({ templateName, pending, onClose, onSubmit }: ReportDialogProps) {
  const [reason, setReason] = useState<TemplateReportInput['reason']>('inappropriate')
  const [detail, setDetail] = useState('')

  return (
    <Dialog
      title="รายงานผลงานนี้"
      description={`ทีมงานจะตรวจสอบ “${templateName}” ตามเหตุผลที่คุณเลือก`}
      size="sm"
      onClose={pending ? undefined : onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onClose}>ยกเลิก</Button>
          <Button
            variant="danger"
            loading={pending}
            loadingLabel="กำลังส่ง…"
            onClick={() => onSubmit({ reason, ...(detail.trim() ? { detail: detail.trim() } : {}) })}
          >
            ส่งรายงาน
          </Button>
        </>
      }
    >
      <fieldset className="report-reasons">
        <legend>เหตุผลในการรายงาน</legend>
        {TEMPLATE_REPORT_REASONS.map((option) => (
          <label key={option} className="report-reason">
            <input
              type="radio"
              name="report-reason"
              value={option}
              checked={reason === option}
              onChange={() => setReason(option)}
            />
            <span>{REASON_LABELS[option]}</span>
          </label>
        ))}
      </fieldset>

      <label className="ap-field report-detail">
        <span>รายละเอียดเพิ่มเติม (ไม่บังคับ)</span>
        <textarea
          value={detail}
          rows={3}
          maxLength={2000}
          placeholder="อธิบายสิ่งที่พบ เพื่อให้ทีมงานตรวจสอบได้เร็วขึ้น"
          onChange={(event) => setDetail(event.target.value)}
        />
      </label>
    </Dialog>
  )
}
