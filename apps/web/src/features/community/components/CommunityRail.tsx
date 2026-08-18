import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { TemplateCard } from '@nail-studio/contracts'
import { Icon } from '@/components/Icon.tsx'
import { formatCount } from '../format.ts'
import type { CommunityFeedState } from '../useCommunityFilters.ts'
import type { TemplateCategory } from '../useTemplates.ts'
import { Avatar } from './Avatar.tsx'

interface CommunityRailProps {
  /** ผลงานที่โหลดมาแล้วจริงจาก API — แผงด้านขวาสรุปจากชุดนี้เท่านั้น */
  items: TemplateCard[]
  buildHref: (patch: Partial<CommunityFeedState>) => string
  currentUserId?: string | undefined
}

interface CreatorSummary {
  id: string
  displayName: string
  designCount: number
  likeCount: number
}

/**
 * แผงด้านขวา — สรุปจากข้อมูลจริงที่โหลดมาแล้วเท่านั้น
 *
 * ยังไม่มี endpoint สำหรับ "ครีเอเตอร์แนะนำ" หรือ "แท็กมาแรง" ฝั่งเซิร์ฟเวอร์
 * จึงคำนวณจากฟีดที่ผู้ใช้เห็นอยู่ และบอกให้ชัดว่าเป็นสถิติจากฟีดนี้ ไม่ใช่ทั้งระบบ
 */
export function CommunityRail({ items, buildHref, currentUserId }: CommunityRailProps) {
  const totals = useMemo(
    () =>
      items.reduce(
        (accumulator, template) => ({
          likes: accumulator.likes + template.likeCount,
          remixes: accumulator.remixes + template.remixCount,
          comments: accumulator.comments + template.commentCount,
        }),
        { likes: 0, remixes: 0, comments: 0 },
      ),
    [items],
  )

  const creators = useMemo<CreatorSummary[]>(() => {
    const byAuthor = new Map<string, CreatorSummary>()
    for (const template of items) {
      const existing = byAuthor.get(template.author.id)
      if (existing) {
        existing.designCount += 1
        existing.likeCount += template.likeCount
      } else {
        byAuthor.set(template.author.id, {
          id: template.author.id,
          displayName: template.author.displayName,
          designCount: 1,
          likeCount: template.likeCount,
        })
      }
    }
    return [...byAuthor.values()]
      .filter((creator) => creator.id !== currentUserId)
      .sort((a, b) => b.likeCount - a.likeCount || b.designCount - a.designCount)
      .slice(0, 5)
  }, [currentUserId, items])

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    for (const template of items) {
      if (!template.category) continue
      counts.set(template.category, (counts.get(template.category) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [items])

  return (
    <aside className="nc-rail" aria-label="ข้อมูลชุมชน">
      <section className="nc-card nc-rail-card">
        <h2><Icon name="sparkle" size={15} /> สรุปจากฟีดนี้</h2>
        <dl className="nc-rail-stats">
          <div><dt>ผลงาน</dt><dd>{formatCount(items.length)}</dd></div>
          <div><dt>ถูกใจ</dt><dd>{formatCount(totals.likes)}</dd></div>
          <div><dt>รีมิกซ์</dt><dd>{formatCount(totals.remixes)}</dd></div>
          <div><dt>ความคิดเห็น</dt><dd>{formatCount(totals.comments)}</dd></div>
        </dl>
      </section>

      {creators.length > 0 && (
        <section className="nc-card nc-rail-card">
          <h2><Icon name="users" size={15} /> ครีเอเตอร์ที่น่าติดตาม</h2>
          <ul className="nc-rail-people">
            {creators.map((creator) => (
              <li key={creator.id}>
                <Avatar userId={creator.id} displayName={creator.displayName} size="sm" linkToProfile={false} />
                <span className="nc-rail-person-copy">
                  <Link to={`/users/${creator.id}`}>{creator.displayName}</Link>
                  <small>{creator.designCount} ผลงาน · {formatCount(creator.likeCount)} ถูกใจ</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {categories.length > 0 && (
        <section className="nc-card nc-rail-card">
          <h2><Icon name="tag" size={15} /> สไตล์ที่คนกำลังโพสต์</h2>
          <ul className="nc-rail-tags">
            {categories.map(([category, count]) => (
              <li key={category}>
                <Link to={buildHref({ category: category as TemplateCategory })}>#{category}</Link>
                <small>{count} ผลงาน</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="nc-card nc-rail-card nc-rail-guidelines">
        <h2><Icon name="users" size={15} /> แนวทางชุมชน</h2>
        <ul>
          <li>ให้เครดิตเจ้าของงานเสมอเมื่อรีมิกซ์</li>
          <li>คอมเมนต์อย่างสร้างสรรค์และให้เกียรติกัน</li>
          <li>โพสต์เฉพาะผลงานที่คุณมีสิทธิ์เผยแพร่</li>
        </ul>
      </section>
    </aside>
  )
}
