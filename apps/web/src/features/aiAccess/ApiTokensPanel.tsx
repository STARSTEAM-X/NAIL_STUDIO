import { useState, type FormEvent } from 'react'
import type { CreatedApiToken } from '@nail-studio/contracts'
import { ApiRequestError } from '@/api/client.ts'
import { Icon } from '@/components/Icon.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { formatLongDate } from '@/lib/datetime.ts'
import { useApiTokens, useCreateApiToken, useRevokeApiToken } from './useApiTokens.ts'

/**
 * จัดการ API token สำหรับเชื่อม AI (NailStudio MCP server) — แสดงเฉพาะในโหมดแก้ไขโปรไฟล์ของตัวเอง
 *
 * token ดิบแสดงครั้งเดียวหลังสร้าง (เซิร์ฟเวอร์เก็บแค่ hash) จึงต้องบอกผู้ใช้ให้คัดลอกเก็บทันที
 * และ token ใช้ได้กับงานออกแบบเท่านั้น — บอกขอบเขตไว้ตรงนี้ด้วยเพื่อให้ตัดสินใจได้ก่อนสร้าง
 */
export function ApiTokensPanel() {
  const toast = useToast()
  const tokens = useApiTokens(true)
  const create = useCreateApiToken()
  const revoke = useRevokeApiToken()
  const [name, setName] = useState('')
  const [created, setCreated] = useState<CreatedApiToken | null>(null)
  const [pendingRevoke, setPendingRevoke] = useState<{ id: string; name: string } | null>(null)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    create.mutate({ name: name.trim(), expiresInDays: 90 }, {
      onSuccess: (token) => { setCreated(token); setName('') },
      onError: (error) => toast.error(error instanceof ApiRequestError ? error.message : 'สร้าง token ไม่สำเร็จ'),
    })
  }

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('คัดลอก token แล้ว')
    } catch {
      toast.error('คัดลอกไม่สำเร็จ — เลือกข้อความแล้วคัดลอกเอง')
    }
  }

  return (
    <section className="ui-card profile-edit" aria-labelledby="api-tokens-title">
      <h2 id="api-tokens-title"><Icon name="sparkle" size={16} /> เชื่อมต่อ AI (API token)</h2>
      <p className="muted">
        ให้ AI เช่น Claude ออกแบบลายเล็บในงานของคุณผ่าน NailStudio MCP server — token
        ใช้ได้กับงานออกแบบเท่านั้น ทุกการแก้ของ AI บันทึกเป็นเวอร์ชันใหม่ ย้อนกลับได้เสมอ
      </p>

      {created && (
        <div className="ui-card" role="status">
          <strong>คัดลอก token นี้เก็บไว้ตอนนี้ — จะไม่แสดงอีก</strong>
          <code style={{ display: 'block', wordBreak: 'break-all', margin: '8px 0' }}>{created.token}</code>
          <div className="profile-edit-actions">
            <Button variant="ghost" onClick={() => setCreated(null)}>เก็บแล้ว ปิด</Button>
            <Button variant="primary" icon="check" onClick={() => void copy(created.token)}>คัดลอก</Button>
          </div>
        </div>
      )}

      <form onSubmit={submit}>
        <label className="ap-field">
          <span>ชื่อ token</span>
          <input
            value={name}
            maxLength={60}
            placeholder="เช่น Claude Desktop บนโน้ตบุ๊ก"
            onChange={(event) => setName(event.target.value)}
          />
          <small>หมดอายุใน 90 วัน · มีได้สูงสุด 10 อัน</small>
        </label>
        <div className="profile-edit-actions">
          <Button type="submit" variant="primary" disabled={!name.trim()} loading={create.isPending} loadingLabel="กำลังสร้าง…">
            สร้าง token
          </Button>
        </div>
      </form>

      {tokens.data && tokens.data.length > 0 && (
        <ul className="api-token-list" style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
          {tokens.data.map((token) => (
            <li key={token.id} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
              <span>
                <strong>{token.name}</strong> <code>{token.prefix}…</code>
                <br />
                <small className="muted">
                  สร้าง {formatLongDate(token.createdAt)}
                  {token.lastUsedAt ? ` · ใช้ล่าสุด ${formatLongDate(token.lastUsedAt)}` : ' · ยังไม่เคยใช้'}
                  {token.expiresAt ? ` · หมดอายุ ${formatLongDate(token.expiresAt)}` : ''}
                </small>
              </span>
              <Button variant="ghost" icon="trash" onClick={() => setPendingRevoke({ id: token.id, name: token.name })}>
                ยกเลิก
              </Button>
            </li>
          ))}
        </ul>
      )}

      {pendingRevoke && (
        <ConfirmDialog
          title="ยกเลิก token นี้?"
          message={`"${pendingRevoke.name}" จะใช้ไม่ได้ทันที — AI ที่ใช้ token นี้อยู่จะเข้าถึงงานของคุณไม่ได้อีก`}
          confirmLabel="ยกเลิก token"
          destructive
          pending={revoke.isPending}
          onCancel={() => setPendingRevoke(null)}
          onConfirm={() => revoke.mutate(pendingRevoke.id, {
            onSuccess: () => { toast.success('ยกเลิก token แล้ว'); setPendingRevoke(null) },
            onError: () => toast.error('ยกเลิกไม่สำเร็จ'),
          })}
        />
      )}
    </section>
  )
}
