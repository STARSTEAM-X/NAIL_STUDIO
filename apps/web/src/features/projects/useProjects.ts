import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  DesignDocument,
  DuplicateProjectInput,
  ProjectSummary,
  VersionSummary,
} from '@nail-studio/contracts'
import { apiFetch } from '@/api/client.ts'

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
  versions: (projectId: string) => [...projectKeys.all, 'versions', projectId] as const,
  version: (projectId: string, number: number) =>
    [...projectKeys.versions(projectId), number] as const,
}

export interface ProjectDetail {
  project: ProjectSummary
  version: { number: number; document: DesignDocument; createdAt: string }
  /** งานที่ autosave เก็บไว้แต่ยังไม่ได้กดบันทึกเป็นเวอร์ชัน */
  draft: { document: DesignDocument; updatedAt: string } | null
}

export interface ProjectVersion {
  number: number
  label: string | null
  createdAt: string
  document: DesignDocument
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

export function fetchProjectDetail(projectId: string) {
  return apiFetch<ProjectDetail>(`/projects/${projectId}`)
}

export function useVersions(projectId: string) {
  return useQuery({
    queryKey: projectKeys.versions(projectId),
    queryFn: () => apiFetch<VersionSummary[]>(`/projects/${projectId}/versions`),
    enabled: Boolean(projectId),
  })
}

export interface LoadVersionInput {
  projectId: string
  versionNumber: number
}

export function useLoadVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: LoadVersionInput) =>
      apiFetch<ProjectVersion>(`/projects/${input.projectId}/versions/${input.versionNumber}`),
    onSuccess: (version, input) => {
      queryClient.setQueryData(projectKeys.version(input.projectId, input.versionNumber), version)
    },
  })
}

export interface RenameVersionInput extends LoadVersionInput {
  label: string | null
}

export function useRenameVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: RenameVersionInput) =>
      apiFetch<{ number: number; label: string | null }>(
        `/projects/${input.projectId}/versions/${input.versionNumber}`,
        { method: 'PATCH', body: { label: input.label } },
      ),
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({
        queryKey: projectKeys.versions(input.projectId),
        exact: true,
      })
      void queryClient.invalidateQueries({
        queryKey: projectKeys.version(input.projectId, input.versionNumber),
        exact: true,
      })
    },
  })
}

export interface DuplicateProjectRequest extends DuplicateProjectInput {
  projectId: string
}

export function useDuplicateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, name, document }: DuplicateProjectRequest) =>
      apiFetch<ProjectSummary>(`/projects/${projectId}/duplicate`, {
        method: 'POST',
        body: { name, document },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.list(), exact: true })
    },
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
      void queryClient.invalidateQueries({
        queryKey: projectKeys.versions(input.projectId),
        exact: true,
      })
    },
  })
}
