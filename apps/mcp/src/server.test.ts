import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createEmptyDocument, designDocumentSchema, type DesignDocument } from '@nail-studio/contracts'
import { DECORATIONS } from '@nail-studio/patterns'
import { ApiError, type NailStudioApi } from './apiClient.ts'
import { createNailStudioServer } from './server.ts'

const PROJECT = '11111111-1111-4111-8111-111111111111'

/** API ปลอมในหน่วยความจำ — จำลองกฎ expectedVersion ของ API จริง */
class FakeApi {
  versions: DesignDocument[] = [createEmptyDocument()]
  saves: { expectedVersion: number }[] = []

  async listProjects() {
    return [{ id: PROJECT, name: 'ทดสอบ', status: 'draft', versionCount: this.versions.length, updatedAt: '2026-10-17T00:00:00.000Z' }]
  }

  async getProject() {
    return {
      project: (await this.listProjects())[0]!,
      version: { number: this.versions.length, document: this.versions.at(-1)!, createdAt: '' },
    }
  }

  async createProject(name: string) {
    return { ...(await this.listProjects())[0]!, name }
  }

  async saveVersion(_id: string, document: DesignDocument, expectedVersion: number) {
    if (expectedVersion !== this.versions.length) throw new ApiError(409, 'มีคนบันทึกงานนี้ไปก่อนแล้ว', 'CONFLICT')
    designDocumentSchema.parse(document)
    this.saves.push({ expectedVersion })
    this.versions.push(document)
    return { versionNumber: this.versions.length }
  }
}

async function connect(api: FakeApi): Promise<Client> {
  const server = createNailStudioServer({ api: api as unknown as NailStudioApi, webUrl: 'http://web.test' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test', version: '0.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return client
}

const textOf = (result: object): string =>
  (((result as { content?: unknown }).content ?? []) as { type: string; text?: string }[]).filter((c) => c.type === 'text').map((c) => c.text).join('\n')

describe('nail-studio MCP server', () => {
  let api: FakeApi
  let client: Client

  beforeEach(async () => {
    api = new FakeApi()
    client = await connect(api)
  })

  it('เปิดเครื่องมือครบตามที่ออกแบบ', async () => {
    const { tools } = await client.listTools()
    expect(tools.map((t) => t.name).sort()).toEqual([
      'add_decoration', 'add_strokes', 'apply_preset', 'apply_recipe', 'clear_nail', 'copy_nail', 'create_project',
      'get_design', 'list_decorations', 'list_palettes', 'list_patterns', 'list_presets', 'list_projects',
      'mirror_hand', 'preview_recipe', 'render_preview', 'set_nail', 'validate_document',
    ])
  })

  it('preview_recipe คืนภาพ PNG และไม่บันทึกอะไร', async () => {
    const result = await client.callTool({
      name: 'preview_recipe',
      arguments: { recipe: { nails: { index: { patterns: [{ type: 'heart', color: '#e85d75' }] } } }, hands: 'right' },
    })
    const image = (result.content as { type: string; data?: string; mimeType?: string }[]).find((c) => c.type === 'image')
    expect(image?.mimeType).toBe('image/png')
    expect(Buffer.from(image!.data!, 'base64').subarray(1, 4).toString()).toBe('PNG')
    expect(api.saves).toHaveLength(0)
  })

  it('apply_recipe บันทึกเวอร์ชันใหม่ด้วย expectedVersion ของเวอร์ชันล่าสุด', async () => {
    const result = await client.callTool({
      name: 'apply_recipe',
      arguments: { projectId: PROJECT, recipe: { defaults: { base: '#dfaaa2' }, nails: { ring: { patterns: [{ type: 'dots', color: '#4a0e1d' }] } } } },
    })
    expect(result.isError).toBeFalsy()
    expect(textOf(result)).toContain('เวอร์ชัน 2')
    expect(api.saves).toEqual([{ expectedVersion: 1 }])
    const saved = api.versions[1]!
    expect(saved.nails['left.thumb'].baseColor).toBe('#dfaaa2')
    expect(saved.nails['right.ring'].layers[0]!.strokes.length).toBeGreaterThan(0)
  })

  it('recipe ผิด schema ถูกปฏิเสธก่อนถึง API', async () => {
    const result = await client.callTool({
      name: 'apply_recipe',
      arguments: { projectId: PROJECT, recipe: { nails: { index: { patterns: [{ type: 'dots', color: 'pink' }] } } } },
    })
    expect(result.isError).toBe(true)
    expect(api.saves).toHaveLength(0)
  })

  it('ถ้ามีคนบันทึกแทรก ได้ข้อผิดพลาดชัดเจน ไม่ทับงาน', async () => {
    const original = api.saveVersion.bind(api)
    api.saveVersion = async (id, document) => original(id, document, 999)
    const result = await client.callTool({ name: 'apply_preset', arguments: { projectId: PROJECT, preset: 'polka-duo' } })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('มีคนบันทึกงานนี้ไปก่อนแล้ว')
    expect(api.versions).toHaveLength(1)
  })

  it('add_decoration ปฏิเสธ catalogId ที่ไม่มีจริง', async () => {
    const result = await client.callTool({
      name: 'add_decoration',
      arguments: { projectId: PROJECT, nails: ['right.ring'], decorations: [{ catalogId: 'gem-imaginary' }] },
    })
    expect(result.isError).toBe(true)
    expect(api.saves).toHaveLength(0)
  })

  it('copy_nail / mirror_hand / clear_nail / get_design ทำงานต่อกันได้', async () => {
    await client.callTool({ name: 'set_nail', arguments: { projectId: PROJECT, nails: ['right.index'], nail: { base: '#112233', patterns: [{ type: 'star', color: '#62d4c9' }] } } })
    await client.callTool({ name: 'copy_nail', arguments: { projectId: PROJECT, from: 'right.index', to: ['ring'] } })
    await client.callTool({ name: 'mirror_hand', arguments: { projectId: PROJECT, from: 'right' } })
    await client.callTool({ name: 'clear_nail', arguments: { projectId: PROJECT, nails: ['left.ring'] } })
    const latest = api.versions.at(-1)!
    expect(latest.nails['right.ring'].baseColor).toBe('#112233')
    expect(latest.nails['left.index'].layers[0]!.strokes.length).toBeGreaterThan(0)
    expect(latest.nails['left.ring'].layers[0]!.strokes).toHaveLength(0)
    const summary = await client.callTool({ name: 'get_design', arguments: { projectId: PROJECT } })
    expect(textOf(summary)).toContain('right.ring')
  })

  it('อ่าน resource คู่มือและ JSON Schema ของ recipe ได้', async () => {
    const guide = await client.readResource({ uri: 'nailstudio://guide' })
    expect(JSON.stringify(guide.contents)).toContain('v = 0 ปลายเล็บ')
    const schema = await client.readResource({ uri: 'nailstudio://schema/recipe' })
    expect(JSON.stringify(schema.contents)).toContain('butterfly')
  })
})

describe('catalog', () => {
  it('รายการของตกแต่งตรงกับคลังของเว็บทุกชิ้น', () => {
    const source = readFileSync(fileURLToPath(new URL('../../web/src/3d/decorations/decorationCatalog.ts', import.meta.url)), 'utf8')
    const webIds = [...source.matchAll(/asset\('([a-z-]+)'/g)].map((m) => m[1])
    expect(DECORATIONS.map((d) => d.id).sort()).toEqual(webIds.sort())
  })
})
