import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DesignDocument, ProjectSummary } from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export interface ProjectDetail {
  project: ProjectSummary
  version: { number: number; document: DesignDocument; createdAt: string }
  /** งานที่ autosave เก็บไว้แต่ยังไม่ได้กดบันทึกเป็นเวอร์ชัน */
  draft: { document: DesignDocument; updatedAt: string } | null
}

/** เอกสารที่ควรเปิดขึ้นมาแก้ต่อ — งานค้างมาก่อนเวอร์ชันล่าสุดเสมอ */
export function openingDocument(detail: ProjectDetail): DesignDocument {
  return detail.draft?.document ?? detail.version.document
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => apiFetch<ProjectSummary[]>('/projects'),
  })
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => apiFetch<ProjectDetail>(`/projects/${id}`),
    enabled: Boolean(id),
  })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      apiFetch<ProjectSummary>('/projects', { method: 'POST', body: { name } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ ok: boolean }>(`/projects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
    },
  })
}

export interface SaveVersionInput {
  projectId: string
  document: DesignDocument
  expectedVersion: number
}

export interface SaveDraftInput {
  projectId: string
  document: DesignDocument
  baseVersion: number
}

/**
 * บันทึกงานค้าง — ปลายทางของ autosave
 *
 * จงใจไม่ invalidate อะไรเลยเมื่อสำเร็จ: การดึงรายละเอียดงานใหม่ระหว่างที่ผู้ใช้
 * กำลังวาดอยู่ไม่ให้ประโยชน์อะไร (เรามีข้อมูลล่าสุดอยู่แล้ว) แต่จะทำให้ component
 * ทั้งชุด render ใหม่ทุก 3 วินาที ซึ่งรู้สึกได้ตอนลากเส้น
 */
export function useSaveDraft() {
  return useMutation({
    mutationFn: (input: SaveDraftInput) =>
      apiFetch<{ savedAt: string }>(`/projects/${input.projectId}/draft`, {
        method: 'PUT',
        body: { document: input.document, baseVersion: input.baseVersion },
      }),
  })
}

export function useSaveVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveVersionInput) =>
      apiFetch<{ versionNumber: number }>(`/projects/${input.projectId}/versions`, {
        method: 'POST',
        body: { document: input.document, expectedVersion: input.expectedVersion },
      }),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(input.projectId) })
      void queryClient.invalidateQueries({ queryKey: projectKeys.list() })
    },
  })
}
