import { Button } from '@/components/ui/Button.tsx'

export function BlockedComposer({ blockedByMe, pending, onUnblock }: { blockedByMe: boolean; pending: boolean; onUnblock: () => void }) {
  return (
    <div className="chat-blocked-composer" role="status">
      <p>{blockedByMe ? 'คุณบล็อกผู้ใช้นี้อยู่' : 'ห้องนี้ไม่สามารถส่งข้อความได้ในขณะนี้'}</p>
      {blockedByMe && <Button variant="ghost" loading={pending} onClick={onUnblock}>เลิกบล็อก</Button>}
    </div>
  )
}
