import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
      'get_design', 'lint_design', 'list_decorations', 'list_palettes', 'list_patterns', 'list_presets', 'list_projects',
      'mirror_hand', 'open_page', 'preview_recipe', 'render_preview', 'set_nail', 'set_nail_properties', 'validate_document',
    ])
  })

  it('ประกาศทุก array ด้วย items แบบ object เพื่อให้ client สร้าง tool signature ได้', async () => {
    const { tools } = await client.listTools()
    const inspect = (value: unknown): void => {
      if (!value || typeof value !== 'object') return
      if (Array.isArray(value)) {
        value.forEach(inspect)
        return
      }
      const schema = value as Record<string, unknown>
      if (schema.type === 'array') {
        expect(schema.items).toBeTypeOf('object')
        expect(Array.isArray(schema.items)).toBe(false)
      }
      Object.values(schema).forEach(inspect)
    }
    tools.forEach((tool) => inspect(tool.inputSchema))
  })

  it('open_page คืนลิงก์ในเว็บที่ตั้งไว้ โดยไม่บันทึกหรือส่ง token', async () => {
    for (const page of ['projects', 'profile', 'community', 'shops', 'appointments', 'login']) {
      const result = await client.callTool({ name: 'open_page', arguments: { page } })
      expect(result.isError).toBeFalsy()
      expect(result.structuredContent).toEqual({ page, url: `http://web.test/${page}` })
      expect(result.content).toContainEqual({ type: 'resource_link', uri: `http://web.test/${page}`, name: expect.any(String), mimeType: 'text/html' })
    }
    const read = vi.spyOn(api, 'getProject')
    const editor = await client.callTool({ name: 'open_page', arguments: { page: 'editor', projectId: PROJECT } })
    expect(read).toHaveBeenCalledWith(PROJECT)
    expect(editor.structuredContent).toEqual({ page: 'editor', url: `http://web.test/editor/${PROJECT}` })
    expect(api.saves).toHaveLength(0)
  })

  it('open_page ปฏิเสธหน้าหรือรหัสงานผิด และตรวจสิทธิ์งานก่อนคืนลิงก์', async () => {
    for (const args of [{ page: 'editor' }, { page: 'login', projectId: PROJECT }, { page: 'https://evil.test' }, { page: 'editor', projectId: '../secret' }]) {
      expect((await client.callTool({ name: 'open_page', arguments: args })).isError).toBe(true)
    }
    vi.spyOn(api, 'getProject').mockRejectedValueOnce(new ApiError(404, 'ไม่พบงาน'))
    const result = await client.callTool({ name: 'open_page', arguments: { page: 'editor', projectId: PROJECT } })
    expect(result.isError).toBe(true)
    expect(result.structuredContent).toBeUndefined()
    expect(textOf(result)).not.toContain('http://web.test')
  })

  it('set_nail_properties เปลี่ยนเฉพาะค่าที่ระบุและเก็บลาย/ของตกแต่งเดิม', async () => {
    await client.callTool({ name: 'set_nail', arguments: { projectId: PROJECT, nails: ['index'], nail: {
      patterns: [{ type: 'heart', color: '#aa2233' }], decorations: [{ catalogId: 'gem-round' }],
    } } })
    const before = api.versions.at(-1)!
    const result = await client.callTool({ name: 'set_nail_properties', arguments: {
      projectId: PROJECT, nails: ['index', 'right.index'], shape: 'almond', length: 'long', base: '#dfaaa2',
    } })
    expect(result.isError).toBeFalsy()
    const after = api.versions.at(-1)!
    for (const key of ['left.index', 'right.index'] as const) {
      expect(after.nails[key]).toEqual({ ...before.nails[key], shape: 'almond', length: 'long', baseColor: '#dfaaa2' })
    }
    expect(after.nails['right.ring']).toEqual(before.nails['right.ring'])
    expect(api.saves).toEqual([{ expectedVersion: 1 }, { expectedVersion: 2 }])
  })

  it('set_nail_properties ปฏิเสธค่าผิด/คำสั่งว่างก่อนอ่านหรือบันทึกงาน', async () => {
    const read = vi.spyOn(api, 'getProject')
    for (const fields of [{}, { shape: 'unknown' }, { base: 'pink' }]) {
      expect((await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['index'], ...fields } })).isError).toBe(true)
    }
    expect(read).not.toHaveBeenCalled()
    expect(api.saves).toHaveLength(0)
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

describe('dryRun / ภาพหลังบันทึก / lint', () => {
  let api: FakeApi
  let client: Client

  type Part = { type: string; data?: string; text?: string }
  const parts = (result: object): Part[] => ((result as { content?: unknown }).content ?? []) as Part[]
  const images = (result: object): Part[] => parts(result).filter((c) => c.type === 'image')
  const pngWidth = (part: Part): number => Buffer.from(part.data!, 'base64').readUInt32BE(16)

  beforeEach(async () => {
    api = new FakeApi()
    // งานตั้งต้นที่มีของบน right.index ให้ copy/mirror/clear มีอะไรให้เปลี่ยน
    const document = createEmptyDocument()
    document.nails['right.index'] = {
      ...document.nails['right.index'],
      baseColor: '#aa3355',
      layers: [{
        id: 'layer-1', name: 'เลเยอร์ 1', visible: true, opacity: 1, blend: 'normal',
        strokes: [{ kind: 'brush', brush: 'round', color: '#ffffff', size: 40, opacity: 1, softness: 0.1, points: [{ x: 0.5, y: 0.5, p: 1 }] }],
      }],
      decorations: [{ id: 'd1', catalogId: 'pearl-single', u: 0.5, v: 0.6, rotation: 0, scale: 0.4 }],
    }
    api.versions = [document]
    client = await connect(api)
  })

  const writeCalls: { name: string; arguments: Record<string, unknown> }[] = [
    { name: 'apply_recipe', arguments: { projectId: PROJECT, recipe: { nails: { middle: { base: '#112233' } } } } },
    { name: 'apply_preset', arguments: { projectId: PROJECT, preset: 'glazed-pearl' } },
    { name: 'set_nail', arguments: { projectId: PROJECT, nails: ['ring'], nail: { base: '#123456' } } },
    { name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#abcdef' } },
    { name: 'copy_nail', arguments: { projectId: PROJECT, from: 'right.index', to: ['right.middle'] } },
    { name: 'mirror_hand', arguments: { projectId: PROJECT, from: 'right' } },
    { name: 'add_strokes', arguments: { projectId: PROJECT, nails: ['right.thumb'], strokes: [{ kind: 'fill', color: '#334455' }] } },
    { name: 'add_decoration', arguments: { projectId: PROJECT, nails: ['right.ring'], decorations: [{ catalogId: 'gem-round', u: 0.5, v: 0.5 }] } },
    { name: 'clear_nail', arguments: { projectId: PROJECT, nails: ['right.index'] } },
  ]

  it('dryRun ของทุก tool ที่บันทึก: คืนภาพ ไม่เรียก saveVersion', async () => {
    for (const call of writeCalls) {
      const result = await client.callTool({ name: call.name, arguments: { ...call.arguments, dryRun: true } })
      expect(result.isError, call.name).toBeFalsy()
      expect(textOf(result), call.name).toContain('ยังไม่บันทึก')
      expect(images(result), call.name).toHaveLength(1)
    }
    expect(api.saves).toHaveLength(0)
    expect(api.versions).toHaveLength(1)
  })

  it('บันทึกจริงคืนภาพเฉพาะนิ้วที่เปลี่ยน — นิ้วเดียวเป็นภาพขยาย', async () => {
    const result = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#abcdef' } })
    expect(textOf(result)).toContain('เวอร์ชัน 2')
    const [image] = images(result)
    expect(image).toBeDefined()
    expect(pngWidth(image!)).toBe(512)

    const many = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['ring'], base: '#123123' } })
    // สองนิ้ว (สองมือ) → ภาพทั้งมือแบบปกติ แถวละหนึ่งนิ้ว
    expect(pngWidth(images(many)[0]!)).toBe(200)
  })

  it('preview: false ไม่คืนภาพ', async () => {
    const result = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#abcdef', preview: false } })
    expect(textOf(result)).toContain('เวอร์ชัน 2')
    expect(images(result)).toHaveLength(0)
  })

  it('แก้ที่ไม่เปลี่ยนอะไร ไม่บันทึกเวอร์ชันใหม่', async () => {
    const result = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#aa3355' } })
    expect(textOf(result)).toContain('ไม่มีการเปลี่ยนแปลง')
    expect(api.saves).toHaveLength(0)
  })

  it('เอกสารจาก API ที่ลำดับคีย์ต่างจาก schema ไม่ถูกนับว่าเปลี่ยน', async () => {
    // API คืน JSON ที่เรียงคีย์ตามที่เก็บไว้ — กลับลำดับคีย์ของทุกอ็อบเจกต์ให้ต่างจากผลของ zod
    const reverse = (value: unknown): unknown => Array.isArray(value) ? value.map(reverse)
      : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k, v]) => [k, reverse(v)]))
        : value
    api.versions = [reverse(api.versions[0]) as DesignDocument]
    const result = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#aa3355' } })
    expect(textOf(result)).toContain('ไม่มีการเปลี่ยนแปลง')
    const changed = await client.callTool({ name: 'set_nail_properties', arguments: { projectId: PROJECT, nails: ['right.index'], base: '#000000', dryRun: true } })
    expect(textOf(changed)).toContain('นิ้วที่เปลี่ยน: right.index')
  })

  it('คำเตือนจาก lint ต่อท้ายผลของ dryRun', async () => {
    const result = await client.callTool({
      name: 'add_decoration',
      arguments: { projectId: PROJECT, nails: ['right.ring'], decorations: [{ catalogId: 'gem-round', u: 0.02, v: 0.5 }], dryRun: true },
    })
    expect(textOf(result)).toContain('[OUTSIDE_NAIL]')
  })

  it('lint_design ผ่าน client จริง', async () => {
    expect(textOf(await client.callTool({ name: 'lint_design', arguments: { projectId: PROJECT } }))).toBe('ไม่พบปัญหา')
    await client.callTool({
      name: 'add_decoration',
      arguments: { projectId: PROJECT, nails: ['right.ring'], decorations: [{ catalogId: 'gem-round', u: 0.02, v: 0.5 }] },
    })
    const result = await client.callTool({ name: 'lint_design', arguments: { projectId: PROJECT, nails: ['right.ring'] } })
    expect(textOf(result)).toContain('[OUTSIDE_NAIL] right.ring')
  })

  it('preview_recipe แบบ zoom nail แสดงนิ้วที่เปลี่ยนในมือที่เลือก และบอกวิธีแก้เมื่อเกิน', async () => {
    const recipe = { nails: { index: { base: '#112233' }, ring: { base: '#334455' } } }
    const right = await client.callTool({ name: 'preview_recipe', arguments: { recipe, hands: 'right', zoom: 'nail' } })
    expect(right.isError).toBeFalsy()
    expect(pngWidth(images(right)[0]!)).toBe(1024)
    const both = await client.callTool({ name: 'preview_recipe', arguments: { recipe, zoom: 'nail' } })
    expect(both.isError).toBe(true)
    expect(textOf(both)).toContain("hands: 'right'")
  })

  it('render_preview แบบ zoom nail และปฏิเสธเมื่อเกิน 3 นิ้ว', async () => {
    const ok = await client.callTool({ name: 'render_preview', arguments: { projectId: PROJECT, nails: ['right.index'], zoom: 'nail' } })
    expect(pngWidth(images(ok)[0]!)).toBe(512)
    const tooMany = await client.callTool({ name: 'render_preview', arguments: { projectId: PROJECT, nails: ['index', 'middle'], zoom: 'nail' } })
    expect(tooMany.isError).toBe(true)
    expect(textOf(tooMany)).toContain('ไม่เกิน 3 นิ้ว')
  })
})
