import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTemplateLike, useTemplateRemix, useTemplateShare } from './useTemplates.ts'

const SHARE_URL = (templateId: string) => `${window.location.origin}/community/templates/${templateId}`

/**
 * การกระทำต่อดีไซน์หนึ่งชิ้น (ไลก์ / แชร์ / รีมิกซ์) รวมไว้ที่เดียว
 *
 * ทั้งฟีด การ์ดในกริด และหน้ารายละเอียดต้องทำสามอย่างนี้เหมือนกันเป๊ะ
 * ถ้าปล่อยให้แต่ละหน้าเขียนเอง สถานะ pending/สำเร็จ/ผิดพลาด จะเพี้ยนกันเสมอ
 *
 * หมายเหตุ: API ยังไม่ส่งสถานะ "ผู้ใช้คนนี้ไลก์แล้วหรือยัง" มากับฟีด
 * จึงจำเฉพาะรายการที่กดในเซสชันนี้ (พฤติกรรมเดิมของหน้าเดิม) และให้ยอดจริงมาจากเซิร์ฟเวอร์
 */
export function useTemplateActions() {
  const navigate = useNavigate()
  const likeMutation = useTemplateLike()
  const shareMutation = useTemplateShare()
  const remixMutation = useTemplateRemix()
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set())
  const [sharedId, setSharedId] = useState<string | null>(null)
  const [shareError, setShareError] = useState<string | null>(null)
  const [remixError, setRemixError] = useState<string | null>(null)

  const isLiked = useCallback((templateId: string) => likedIds.has(templateId), [likedIds])

  const toggleLike = useCallback(
    (templateId: string) => {
      const liked = likedIds.has(templateId)
      likeMutation.mutate(
        { templateId, liked },
        {
          onSuccess: (result) => {
            setLikedIds((current) => {
              const next = new Set(current)
              if (result.liked) next.add(templateId)
              else next.delete(templateId)
              return next
            })
          },
        },
      )
    },
    [likeMutation, likedIds],
  )

  const share = useCallback(
    async (templateId: string, name: string) => {
      setShareError(null)
      try {
        let channel: 'link' | 'copy' = 'link'
        const url = SHARE_URL(templateId)
        if (navigator.share) {
          await navigator.share({ title: name, url })
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url)
          channel = 'copy'
        } else {
          throw new Error('เบราว์เซอร์นี้ไม่รองรับการแชร์ลิงก์')
        }
        shareMutation.mutate({ templateId, channel }, { onSuccess: () => setSharedId(templateId) })
      } catch (error) {
        // ผู้ใช้กดยกเลิกแผงแชร์ของระบบ ไม่ใช่ข้อผิดพลาดที่ต้องแจ้ง
        if (error instanceof DOMException && error.name === 'AbortError') return
        setShareError(error instanceof Error ? error.message : 'แชร์ผลงานไม่สำเร็จ')
      }
    },
    [shareMutation],
  )

  const remix = useCallback(
    (templateId: string) => {
      setRemixError(null)
      remixMutation.mutate(
        { templateId },
        {
          onSuccess: (result) => navigate(`/editor/${result.project.id}`),
          onError: (error) => setRemixError(error instanceof Error ? error.message : 'สร้างงานรีมิกซ์ไม่สำเร็จ'),
        },
      )
    },
    [navigate, remixMutation],
  )

  return {
    isLiked,
    toggleLike,
    isLikePending: (templateId: string) =>
      likeMutation.isPending && likeMutation.variables?.templateId === templateId,
    share,
    sharedId,
    shareError,
    dismissShareError: () => setShareError(null),
    isSharePending: (templateId: string) =>
      shareMutation.isPending && shareMutation.variables?.templateId === templateId,
    remix,
    remixError,
    isRemixPending: (templateId: string) =>
      remixMutation.isPending && remixMutation.variables?.templateId === templateId,
  }
}

export type TemplateActions = ReturnType<typeof useTemplateActions>
