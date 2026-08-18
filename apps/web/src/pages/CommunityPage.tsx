import { useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { useCurrentUser } from '@/features/auth/useAuth.ts'
import { Avatar } from '@/components/ui/Avatar.tsx'
import { CommunityComposer } from '@/features/community/components/CommunityComposer.tsx'
import { CommunityRail } from '@/features/community/components/CommunityRail.tsx'
import { CommunityToolbar } from '@/features/community/components/CommunityToolbar.tsx'
import { EmptyState, ErrorState, FeedSkeletonList } from '@/components/ui/States.tsx'
import { PostCard } from '@/features/community/components/PostCard.tsx'
import { TemplateTile } from '@/features/community/components/TemplateTile.tsx'
import { useCommunityFilters } from '@/features/community/useCommunityFilters.ts'
import { useTemplateActions } from '@/features/community/useTemplateActions.ts'
import { useTemplates } from '@/features/community/useTemplates.ts'

/** ค้นหาแบบง่ายฝั่งเบราว์เซอร์ ครอบคลุมชื่อ คำบรรยาย ผู้สร้าง สไตล์ และสีหลัก */
function matchesQuery(haystack: (string | null)[], query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return haystack.some((value) => value?.toLowerCase().includes(needle))
}

export function CommunityPage() {
  usePageTitle('ชุมชน')
  const { data: currentUser } = useCurrentUser()
  const { state, setState, buildHref, reset, apiFilters, hasActiveFilters } = useCommunityFilters()
  const templates = useTemplates(apiFilters)
  const actions = useTemplateActions()
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const loaded = useMemo(
    () => templates.data?.pages.flatMap((page) => page.data) ?? [],
    [templates.data],
  )

  const items = useMemo(
    () =>
      state.q.trim()
        ? loaded.filter((template) =>
            matchesQuery(
              [template.name, template.caption, template.author.displayName, template.category, template.primaryColor],
              state.q,
            ),
          )
        : loaded,
    [loaded, state.q],
  )

  /**
   * โหลดหน้าถัดไปอัตโนมัติเมื่อเลื่อนถึงท้ายฟีด
   * ปุ่ม "โหลดเพิ่ม" ยังคงอยู่ด้านล่างสำหรับผู้ใช้คีย์บอร์ดและกรณี IntersectionObserver ไม่ทำงาน
   */
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return
    if (!templates.hasNextPage || templates.isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void templates.fetchNextPage()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [templates])

  const isInitialLoading = templates.isPending
  const isEmpty = !isInitialLoading && !templates.error && items.length === 0
  const searchHidAll = isEmpty && loaded.length > 0

  return (
    <div className="nc-page">
      <div className="nc-layout">
        <main className="nc-main" id="community-feed">
          <header className="nc-header">
            <div className="nc-header-copy">
              <p className="nc-eyebrow"><Icon name="sparkle" size={13} /> NAIL STUDIO COMMUNITY</p>
              <h1>{state.view === 'grid' ? 'เรียกดูแบบทั้งหมด' : state.sort === 'popular' ? 'ผลงานกำลังมาแรง' : 'ฟีดชุมชน'}</h1>
              <p className="nc-header-sub">
                {state.view === 'grid'
                  ? 'เลือกดูดีไซน์เป็นตาราง กรองตามสไตล์และสีหลัก แล้วรีมิกซ์ได้ทันที'
                  : 'ดีไซน์ล่าสุดจากคนในชุมชน กดถูกใจ พูดคุย และนำไปต่อยอดเป็นงานของคุณเอง'}
              </p>
            </div>
            <div className="nc-header-actions">
              {currentUser && (
                <Link to={`/users/${currentUser.id}`} className="nc-header-me">
                  <Avatar userId={currentUser.id} displayName={currentUser.displayName} size="sm" linkToProfile={false} />
                  <span>โปรไฟล์ของฉัน</span>
                </Link>
              )}
              <Link to="/projects" className="btn btn-primary"><Icon name="plus" size={15} /> แชร์ผลงาน</Link>
            </div>
          </header>

          <CommunityToolbar
            state={state}
            setState={setState}
            hasActiveFilters={hasActiveFilters}
            onReset={reset}
            resultCount={items.length}
            isLoading={isInitialLoading}
          />

          {state.view === 'feed' && <CommunityComposer user={currentUser} />}

          {actions.shareError && (
            <p className="nc-banner nc-banner-error" role="alert">
              <Icon name="alert" size={15} /> {actions.shareError}
              <button type="button" onClick={actions.dismissShareError} aria-label="ปิดข้อความ"><Icon name="x" size={13} /></button>
            </p>
          )}
          {actions.remixError && (
            <p className="nc-banner nc-banner-error" role="alert"><Icon name="alert" size={15} /> {actions.remixError}</p>
          )}
          {actions.sharedId && !actions.shareError && (
            <p className="nc-banner nc-banner-ok" role="status"><Icon name="check" size={15} /> คัดลอกลิงก์ผลงานเรียบร้อยแล้ว</p>
          )}

          {isInitialLoading && <FeedSkeletonList variant={state.view === 'grid' ? 'tile' : 'post'} count={state.view === 'grid' ? 6 : 3} />}

          {templates.error && (
            <ErrorState
              title="โหลดฟีดชุมชนไม่สำเร็จ"
              error={templates.error}
              onRetry={() => void templates.refetch()}
            />
          )}

          {isEmpty && (
            searchHidAll ? (
              <EmptyState
                icon="search"
                title="ไม่พบผลงานที่ตรงกับคำค้นหา"
                description={`ลองใช้คำอื่น หรือโหลดผลงานเพิ่มเพื่อค้นหาให้ครอบคลุมมากขึ้น`}
              >
                <button type="button" className="btn btn-ghost" onClick={() => setState({ q: '' })}>ล้างคำค้นหา</button>
                {templates.hasNextPage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={templates.isFetchingNextPage}
                    onClick={() => void templates.fetchNextPage()}
                  >
                    {templates.isFetchingNextPage ? 'กำลังโหลด…' : 'โหลดผลงานเพิ่ม'}
                  </button>
                )}
              </EmptyState>
            ) : (
              <EmptyState
                icon="sparkle"
                title={hasActiveFilters ? 'ยังไม่มีผลงานที่ตรงกับตัวกรองนี้' : 'ยังไม่มีผลงานในชุมชน'}
                description={
                  hasActiveFilters
                    ? 'ลองเอาตัวกรองบางอย่างออก แล้วดูดีไซน์อื่นในชุมชน'
                    : 'เป็นคนแรกที่แชร์ดีไซน์ให้ชุมชนได้เลย'
                }
              >
                {hasActiveFilters && (
                  <button type="button" className="btn btn-ghost" onClick={reset}>ล้างตัวกรอง</button>
                )}
                <Link to="/projects" className="btn btn-primary">แชร์ผลงานของฉัน</Link>
              </EmptyState>
            )
          )}

          {items.length > 0 && (
            state.view === 'grid' ? (
              <div className="nc-tile-grid">
                {items.map((template) => (
                  <TemplateTile key={template.id} template={template} actions={actions} />
                ))}
              </div>
            ) : (
              <div className="nc-feed-list">
                {items.map((template) => (
                  <PostCard key={template.id} template={template} actions={actions} />
                ))}
              </div>
            )
          )}

          {templates.isFetchingNextPage && (
            <FeedSkeletonList variant={state.view === 'grid' ? 'tile' : 'post'} count={state.view === 'grid' ? 3 : 1} />
          )}

          <div ref={sentinelRef} aria-hidden="true" />

          {templates.hasNextPage && !templates.isFetchingNextPage && (
            <button
              type="button"
              className="btn btn-ghost nc-load-more"
              onClick={() => void templates.fetchNextPage()}
            >
              โหลดผลงานเพิ่ม
            </button>
          )}

          {!templates.hasNextPage && loaded.length > 0 && (
            <p className="nc-feed-end">คุณดูครบทุกผลงานที่ตรงกับตัวกรองนี้แล้ว</p>
          )}
        </main>

        <CommunityRail items={loaded} buildHref={buildHref} currentUserId={currentUser?.id} />
      </div>
    </div>
  )
}
