// นำเข้าเป็นค่า ไม่ใช่ type อย่างเดียว เพราะต้องใช้ Prisma.DbNull ตอนล้าง draft
// (การส่ง null ธรรมดาให้ฟิลด์ Json หมายถึง "ไม่แก้" ไม่ใช่ "ตั้งเป็น null")
import { Prisma } from '../generated/prisma/client.ts'
import { prisma } from '../db.ts'

export interface Cursor {
  updatedAt: Date
  id: string
}

/**
 * รายการงานของผู้ใช้ด้วย keyset pagination (algorithms.md A-14)
 *
 * ใช้ tuple comparison (updated_at, id) ไม่ใช่แค่ updated_at เพราะถ้าสองงาน
 * มี timestamp เท่ากันเป๊ะ (เกิดได้จริงเมื่อสร้างรัวกัน) รายการจะหายหรือซ้ำ
 *
 * Prisma แปลเงื่อนไข OR สองชั้นนี้เป็น (updated_at, id) < ($1, $2) ที่ใช้ดัชนี
 * (user_id, updated_at DESC, id DESC) ได้ — ต้องยืนยันด้วย EXPLAIN ใน Slice 10
 */
export function listProjects(userId: string, limit: number, cursor: Cursor | null) {
  const where: Prisma.ProjectWhereInput = {
    userId,
    deletedAt: null,
    ...(cursor
      ? {
          OR: [
            { updatedAt: { lt: cursor.updatedAt } },
            { updatedAt: cursor.updatedAt, id: { lt: cursor.id } },
          ],
        }
      : {}),
  }

  return prisma.project.findMany({
    where,
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    // ขอเกินมา 1 แถวเพื่อรู้ว่ายังมีหน้าถัดไปไหม โดยไม่ต้องนับทั้งตาราง
    take: limit + 1,
  })
}

export function findProject(userId: string, id: string) {
  return prisma.project.findFirst({ where: { id, userId, deletedAt: null } })
}

export function createProject(userId: string, name: string, document: Prisma.InputJsonValue) {
  // สร้างโปรเจกต์กับเวอร์ชันแรกในทรานแซกชันเดียว — ห้ามมีโปรเจกต์ที่ไม่มีเวอร์ชันเลย
  return prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: { userId, name, versionCount: 1 },
    })
    await tx.designVersion.create({
      data: { projectId: project.id, versionNumber: 1, document },
    })
    return project
  })
}

export function softDeleteProject(userId: string, id: string) {
  return prisma.project.updateMany({
    where: { id, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  })
}

export function updateProject(userId: string, id: string, data: Prisma.ProjectUpdateInput) {
  return prisma.project.updateMany({ where: { id, userId, deletedAt: null }, data })
}

export function latestVersion(projectId: string) {
  return prisma.designVersion.findFirst({
    where: { projectId },
    orderBy: { versionNumber: 'desc' },
  })
}

export function findVersion(projectId: string, versionNumber: number) {
  return prisma.designVersion.findUnique({
    where: { projectId_versionNumber: { projectId, versionNumber } },
  })
}

/**
 * บันทึกเวอร์ชันใหม่ + อัปเดตตัวนับในทรานแซกชันเดียว
 *
 * versionCount เป็นค่า denormalized (database.md §3.3) การอัปเดตต้องอยู่ในทรานแซกชัน
 * เดียวกับการ insert เสมอ ไม่งั้นตัวเลขจะเพี้ยนเมื่อมีข้อผิดพลาดกลางทาง
 *
 * ความไม่ซ้ำของ versionNumber ถูกบังคับด้วย UNIQUE (project_id, version_number)
 * ที่ระดับฐานข้อมูล — ถ้าสองคำขอมาพร้อมกัน คนที่สองจะชน constraint ไม่ใช่เขียนทับ
 */
export function createVersion(
  projectId: string,
  versionNumber: number,
  document: Prisma.InputJsonValue,
  label: string | null,
) {
  return prisma.$transaction(async (tx) => {
    const version = await tx.designVersion.create({
      data: { projectId, versionNumber, document, label },
    })
    await tx.project.update({
      where: { id: projectId },
      data: {
        versionCount: { increment: 1 },
        // งานที่ค้างอยู่ถูกรวมเข้าเวอร์ชันนี้แล้ว ถ้าไม่ล้างทิ้ง การเปิดงานครั้งหน้า
        // จะได้ draft เก่ากลับมาแทนเวอร์ชันที่เพิ่งบันทึก
        draftDocument: Prisma.DbNull,
        draftUpdatedAt: null,
        draftBaseVersion: null,
      },
    })
    return version
  })
}

/** เขียนทับ draft ของงาน — ไม่แตะเวอร์ชันที่บันทึกไว้แล้ว */
export function saveDraft(
  projectId: string,
  document: Prisma.InputJsonValue,
  baseVersion: number,
) {
  return prisma.project.update({
    where: { id: projectId },
    data: { draftDocument: document, draftUpdatedAt: new Date(), draftBaseVersion: baseVersion },
  })
}
