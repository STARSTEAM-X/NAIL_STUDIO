import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { ApiRequestError } from '@/api/client.ts'
import { Icon } from '@/components/Icon.tsx'
import { BackLink } from '@/components/ui/BackLink.tsx'
import { Button } from '@/components/ui/Button.tsx'
import { EmptyState, ErrorState, FeedSkeletonList } from '@/components/ui/States.tsx'
import { useToast } from '@/components/ui/Toast.tsx'
import { useCurrentUser, useLogout } from '@/features/auth/useAuth.ts'
import { useUpdateProfile } from '@/features/auth/useAuth.ts'
import { TemplateTile } from '@/features/community/components/TemplateTile.tsx'
import { useTemplateActions } from '@/features/community/useTemplateActions.ts'
import { usePublicProfile } from '@/features/users/usePublicProfile.ts'
import { formatCount, formatLongDate } from '@/lib/datetime.ts'
import { avatarGradient, getInitials, ROLE_LABELS } from '@/lib/user.ts'
import { usePageTitle } from '@/lib/usePageTitle.ts'
import { useNavigate } from 'react-router-dom'

/**
 * โปรไฟล์ผู้ใช้ — รวมโปรไฟล์สาธารณะกับการแก้ไขไว้ในหน้าเดียว
 *
 * เดิมแยกเป็นสอง route: /users/:id (ดู) กับ /profile (แก้ไข) ซึ่งแสดงข้อมูลชุดเดียวกัน
 * และเขียนโค้ดซ้ำกันทั้ง hero, avatar, ROLE_LABELS และวันที่สมัคร
 * ที่แย่กว่านั้นคือ /profile เข้าถึงได้ทางเดียวคือกดปุ่มในหน้านี้ — ลึกสองชั้นและเดาไม่ได้
 */
export function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const profile = usePublicProfile(userId)
  const { data: currentUser } = useCurrentUser()
  const actions = useTemplateActions()
  const navigate = useNavigate()
  const toast = useToast()

  const updateProfile = useUpdateProfile()
  const logout = useLogout()
  const [displayName, setDisplayName] = useState('')

  const user = profile.profile
  const isOwnProfile = currentUser?.id === user?.id
  const editing = isOwnProfile && searchParams.get('edit') === '1'

  usePageTitle(user?.displayName)

  useEffect(() => {
    if (currentUser) setDisplayName(currentUser.displayName)
  }, [currentUser])

  const setEditing = (next: boolean) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('edit', '1')
    else params.delete('edit')
    setSearchParams(params, { replace: true })
  }

  if (profile.isPending) {
    return (
      <section className="page public-profile-page">
        <FeedSkeletonList variant="tile" count={6} />
      </section>
    )
  }

  if (profile.error) {
    const notFound = profile.error instanceof ApiRequestError && profile.error.status === 404
    return (
      <section className="page public-profile-page">
        <BackLink to="/community">กลับไปชุมชน</BackLink>
        {notFound ? (
          <EmptyState icon="search" title="ไม่พบโปรไฟล์ผู้ใช้นี้" description="ผู้ใช้อาจถูกลบหรือลิงก์ไม่ถูกต้อง" />
        ) : (
          <ErrorState title="โหลดโปรไฟล์ไม่สำเร็จ" error={profile.error} onRetry={() => void profile.refetch()} />
        )}
      </section>
    )
  }

  if (!user) {
    return (
      <section className="page public-profile-page">
        <EmptyState icon="search" title="ไม่พบโปรไฟล์ที่ต้องการ" />
      </section>
    )
  }

  const submitProfile = (event: FormEvent) => {
    event.preventDefault()
    const nextName = displayName.trim()
    if (!nextName || nextName === currentUser?.displayName) return
    updateProfile.mutate(
      { displayName: nextName },
      {
        onSuccess: () => {
          toast.success('บันทึกโปรไฟล์แล้ว')
          setEditing(false)
          void profile.refetch()
        },
        onError: (error) => toast.error(error instanceof Error ? error.message : 'บันทึกโปรไฟล์ไม่สำเร็จ'),
      },
    )
  }

  const totals = profile.templates.reduce(
    (accumulator, template) => ({
      likes: accumulator.likes + template.likeCount,
      remixes: accumulator.remixes + template.remixCount,
    }),
    { likes: 0, remixes: 0 },
  )

  return (
    <section className="page public-profile-page">
      <BackLink to="/community">กลับไปชุมชน</BackLink>

      <header className="ui-card profile-hero">
        <span
          className="nc-avatar nc-avatar-lg"
          style={{ backgroundImage: avatarGradient(user.id) }}
          aria-hidden="true"
        >
          {getInitials(user.displayName)}
        </span>
        <div className="profile-hero-copy">
          <p className="eyebrow">{isOwnProfile ? 'บัญชีของฉัน' : 'COMMUNITY PROFILE'}</p>
          <h1>{user.displayName}</h1>
          <p className="profile-hero-role">{ROLE_LABELS[user.role]}</p>
          <p className="muted">สมาชิกตั้งแต่ {formatLongDate(user.createdAt)}</p>
        </div>
        {isOwnProfile && !editing && (
          <div className="profile-hero-actions">
            <Button variant="ghost" icon="user" onClick={() => setEditing(true)}>แก้ไขโปรไฟล์</Button>
            <Button
              variant="ghost"
              icon="logout"
              loading={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
            >
              ออกจากระบบ
            </Button>
          </div>
        )}
      </header>

      {editing && currentUser && (
        <form className="ui-card profile-edit" onSubmit={submitProfile}>
          <h2><Icon name="user" size={16} /> แก้ไขข้อมูลบัญชี</h2>
          <label className="ap-field">
            <span>ชื่อที่แสดง</span>
            <input
              value={displayName}
              maxLength={60}
              autoComplete="name"
              onChange={(event) => setDisplayName(event.target.value)}
            />
            <small>ชื่อนี้จะแสดงในเมนูโปรไฟล์ ในฟีดชุมชน และบนผลงานที่คุณเผยแพร่</small>
          </label>
          <label className="ap-field">
            <span>อีเมล</span>
            <input value={currentUser.email} readOnly aria-readonly="true" />
            <small>อีเมลใช้สำหรับเข้าสู่ระบบ และยังแก้ไขจากหน้านี้ไม่ได้</small>
          </label>
          <label className="ap-field">
            <span>ประเภทบัญชี</span>
            <input value={ROLE_LABELS[currentUser.role]} readOnly aria-readonly="true" />
          </label>
          <div className="profile-edit-actions">
            <Button variant="ghost" onClick={() => setEditing(false)}>ยกเลิก</Button>
            <Button
              type="submit"
              variant="primary"
              disabled={!displayName.trim() || displayName.trim() === currentUser.displayName}
              loading={updateProfile.isPending}
              loadingLabel="กำลังบันทึก…"
            >
              บันทึกการเปลี่ยนแปลง
            </Button>
          </div>
        </form>
      )}

      <section className="profile-stats" aria-label="สรุปผลงาน">
        <div><strong>{formatCount(user.templateCount)}</strong><span>ผลงานที่เผยแพร่</span></div>
        <div><strong>{formatCount(totals.likes)}</strong><span>ถูกใจที่ได้รับ</span></div>
        <div><strong>{formatCount(totals.remixes)}</strong><span>ถูกนำไปรีมิกซ์</span></div>
      </section>

      <section className="public-profile-work" aria-labelledby="public-profile-work-title">
        <header className="public-profile-section-head">
          <div>
            <p className="eyebrow">PUBLIC WORK</p>
            <h2 id="public-profile-work-title">
              {isOwnProfile ? 'ผลงานที่ฉันเผยแพร่' : `ผลงานของ ${user.displayName}`}
            </h2>
          </div>
          <span className="public-profile-count">{user.templateCount} แบบ</span>
        </header>

        {profile.templates.length === 0 ? (
          <EmptyState
            icon="sparkle"
            title={isOwnProfile ? 'คุณยังไม่ได้เผยแพร่ผลงาน' : 'ยังไม่มีผลงานที่เผยแพร่'}
            description={
              isOwnProfile
                ? 'เปิดงานออกแบบของคุณแล้วกด “แชร์” ในโปรแกรมแก้ไข เพื่อให้ผลงานปรากฏที่นี่'
                : 'เมื่อผู้ใช้นี้เผยแพร่ดีไซน์ ผลงานจะแสดงที่หน้านี้'
            }
          >
            {isOwnProfile && <Button variant="primary" onClick={() => navigate('/projects')}>ไปที่งานของฉัน</Button>}
          </EmptyState>
        ) : (
          <div className="nc-tile-grid">
            {profile.templates.map((template) => (
              <TemplateTile key={template.id} template={template} actions={actions} />
            ))}
          </div>
        )}

        {profile.hasNextPage && (
          <Button
            variant="ghost"
            className="nc-load-more"
            loading={profile.isFetchingNextPage}
            loadingLabel="กำลังโหลด…"
            onClick={() => void profile.fetchNextPage()}
          >
            โหลดผลงานเพิ่ม
          </Button>
        )}
      </section>
    </section>
  )
}
