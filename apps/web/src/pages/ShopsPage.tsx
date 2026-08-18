import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon.tsx'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/States.tsx'
import { useShopList } from '@/features/shops/useShops.ts'
import { formatBaht } from '@/lib/datetime.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'

/**
 * รายชื่อร้านทำเล็บ
 *
 * ก่อนหน้านี้ GET /shops ถูกใช้เป็นแค่ตัวเลือกใน dropdown ของหน้าจองเท่านั้น
 * ผู้ใช้จึงเลือกร้านได้จากชื่ออย่างเดียว ไม่เห็นบริการ ราคา หรือคะแนน
 */
export function ShopsPage() {
  usePageTitle('ร้านทำเล็บ')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const shops = useShopList(search)

  // หน่วงคำค้นก่อนยิง API ไม่ให้พิมพ์ทีละตัวอักษรแล้วยิงทุกครั้ง
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const items = shops.data ?? []

  return (
    <section className="page shops-page">
      <header className="ap-header">
        <div>
          <p className="eyebrow">SHOPS</p>
          <h1>ร้านทำเล็บ</h1>
          <p className="muted">เลือกร้านจากบริการ ราคา และคะแนนรีวิวจริงจากลูกค้า</p>
        </div>
      </header>

      <div className="nc-search shops-search">
        <Icon name="search" size={16} />
        <input
          type="search"
          value={searchInput}
          placeholder="ค้นหาชื่อร้านหรือพื้นที่ให้บริการ"
          aria-label="ค้นหาร้าน"
          onChange={(event) => setSearchInput(event.target.value)}
        />
        {searchInput && (
          <button type="button" className="nc-search-clear" aria-label="ล้างคำค้นหา" onClick={() => setSearchInput('')}>
            <Icon name="x" size={14} />
          </button>
        )}
      </div>

      {shops.isPending && <ListSkeleton count={4} lines={3} />}

      {shops.error && (
        <ErrorState title="โหลดรายชื่อร้านไม่สำเร็จ" error={shops.error} onRetry={() => void shops.refetch()} />
      )}

      {!shops.isPending && !shops.error && items.length === 0 && (
        <EmptyState
          icon={search ? 'search' : 'compass'}
          title={search ? 'ไม่พบร้านที่ตรงกับคำค้นหา' : 'ยังไม่มีร้านในระบบ'}
          description={search ? 'ลองใช้คำค้นอื่น หรือดูร้านทั้งหมด' : 'เมื่อมีร้านเปิดรับนัดหมาย รายชื่อจะแสดงที่นี่'}
        >
          {search && (
            <button type="button" className="ui-btn ui-btn-ghost ui-btn-md" onClick={() => setSearchInput('')}>
              ดูร้านทั้งหมด
            </button>
          )}
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="shops-grid">
          {items.map((shop) => {
            const activeServices = shop.services.filter((service) => service.isActive)
            const cheapest = activeServices.reduce<number | null>((min, service) => {
              const price = Number(service.priceThb)
              if (Number.isNaN(price)) return min
              return min === null || price < min ? price : min
            }, null)

            return (
              <li key={shop.userId}>
                <Link to={`/shops/${shop.userId}`} className="shop-card">
                  <div className="shop-card-head">
                    <h2>{shop.shopName}</h2>
                    {shop.isVerified && (
                      <span className="ui-status ui-status-ok"><Icon name="check" size={12} /> ยืนยันแล้ว</span>
                    )}
                  </div>

                  <p className="shop-card-rating">
                    <Icon name="sparkle" size={14} />
                    {shop.ratingCount > 0
                      ? <>{Number(shop.ratingAvg).toFixed(1)} <span>จาก {shop.ratingCount} รีวิว</span></>
                      : <span>ยังไม่มีรีวิว</span>}
                  </p>

                  {shop.locationText && (
                    <p className="shop-card-location"><Icon name="compass" size={14} /> {shop.locationText}</p>
                  )}
                  {shop.description && <p className="shop-card-description">{shop.description}</p>}

                  <div className="shop-card-foot">
                    <span>{activeServices.length} บริการ</span>
                    {cheapest !== null && <span>เริ่มต้น {formatBaht(cheapest)}</span>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
