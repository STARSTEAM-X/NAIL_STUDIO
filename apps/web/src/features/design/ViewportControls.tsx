import { Icon } from '@/components/Icon.tsx'
import { useDesign } from './DesignStoreProvider.tsx'

/**
 * ปุ่มควบคุมมุมมองที่ลอยอยู่มุมล่างขวาของฉาก
 *
 * ก่อนหน้านี้การกลับไปมองทั้งมือทำได้ทางเดียวคือปุ่มในแถบเลือกนิ้วที่อยู่ล่างสุดของหน้า
 * ส่วนการซูมทำได้แค่ล้อเมาส์ — คนที่ใช้ trackpad หรือจอสัมผัสจึงไม่มีทางซูมที่ชัดเจน
 */
export function ViewportControls() {
  const zoomBy = useDesign((state) => state.zoomBy)
  const focusHome = useDesign((state) => state.focusHome)

  return (
    <div className="viewport-controls" role="group" aria-label="ควบคุมมุมมอง">
      <button
        type="button"
        className="viewport-control"
        aria-label="ซูมเข้า"
        data-tooltip="ซูมเข้า"
        data-tooltip-side="left"
        onClick={() => zoomBy(1)}
      >
        <Icon name="zoom-in" size={17} />
      </button>
      <button
        type="button"
        className="viewport-control"
        aria-label="ซูมออก"
        data-tooltip="ซูมออก"
        data-tooltip-side="left"
        onClick={() => zoomBy(-1)}
      >
        <Icon name="zoom-out" size={17} />
      </button>
      <button
        type="button"
        className="viewport-control"
        aria-label="ดูทั้งมือ"
        data-tooltip="ดูทั้งมือ"
        data-tooltip-side="left"
        onClick={focusHome}
      >
        <Icon name="hand" size={17} />
      </button>
    </div>
  )
}
