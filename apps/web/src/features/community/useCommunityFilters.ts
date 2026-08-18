import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TEMPLATE_CATEGORIES, TEMPLATE_PRIMARY_COLORS, TEMPLATE_SORTS } from '@nail-studio/contracts'
import type { TemplateCategory, TemplateFilters, TemplatePrimaryColor, TemplateSort } from './useTemplates.ts'

export type CommunityView = 'feed' | 'grid'

export interface CommunityFeedState {
  view: CommunityView
  sort: TemplateSort
  category: TemplateCategory | ''
  color: TemplatePrimaryColor | ''
  /** คำค้นหา — กรองรายการที่โหลดมาแล้วในฝั่งเบราว์เซอร์ (API ยังไม่มีพารามิเตอร์ค้นหา) */
  q: string
}

const DEFAULT_STATE: CommunityFeedState = { view: 'feed', sort: 'latest', category: '', color: '', q: '' }

function parseState(params: URLSearchParams): CommunityFeedState {
  const view = params.get('view')
  const sort = params.get('sort')
  const category = params.get('category')
  const color = params.get('color')

  return {
    view: view === 'grid' ? 'grid' : 'feed',
    sort: TEMPLATE_SORTS.includes(sort as TemplateSort) ? (sort as TemplateSort) : 'latest',
    category: TEMPLATE_CATEGORIES.includes(category as TemplateCategory) ? (category as TemplateCategory) : '',
    color: TEMPLATE_PRIMARY_COLORS.includes(color as TemplatePrimaryColor) ? (color as TemplatePrimaryColor) : '',
    q: params.get('q') ?? '',
  }
}

function serializeState(state: CommunityFeedState): URLSearchParams {
  const params = new URLSearchParams()
  if (state.view !== DEFAULT_STATE.view) params.set('view', state.view)
  if (state.sort !== DEFAULT_STATE.sort) params.set('sort', state.sort)
  if (state.category) params.set('category', state.category)
  if (state.color) params.set('color', state.color)
  if (state.q.trim()) params.set('q', state.q)
  return params
}

/**
 * มุมมอง/ตัวกรอง/คำค้นของหน้าชุมชนเก็บไว้ใน query string ไม่ใช่ useState
 *
 * เหตุผล: ผู้ใช้กดเข้าไปดูดีไซน์แล้วกดย้อนกลับต้องได้ตัวกรองเดิม และลิงก์ที่กรองไว้ต้องส่งต่อได้
 * ค่าที่ไม่ถูกต้องใน URL จะถูกตัดทิ้งด้วยรายการค่าจาก contracts เสมอ
 */
export function useCommunityFilters() {
  const [searchParams, setSearchParams] = useSearchParams()
  const state = useMemo(() => parseState(searchParams), [searchParams])

  const buildHref = useCallback(
    (patch: Partial<CommunityFeedState>) => {
      const params = serializeState({ ...state, ...patch })
      const query = params.toString()
      return query ? `/community?${query}` : '/community'
    },
    [state],
  )

  const setState = useCallback(
    (patch: Partial<CommunityFeedState>, options?: { replace?: boolean }) => {
      setSearchParams(serializeState({ ...state, ...patch }), { replace: options?.replace ?? false })
    },
    [setSearchParams, state],
  )

  const reset = useCallback(() => setSearchParams(new URLSearchParams()), [setSearchParams])

  /** เฉพาะส่วนที่ส่งให้ API — คำค้นและมุมมองเป็นเรื่องฝั่ง UI ล้วนๆ */
  const apiFilters = useMemo<TemplateFilters>(
    () => ({
      sort: state.sort,
      ...(state.category ? { category: state.category } : {}),
      ...(state.color ? { color: state.color } : {}),
    }),
    [state.category, state.color, state.sort],
  )

  const hasActiveFilters = Boolean(state.category || state.color || state.q.trim() || state.sort !== 'latest')

  return { state, setState, buildHref, reset, apiFilters, hasActiveFilters }
}
