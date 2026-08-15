import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { disconnectDb, prisma } from '../db.ts'

const stamp = Date.now()
const email = `template.schema.${stamp}@example.test`

let userId = ''
let projectId = ''
let versionId = ''
let templateId = ''

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: 'test-hash',
      displayName: 'Template schema test',
    },
  })
  userId = user.id

  const project = await prisma.project.create({
    data: {
      userId,
      name: 'Template schema fixture',
    },
  })
  projectId = project.id

  const version = await prisma.designVersion.create({
    data: {
      projectId,
      versionNumber: 1,
      document: {},
    },
  })
  versionId = version.id

  const template = await prisma.nailTemplate.create({
    data: {
      authorId: userId,
      designVersionId: versionId,
      name: 'Schema fixture',
      category: 'Minimalistic',
      primaryColor: 'Nude',
    },
  })
  templateId = template.id
})

afterAll(async () => {
  await prisma.contentReport.deleteMany({ where: { reporterId: userId } })
  await prisma.templateComment.deleteMany({ where: { userId } })
  await prisma.templateRemix.deleteMany({ where: { userId } })
  await prisma.templateShare.deleteMany({ where: { userId } })
  await prisma.templateLike.deleteMany({ where: { userId } })
  await prisma.nailTemplate.deleteMany({ where: { authorId: userId } })
  await prisma.user.deleteMany({ where: { id: userId } })
  await disconnectDb()
})

describe('nail template community schema', () => {
  it('stores a template against an immutable design version', async () => {
    const template = await prisma.nailTemplate.findUniqueOrThrow({ where: { id: templateId } })

    expect(template.designVersionId).toBe(versionId)
    expect(template.visibility).toBe('public')
    expect(template.likeCount).toBe(0)
    expect(template.remixCount).toBe(0)

    await expect(prisma.designVersion.delete({ where: { id: versionId } })).rejects.toMatchObject({
      code: expect.stringMatching(/^P2003$|^P2039$/),
    })
  })

  it('enforces one like and one remix per template/user or project', async () => {
    await prisma.templateLike.create({ data: { templateId, userId } })
    await expect(prisma.templateLike.create({ data: { templateId, userId } })).rejects.toMatchObject({
      code: 'P2002',
    })

    await prisma.templateRemix.create({ data: { templateId, userId, projectId } })
    await expect(prisma.templateRemix.create({ data: { templateId, userId, projectId } })).rejects.toMatchObject({
      code: 'P2002',
    })
  })

  it('keeps content reports idempotent for one reporter and target', async () => {
    await prisma.contentReport.create({
      data: {
        targetType: 'template',
        targetId: templateId,
        reporterId: userId,
        reason: 'spam',
      },
    })

    await expect(
      prisma.contentReport.create({
        data: {
          targetType: 'template',
          targetId: templateId,
          reporterId: userId,
          reason: 'spam',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' })
  })
})
