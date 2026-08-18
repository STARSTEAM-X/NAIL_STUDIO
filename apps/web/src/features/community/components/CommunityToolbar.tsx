import { useEffect, useState } from 'react'
import { TEMPLATE_CATEGORIES, TEMPLATE_PRIMARY_COLORS } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { PRIMARY_COLOR_SWATCHES } from '../format.ts'
import type { CommunityFeedState } from '../useCommunityFilters.ts'
import type { TemplateCategory, TemplatePrimaryColor } from '../useTemplates.ts'

interface CommunityToolbarProps {
  state: CommunityFeedState
  setState: (patch: Partial<CommunityFeedState>, options?: { replace?: boolean }) => void
  hasActiveFilters: boolean
  onReset: () => void
  resultCount: number
  isLoading: boolean
}

/**
 * แถบควบคุมของฟีด: ค้นหา · เรียงลำดับ · สลับมุมมอง · ตัวกรองหมวดหมู่และสี
 *
 * ช่องค้นหาเก็บค่าไว้ในคอมโพเนนต์ก่อน แล้วค่อยดันขึ้น URL แบบหน่วงเวลา
 * เพื่อไม่ให้พิมพ์ทีละตัวอักษรแล้วสร้างประวัติการนำทางเป็นสิบรายการ
 */
export function CommunityToolbar({
  state,
  setState,
  hasActiveFilters,
  onReset,
  resultCount,
  isLoading,
}: CommunityToolbarProps) {
  const [query, setQuery] = useState(state.q)
  const [filtersOpen, setFiltersOpen] = useState(false)

  useEffect(() => { setQuery(state.q) }, [state.q])

  useEffect(() => {
    if (query === state.q) return
    const timer = window.setTimeout(() => setState({ q: query }, { replace: true }), 250)
    return () => window.clearTimeout(timer)
  }, [query, setState, state.q])

  return (
    <section className="nc-toolbar" aria-label="ค้นหาและกรองผลงาน">
      <div className="nc-toolbar-row">
        <div className="nc-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder="ค้นหาชื่อผลงาน คำบรรยาย หรือผู้สร้าง"
            aria-label="ค้นหาผลงานในชุมชน"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button type="button" className="nc-search-clear" aria-label="ล้างคำค้นหา" onClick={() => setQuery('')}>
              <Icon name="x" size={14} />
            </button>
          )}
        </div>

        <div className="nc-segment" role="group" aria-label="เรียงลำดับ">
          <button
            type="button"
            className={state.sort === 'latest' ? 'nc-segment-on' : ''}
            aria-pressed={state.sort === 'latest'}
            onClick={() => setState({ sort: 'latest' })}
          >
            <Icon name="clock" size={15} /><span>ล่าสุด</span>
          </button>
          <button
            type="button"
            className={state.sort === 'popular' ? 'nc-segment-on' : ''}
            aria-pressed={state.sort === 'popular'}
            onClick={() => setState({ sort: 'popular' })}
          >
            <Icon name="flame" size={15} /><span>ยอดนิยม</span>
          </button>
        </div>

        <div className="nc-segment nc-segment-icons" role="group" aria-label="รูปแบบการแสดงผล">
          <button
            type="button"
            className={state.view === 'feed' ? 'nc-segment-on' : ''}
            aria-pressed={state.view === 'feed'}
            aria-label="มุมมองฟีด"
            onClick={() => setState({ view: 'feed' })}
          >
            <Icon name="rows" size={16} />
          </button>
          <button
            type="button"
            className={state.view === 'grid' ? 'nc-segment-on' : ''}
            aria-pressed={state.view === 'grid'}
            aria-label="มุมมองกริด"
            onClick={() => setState({ view: 'grid' })}
          >
            <Icon name="grid" size={16} />
          </button>
        </div>

        <button
          type="button"
          className={`nc-filter-toggle ${filtersOpen ? 'nc-filter-toggle-on' : ''}`}
          aria-expanded={filtersOpen}
          aria-controls="nc-filter-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="sliders" size={16} /><span>ตัวกรอง</span>
        </button>
      </div>

      <div id="nc-filter-panel" className={`nc-filter-panel ${filtersOpen ? 'nc-filter-open' : ''}`} hidden={!filtersOpen}>
        <div className="nc-filter-group">
          <p className="nc-filter-label">สไตล์</p>
          <div className="nc-chip-row">
            <button
              type="button"
              className={`nc-chip ${state.category === '' ? 'nc-chip-on' : ''}`}
              onClick={() => setState({ category: '' })}
            >
              ทุกสไตล์
            </button>
            {TEMPLATE_CATEGORIES.map((option) => (
              <button
                key={option}
                type="button"
                className={`nc-chip ${state.category === option ? 'nc-chip-on' : ''}`}
                onClick={() => setState({ category: state.category === option ? '' : (option as TemplateCategory) })}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="nc-filter-group">
          <p className="nc-filter-label">สีหลัก</p>
          <div className="nc-chip-row">
            <button
              type="button"
              className={`nc-chip ${state.color === '' ? 'nc-chip-on' : ''}`}
              onClick={() => setState({ color: '' })}
            >
              ทุกสี
            </button>
            {TEMPLATE_PRIMARY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                className={`nc-chip nc-chip-color ${state.color === option ? 'nc-chip-on' : ''}`}
                onClick={() => setState({ color: state.color === option ? '' : (option as TemplatePrimaryColor) })}
              >
                <span className="nc-swatch" style={{ backgroundImage: PRIMARY_COLOR_SWATCHES[option] }} aria-hidden="true" />
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="nc-toolbar-status">
        <span aria-live="polite">
          {isLoading ? 'กำลังโหลดผลงาน…' : `พบ ${resultCount} ผลงาน`}
          {state.q.trim() && !isLoading ? ` สำหรับ “${state.q.trim()}”` : ''}
        </span>
        <span className="nc-active-filters">
          {state.category && (
            <button type="button" className="nc-token" onClick={() => setState({ category: '' })}>
              {state.category} <Icon name="x" size={12} />
            </button>
          )}
          {state.color && (
            <button type="button" className="nc-token" onClick={() => setState({ color: '' })}>
              {state.color} <Icon name="x" size={12} />
            </button>
          )}
          {hasActiveFilters && (
            <button type="button" className="nc-token nc-token-reset" onClick={onReset}>ล้างทั้งหมด</button>
          )}
        </span>
      </div>
    </section>
  )
}
