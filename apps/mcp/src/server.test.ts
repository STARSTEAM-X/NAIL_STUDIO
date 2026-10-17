import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createEmptyDocument, designDocumentSchema, type DesignDocument } from '@nail-studio/contracts'
import { createCanvas } from '@napi-rs/canvas'
import { renderLayer, type Ctx2D } from '../../web/src/3d/painting/rasterizer.ts'
import { DECORATIONS, PRESETS, buildFromRecipe, mirrorStroke, circle, fill, fillPolygons, type Pt } from '@nail-studio/patterns'
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
      'add_decoration', 'add_path', 'add_strokes', 'apply_preset', 'apply_recipe', 'clear_nail', 'copy_nail', 'create_project',
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
    { name: 'add_path', arguments: { projectId: PROJECT, nails: ['right.thumb'], paths: [{ d: 'M.3 .3 L.7 .7', stroke: '#123456' }] } },
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


describe('add_path', () => {

  it('apply_recipe ปฏิเสธ zigzag ตั้งแต่ path แรกและไม่เรียก saveVersion', async () => {
    const api = new FakeApi(), client = await connect(api)
    const save = vi.spyOn(api, 'saveVersion')
    const d = 'M' + Array.from({ length: 1000 }, (_, i) => [i, i % 2 ? 9 : 1]).flat().join(' ') + 'Z'
    const result = await client.callTool({ name: 'apply_recipe', arguments: {
      projectId: PROJECT,
      recipe: { nails: { index: { patterns: Array.from({ length: 24 }, () => ({
        type: 'path', d, viewBox: [0, 0, 1000, 10], fill: '#000000',
      })) } } },
    } })
    expect(result.isError).toBe(true)
    expect(textOf(result)).toContain('ลายระบายใช้ stroke เกิน 3,000 — ลดจำนวนจุดหยัก/รายละเอียดของ path')
    expect(save).not.toHaveBeenCalled()
    expect(api.versions).toHaveLength(1)
  })

  it('บันทึก expectedVersion, mirror เฉพาะชื่อนิ้ว และ preview ปิดได้', async () => {
    const api = new FakeApi(), client = await connect(api)
    const paths = [{ d: 'M20 20 Q40 70 60 80', viewBox: [0, 0, 100, 100], stroke: '#123456' }]
    const result = await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['index'], paths, preview: false } })
    expect(result.isError).toBeFalsy()
    expect(api.saves).toEqual([{ expectedVersion: 1 }])
    const right = api.versions.at(-1)!.nails['right.index'].layers.flatMap((l) => l.strokes)
    const left = api.versions.at(-1)!.nails['left.index'].layers.flatMap((l) => l.strokes)
    expect(left).toEqual(right.map(mirrorStroke))
    expect((result.content as { type: string }[]).some((p) => p.type === 'image')).toBe(false)
    await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['left.ring', 'right.ring'], paths } })
    expect(api.saves.at(-1)).toEqual({ expectedVersion: 2 })
    expect(api.versions.at(-1)!.nails['left.ring'].layers).toEqual(api.versions.at(-1)!.nails['right.ring'].layers)
    await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['middle'], paths, mirrorLeft: false, preview: false } })
    expect(api.versions.at(-1)!.nails['left.middle'].layers).toEqual(api.versions.at(-1)!.nails['right.middle'].layers)
    await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['thumb', 'left.thumb'], paths, preview: false } })
    expect(api.versions.at(-1)!.nails['left.thumb'].layers).toEqual(api.versions.at(-1)!.nails['right.thumb'].layers)
  })

  it('dryRun คืนภาพและคำเตือน โดยไม่บันทึก', async () => {
    const api = new FakeApi(), client = await connect(api)
    const result = await client.callTool({ name: 'add_path', arguments: {
      projectId: PROJECT, nails: ['right.index'], dryRun: true,
      paths: [{ d: 'M.01 .45 L.01 .55', stroke: '#000000' }],
    } })
    expect(result.isError).toBeFalsy()
    expect(textOf(result)).toContain('ยังไม่บันทึก')
    expect(textOf(result)).toContain('[OUTSIDE_NAIL]')
    expect((result.content as { type: string }[]).some((p) => p.type === 'image')).toBe(true)
    expect(api.saves).toHaveLength(0)
  })

  it('syntax/จุด/จำนวน stroke/ชุดที่ไม่มีรูป ถูกปฏิเสธก่อนอ่าน API', async () => {
    const api = new FakeApi(), client = await connect(api)
    const read = vi.spyOn(api, 'getProject')
    const invalid = await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['index'], paths: [
      { d: 'M0 0 L1 1', stroke: '#000000' }, { d: 'M 0 0 C 1', fill: '#000000' },
    ] } })
    expect(invalid.isError).toBe(true)
    expect(textOf(invalid)).toMatch(/paths\[1\]: path ผิดที่ตำแหน่ง \d+/)
    for (const paths of [
      [{ d: '', fill: '#000000' }, { d: 'M0 0', stroke: '#000000' }],
      Array.from({ length: 40 }, () => ({ d: 'M.2 0 H.8 V1 H.2 Z', fill: '#000000' })),
      [{ d: 'M0 0 ' + 'C1e10 1e10 -1e10 1e10 0 0 '.repeat(6), stroke: '#000000' }],
    ]) {
      const result = await client.callTool({ name: 'add_path', arguments: { projectId: PROJECT, nails: ['index'], paths } })
      expect(result.isError).toBe(true)
      expect(textOf(result)).toMatch(/ไม่มีรูปที่วาดได้|3,000|4,000/)
    }
    expect(read).not.toHaveBeenCalled()
    expect(api.saves).toHaveLength(0)
  })

  it('path ใช้ผ่าน preview_recipe/apply_recipe/set_nail และ fire-dragon อยู่ใน 4 MB', async () => {
    const api = new FakeApi(), client = await connect(api)
    const nail = { patterns: [{ type: 'path', d: 'M30 30 A20 20 0 1 1 70 30 Z', viewBox: [0, 0, 100, 100], fill: '#123456', stroke: '#abcdef' }] }
    for (const call of [
      { name: 'preview_recipe', arguments: { recipe: { nails: { 'right.index': nail } }, zoom: 'nail' } },
      { name: 'apply_recipe', arguments: { projectId: PROJECT, recipe: { nails: { 'right.index': nail } }, preview: false } },
      { name: 'set_nail', arguments: { projectId: PROJECT, nails: ['right.ring'], nail, preview: false } },
    ]) expect((await client.callTool(call)).isError, call.name).toBeFalsy()
    const document = buildFromRecipe(PRESETS['fire-dragon']!.recipe).document
    expect(designDocumentSchema.safeParse(document).success).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(document))).toBeLessThan(4 * 1024 * 1024)
    for (const nail of Object.values(document.nails)) expect(nail.layers.flatMap((l) => l.strokes).length).toBeLessThanOrEqual(3000)
  })
})

describe('fillPolygons raster coverage', () => {
  it('fill เดิมคง JSON ทุก byte ของรูปอ้างอิงก่อนแก้ 5 แบบ', () => {
    const polys: Pt[][] = [circle(.5, .5, .2), [[.1, .1], [.9, .1], [.9, .9], [.1, .9]],
      [[.2, .2], [.8, .3], [.5, .8]], [[.1, .1], [.9, .1], [.5, .4], [.9, .9], [.1, .9]],
      [[.5, .5], [.501, .5], [.501, .501]]]
    const expected = ["8ced4751fa005bdbb1a67cfb2b3249772d8cf176bdab31dedec433dac57508b0","9400087b110e68373bea2c2c399638bf3a11b587844ea216fd7704fa64b34487","8fcd10a1a52713b2554d344745bc5eae0296db1af19665e5c241c87e55e6e265","5f3b83c62cf08aa4a7a5b4d37b91555e4212bd9ac70f22ef10421deec693be35","a71b0f9b715d8b25f5a7ec1f90704dd73013110122a4db7a9e2a2f9a3627e162"]
    expect(polys.map((poly) => createHash('sha256').update(JSON.stringify(fill(poly, '#123456'))).digest('hex'))).toEqual(expected)
  })


  it('วงกลม ดาว และรูปเว้า ต่างจากพื้นที่จริงไม่เกิน 4% ด้วย renderLayer ที่ 512', () => {
    const star = Array.from({ length: 10 }, (_, i): Pt => {
      const a = i * Math.PI / 5, r = i % 2 ? .16 : .35
      return [.5 + r * Math.cos(a), .5 + r * Math.sin(a)]
    })
    const concave: Pt[] = [[.2, .2], [.8, .2], [.8, .4], [.4, .4], [.4, .8], [.2, .8]]
    for (const poly of [circle(.5, .5, .3, 160), star, concave]) {
      const size = 512, canvas = createCanvas(size, size)
      const strokes = fillPolygons([poly], '#000000', { brushWidth: .004 })
      // size เป็น px บน 1024 จึงย่อครึ่งเมื่อ render ที่ 512 เหมือน preview ของ MCP
      renderLayer(canvas.getContext('2d') as unknown as Ctx2D, {
        id: 'test', name: 'test', visible: true, opacity: 1, blend: 'normal',
        strokes: strokes.map((s) => ({ ...s, size: s.size / 2 })),
      }, size)
      const pixels = canvas.getContext('2d').getImageData(0, 0, size, size).data
      // เทียบกับ polygon ที่ Canvas เติมสีตรง ๆ ไม่ใช้ stroke/scanline ของเรา
      const expected = createCanvas(size, size), ctx = expected.getContext('2d')
      ctx.beginPath()
      ctx.moveTo(poly[0]![0] * size, (1 - poly[0]![1]) * size)
      for (const [u, v] of poly.slice(1)) ctx.lineTo(u * size, (1 - v) * size)
      ctx.closePath()
      ctx.fill()
      const truth = ctx.getImageData(0, 0, size, size).data
      let actual = 0, difference = 0
      for (let i = 3; i < pixels.length; i += 4) {
        const inside = truth[i]! > 127
        if (inside) actual++
        if (inside !== (pixels[i]! > 127)) difference++
      }
      expect(difference / actual).toBeLessThanOrEqual(.04)
    }
  }, 15000)
})
