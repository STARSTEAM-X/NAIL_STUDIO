import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  FINGERS,
  HANDS,
  NAIL_KEYS,
  MAX_LAYERS_PER_NAIL,
  MAX_STROKES_PER_LAYER,
  designDocumentSchema,
  strokeSchema,
  type DesignDocument,
  type NailKey,
  type Stroke,
} from '@nail-studio/contracts'
import {
  DECORATIONS,
  DESIGN_RULES,
  PALETTES,
  PATTERN_TYPES,
  PRESETS,
  addDecorations,
  addStrokes,
  buildFromRecipe,
  clearNail,
  copyNail,
  decorationSpecSchema,
  mirrorHand,
  mirrorStroke,
  pathSpecSchema,
  renderPattern,
  nailRecipeSchema,
  recipeSchema,
  summarizeDocument,
  type Recipe,
} from '@nail-studio/patterns'
import type { NailStudioApi } from './apiClient.ts'
import { formatFindings, lintDesign } from './lint.ts'
import { MAX_ZOOMED_NAILS, renderPreviewPng, type PreviewOptions } from './render.ts'

/**
 * MCP server ของ NailStudio — ให้ AI อ่าน/สร้าง/แก้ลายเล็บในเว็บผ่านข้อมูล schema เท่านั้น
 *
 * หลักการ:
 *  1. ทุกการแก้ = เวอร์ชันใหม่ (ไม่เขียนทับ) ผู้ใช้ย้อนกลับได้จากประวัติเวอร์ชันเสมอ
 *  2. ตรวจ designDocumentSchema ก่อนส่งทุกครั้ง — ไม่มีทางบันทึกเอกสารเสียลงฐานข้อมูล
 *  3. ส่ง expectedVersion ทุกครั้ง — ถ้าผู้ใช้บันทึกงานแทรกเข้ามา จะได้ข้อผิดพลาดชัดเจน ไม่ทับงานคน
 *  4. AI ส่ง recipe ระดับสูงเป็นหลัก (ลาย + พารามิเตอร์) แล้วเซิร์ฟเวอร์แปลงเป็น stroke ให้
 */

export interface ServerOptions {
  api: NailStudioApi
  webUrl: string
  oauth?: boolean
}

const nailTarget = z.union([z.enum(NAIL_KEYS as unknown as [NailKey, ...NailKey[]]), z.enum(FINGERS)])
  .describe('คีย์เต็ม เช่น "right.index" หรือชื่อนิ้ว เช่น "index" (= ทั้งสองมือ)')

function expandTargets(targets: readonly string[]): NailKey[] {
  const keys = new Set<NailKey>()
  for (const target of targets) {
    if ((NAIL_KEYS as readonly string[]).includes(target)) keys.add(target as NailKey)
    else for (const hand of HANDS) keys.add(`${hand}.${target}` as NailKey)
  }
  return [...keys]
}

const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })

type Content = { type: 'text'; text: string } | { type: 'image'; data: string; mimeType: string }

/** ส่วนของคู่มือ (resource) ที่อธิบายภาพตัวอย่าง, dryRun และคำเตือน */
const PREVIEW_GUIDE = [
  "- ลายที่ไม่มีใน catalog ใช้ add_path หรือ recipe type: 'path' เขียน SVG d ใน viewBox [0,0,100,100] แล้ววาง region ใน u 0.2–0.8, v 0.05–0.95; เลี่ยงรายละเอียดสำคัญช่วงปลายเล็บทรงยาว; วน dryRun + render_preview zoom: 'nail' เพื่อปรับ",
  '- ภาพตัวอย่างวาดตามทรง/ความยาวจริงของโมเดล: ลายที่ปลายเล็บทรงยาว (long/extra, almond/stiletto) ถูกยืดตามแนวยาวแบบเดียวกับที่ผู้ใช้เห็น',
  "- lighting 'scene' (ค่าเริ่มต้น) = สีที่ผู้ใช้เห็นบนโมเดล, 'flat' = สี hex ตรงตัว",
  "- zoom 'nail' ขยายทีละนิ้ว (ไม่เกิน 3 นิ้ว) ไว้ดูเส้นบาง เกล็ด และของตกแต่ง",
  '- ทุก tool ที่บันทึกรับ dryRun: true เพื่อดูภาพ + คำเตือนก่อน — วน ร่าง → dryRun → แก้ตามคำเตือน → บันทึก',
  '- คำเตือน: OUTSIDE_NAIL (นอก/ล้นเล็บ), STRETCHED (ทรงยืดลายชิ้น — ย้ายออกจากปลายหรือย่อ), LOW_CONTRAST (สีกลืนพื้น), NEAR_LIMIT (stroke/เลเยอร์ใกล้เพดาน), DENSE_PATTERNS (ลายหนาแน่นเกิน 2 ลาย)',
  '- lint_design ตรวจงานที่บันทึกแล้วได้ทุกเมื่อ',
].join('\n')

/** ตัวเลือกภาพตัวอย่างที่ใช้ร่วมกันทุก tool ที่แสดงภาพ */
const zoomInput = z.enum(['hand', 'nail']).default('hand')
  .describe("'hand' = ทั้งมือ, 'nail' = ขยายทีละนิ้ว (texture 1024, ไม่เกิน 3 นิ้ว) ไว้ดูเส้นบาง/เกล็ด")
const lightingInput = z.enum(['scene', 'flat']).default('scene')
  .describe("'scene' = แสง + tone mapping แบบฉากในเว็บ (สีที่ผู้ใช้เห็นจริง), 'flat' = สี hex ตรงตัว")
/** ตัวเลือกของทุก tool ที่บันทึก */
const dryRunInput = z.boolean().default(false).describe('true = ดูภาพ + คำเตือนโดยไม่บันทึก')
const previewInput = z.boolean().default(true).describe('คืนภาพของนิ้วที่เปลี่ยนหลังบันทึก')

/** นิ้วที่เนื้อหาเปลี่ยน — เทียบ JSON ทีละนิ้ว O(ขนาดเอกสาร) */
function changedNails(before: DesignDocument, after: DesignDocument): NailKey[] {
  return NAIL_KEYS.filter((key) => JSON.stringify(before.nails[key]) !== JSON.stringify(after.nails[key]))
}

/** ภาพของนิ้วที่เปลี่ยน: นิ้วเดียวขยายเต็ม, หลายนิ้วแสดงทั้งมือเฉพาะนิ้วนั้น */
function changedPreview(keys: readonly NailKey[]): PreviewOptions {
  if (keys.length === 1) return { only: [...keys], zoom: 'nail' }
  const hands = new Set(keys.map((key) => key.split('.')[0]))
  return { only: [...keys], scope: hands.size === 2 ? 'both' : (hands.has('left') ? 'left' : 'right') }
}

function errorResult(error: unknown) {
  const message = error instanceof z.ZodError
    ? `ข้อมูลไม่ผ่าน schema:\n${error.issues.slice(0, 8).map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`
    : error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

export function createNailStudioServer({ api, webUrl, oauth = false }: ServerOptions): McpServer {
  const server = new McpServer(
    { name: 'nail-studio', version: '0.1.0' },
    {
      instructions: `เครื่องมือออกแบบลายเล็บของ NailStudio — แก้งานได้ด้วยข้อมูล schema เท่านั้น
ลำดับที่แนะนำ: list_patterns/list_presets → preview_recipe หรือ tool แก้งานด้วย dryRun: true (ดูภาพ + คำเตือน) → ปรับจนคำเตือนหมด → บันทึก → render_preview (ตรวจ)
ภาพตัวอย่างแสดงทรงเล็บจริงและแสงแบบในเว็บ; zoom: 'nail' ขยายทีละนิ้ว (ไม่เกิน 3) ไว้ดูเส้นบาง/เกล็ด; lighting: 'flat' ดูสี hex ตรงตัว
ลายที่ไม่มีใน catalog ใช้ add_path หรือ recipe type: 'path' เขียน SVG d ใน viewBox [0,0,100,100] แล้ววาง region ใน u 0.2–0.8, v 0.05–0.95; เลี่ยงรายละเอียดสำคัญช่วงปลายเล็บทรงยาว; วน dryRun + render_preview zoom: 'nail' เพื่อปรับ
ทุกการบันทึกสร้างเวอร์ชันใหม่ ผู้ใช้ย้อนกลับได้เสมอ
ปรับทรง/ความยาว/สีพื้นโดยเก็บลายเดิม: set_nail_properties
เมื่อผู้ใช้ต้องเปิดเว็บ: open_page คืนลิงก์ให้ client เปิดด้วยเครื่องมือเบราว์เซอร์ ถ้าต้องล็อกอินให้ผู้ใช้ทำในเบราว์เซอร์ของตนเอง

${DESIGN_RULES}`,
    },
  )

  const editorLink = (projectId: string): string => `${webUrl}/editor/${projectId}`
  const authMetadata = oauth ? { _meta: { securitySchemes: [{ type: 'oauth2', scopes: ['nails:design'] }] } } : {}

  const image = (document: DesignDocument, options: PreviewOptions): Content => ({
    type: 'image',
    data: renderPreviewPng(document, options).toString('base64'),
    mimeType: 'image/png',
  })

  /** ข้อความคำเตือนจาก lint (ไม่มีคำเตือน = ไม่มีอะไรต่อท้าย) */
  const warnings = (document: DesignDocument, nails: readonly NailKey[], recipe?: Recipe): Content[] => {
    const message = formatFindings(lintDesign(document, { nails, ...(recipe ? { recipe } : {}) }))
    return message ? [{ type: 'text', text: message }] : []
  }

  interface UpdateOptions {
    dryRun?: boolean
    preview?: boolean
    /** recipe ที่ใช้สร้างการแก้ — ส่งให้ lint ตรวจลายหนาแน่น */
    recipe?: Recipe
  }

  /**
   * อ่านเวอร์ชันล่าสุด → แก้ → ตรวจ → บันทึกเวอร์ชันใหม่ (กันทับงานด้วย expectedVersion)
   * dryRun ไม่บันทึก; ไม่มีอะไรเปลี่ยนก็ไม่บันทึก (ไม่สร้างเวอร์ชันซ้ำ)
   */
  async function updateDesign(
    projectId: string,
    edit: (document: DesignDocument) => DesignDocument,
    { dryRun = false, preview = true, recipe }: UpdateOptions = {},
  ): Promise<{ content: Content[] }> {
    const current = await api.getProject(projectId)
    // เทียบกับเอกสารที่ผ่าน schema แล้วเหมือนกัน — ลำดับคีย์จาก API ต่างจากผลของ zod ได้
    const before = designDocumentSchema.parse(current.version.document)
    const next = designDocumentSchema.parse(edit(current.version.document))
    if (JSON.stringify(next) === JSON.stringify(before)) {
      return text(`ไม่มีการเปลี่ยนแปลง — ไม่ได้บันทึกเวอร์ชันใหม่ (ยังเป็นเวอร์ชัน ${current.version.number})`)
    }
    const changed = changedNails(before, next)
    const visuals = (show: boolean): Content[] => (changed.length > 0
      ? [...(show ? [image(next, changedPreview(changed))] : []), ...warnings(next, changed, recipe)]
      : [])
    if (dryRun) {
      const which = changed.join(', ') || 'ไม่มี (เปลี่ยนเฉพาะค่าของมือ)'
      return { content: [{ type: 'text', text: `ตัวอย่าง (ยังไม่บันทึก) — นิ้วที่เปลี่ยน: ${which}` }, ...visuals(true)] }
    }
    const saved = await api.saveVersion(projectId, next, current.version.number)
    return {
      content: [
        { type: 'text', text: `บันทึกเป็นเวอร์ชัน ${saved.versionNumber} แล้ว (จากเวอร์ชัน ${current.version.number})\nเปิดใน editor: ${editorLink(projectId)}` },
        ...visuals(preview),
      ],
    }
  }

  // ── อ่าน ────────────────────────────────────────────────────────────────

  server.registerTool('open_page', {
    ...authMetadata,
    title: 'เปิดหน้าที่เกี่ยวข้องใน NailStudio',
    description: 'คืนลิงก์หน้าเว็บที่ตรวจแล้วให้ client เปิดด้วยเครื่องมือเบราว์เซอร์ หรือแสดงลิงก์ให้ผู้ใช้คลิก ไม่สร้าง session ล็อกอินให้เบราว์เซอร์; editor ต้องระบุ projectId ของงานที่ผู้ใช้มีสิทธิ์',
    inputSchema: {
      page: z.enum(['projects', 'editor', 'profile', 'community', 'shops', 'appointments', 'login']),
      projectId: z.string().uuid().optional(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }, async ({ page, projectId }) => {
    try {
      if (page === 'editor' && !projectId) return errorResult(new Error('หน้า editor ต้องระบุ projectId — ดู list_projects'))
      if (page !== 'editor' && projectId) return errorResult(new Error('ใช้ projectId ได้เฉพาะหน้า editor'))
      if (page === 'editor') await api.getProject(projectId!)
      const path = page === 'editor' ? `/editor/${projectId}` : `/${page}`
      const url = new URL(path, webUrl)
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
        return errorResult(new Error('NAIL_STUDIO_WEB_URL ต้องเป็น HTTP(S) URL ที่ไม่มี credentials'))
      }
      const titles = {
        projects: 'งานออกแบบของฉัน', editor: 'ตัวออกแบบเล็บ', profile: 'โปรไฟล์และการเชื่อมต่อ AI',
        community: 'ชุมชน', shops: 'ร้านทำเล็บ', appointments: 'การนัดหมาย', login: 'เข้าสู่ระบบ',
      }
      return {
        structuredContent: { page, url: url.href },
        content: [
          { type: 'resource_link' as const, uri: url.href, name: titles[page], mimeType: 'text/html' },
          ...text(`เปิด${titles[page]}: ${url.href}\nให้ client เปิดลิงก์นี้ด้วยเครื่องมือเบราว์เซอร์ หรือให้ผู้ใช้คลิก; หากพบหน้าเข้าสู่ระบบให้ผู้ใช้ล็อกอินเอง ไม่ส่ง token ผ่าน URL`).content,
        ],
      }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('list_projects', {
    ...authMetadata,
    title: 'รายการงานออกแบบ',
    description: 'รายการงานออกแบบของผู้ใช้ (ล่าสุดก่อน)',
    annotations: { readOnlyHint: true },
  }, async () => {
    try {
      const projects = await api.listProjects()
      if (projects.length === 0) return text('ยังไม่มีงาน — ใช้ create_project เพื่อสร้าง')
      return text(projects.map((p) => `${p.id}  ${p.name}  (v${p.versionCount}, ${p.updatedAt})`).join('\n'))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('get_design', {
    ...authMetadata,
    title: 'อ่านงานออกแบบ',
    description: 'อ่านเอกสารเวอร์ชันล่าสุด — summary (ค่าเริ่มต้น) สรุปต่อนิ้ว, full คืน JSON เต็ม (อาจใหญ่มาก)',
    inputSchema: { projectId: z.string().uuid(), format: z.enum(['summary', 'full']).default('summary') },
    annotations: { readOnlyHint: true },
  }, async ({ projectId, format }) => {
    try {
      const { project, version } = await api.getProject(projectId)
      const head = `${project.name} · เวอร์ชัน ${version.number}\n${editorLink(projectId)}`
      return text(format === 'full' ? `${head}\n${JSON.stringify(version.document)}` : `${head}\n${summarizeDocument(version.document)}`)
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('list_patterns', {
    ...authMetadata,
    title: 'ชนิดลายที่ใช้ได้',
    description: 'ชนิดลายทั้งหมดที่ใช้ใน recipe.patterns พร้อมคำอธิบาย (พารามิเตอร์ดูได้จาก JSON Schema ของ apply_recipe)',
    annotations: { readOnlyHint: true },
  }, async () => text(PATTERN_TYPES.map((p) => `${p.type} — ${p.description}`).join('\n')))

  server.registerTool('list_decorations', {
    ...authMetadata,
    title: 'ของตกแต่ง 3 มิติ',
    description: 'catalogId ของตกแต่งทั้งหมด ใช้กับ recipe.nails[*].decorations หรือ add_decoration',
    annotations: { readOnlyHint: true },
  }, async () => text(DECORATIONS.map((d) => `${d.id} — ${d.label} (${d.category})`).join('\n')))

  server.registerTool('list_palettes', {
    ...authMetadata,
    title: 'ชุดสีแนะนำ',
    description: 'ชุดสีที่เข้ากัน (จากระบบ AI recipe เดิมของเว็บ)',
    annotations: { readOnlyHint: true },
  }, async () => text(Object.entries(PALETTES).map(([id, colors]) => `${id}: ${colors.join(' ')}`).join('\n')))

  server.registerTool('list_presets', {
    ...authMetadata,
    title: 'ดีไซน์สำเร็จรูป',
    description: 'ดีไซน์ที่ทดสอบบน editor แล้ว — ใช้กับ apply_preset หรือดู recipe เป็นตัวอย่าง (includeRecipe)',
    inputSchema: { includeRecipe: z.boolean().default(false) },
    annotations: { readOnlyHint: true },
  }, async ({ includeRecipe }) => text(Object.entries(PRESETS).map(([id, p]) =>
    `${id} — ${p.title}: ${p.description}${includeRecipe ? `\n${JSON.stringify(p.recipe)}` : ''}`).join('\n')))

  // ── ตรวจ / ดูตัวอย่าง (ไม่บันทึก) ──────────────────────────────────────

  server.registerTool('preview_recipe', {
    ...authMetadata,
    title: 'ดูตัวอย่าง recipe (ไม่บันทึก)',
    description: 'สร้างภาพตัวอย่างจาก recipe โดยไม่บันทึกอะไร — ถ้าใส่ projectId จะลงบนงานนั้น (นิ้วที่ไม่ระบุคงของเดิม)',
    inputSchema: {
      recipe: recipeSchema,
      projectId: z.string().uuid().optional(),
      hands: z.enum(['right', 'left', 'both']).default('both'),
      zoom: zoomInput.describe("'hand' = ทั้งมือ, 'nail' = ขยายเฉพาะนิ้วที่ recipe เปลี่ยน (ไม่เกิน 3 นิ้ว)"),
      lighting: lightingInput,
    },
    annotations: { readOnlyHint: true },
  }, async ({ recipe, projectId, hands, zoom, lighting }) => {
    try {
      const base = projectId ? (await api.getProject(projectId)).version.document : undefined
      const { document, changed } = buildFromRecipe(recipe, base)
      const zoomed = changed.filter((key) => hands === 'both' || key.startsWith(`${hands}.`))
      if (zoom === 'nail' && zoomed.length > MAX_ZOOMED_NAILS) {
        return errorResult(new Error(`recipe นี้เปลี่ยน ${zoomed.length} นิ้วในมือที่เลือก — zoom 'nail' แสดงได้ไม่เกิน ${MAX_ZOOMED_NAILS} นิ้ว: ใช้ hands: 'right' หรือ zoom: 'hand'`))
      }
      const options: PreviewOptions = zoom === 'nail' ? { only: zoomed, zoom, lighting } : { scope: hands, zoom, lighting }
      return {
        content: [
          { type: 'text' as const, text: `ตัวอย่าง (ยังไม่บันทึก) — นิ้วที่เปลี่ยน: ${changed.join(', ') || 'ไม่มี'}` },
          image(document, options),
          ...warnings(document, changed, recipe),
        ],
      }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('render_preview', {
    ...authMetadata,
    title: 'ภาพตัวอย่างงาน',
    description: 'ภาพ PNG ของงานเวอร์ชันล่าสุด ตามทรงเล็บจริง (ปลายเล็บอยู่บน) พร้อมคำเตือนจาก lint — ใช้ตรวจผลหลังบันทึก',
    inputSchema: {
      projectId: z.string().uuid(),
      hands: z.enum(['right', 'left', 'both']).default('both'),
      nails: z.array(nailTarget).optional().describe('เฉพาะบางนิ้ว (จำเป็นเมื่อ zoom = nail)'),
      zoom: zoomInput,
      lighting: lightingInput,
    },
    annotations: { readOnlyHint: true },
  }, async ({ projectId, hands, nails, zoom, lighting }) => {
    try {
      const { version } = await api.getProject(projectId)
      const only = nails ? expandTargets(nails) : undefined
      const shown = (only ?? NAIL_KEYS).filter((key) => hands === 'both' || key.startsWith(`${hands}.`))
      return {
        content: [
          image(version.document, { scope: hands, zoom, lighting, ...(only ? { only } : {}) }),
          ...warnings(version.document, shown),
        ],
      }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('lint_design', {
    ...authMetadata,
    title: 'ตรวจกฎการออกแบบ',
    description: `ตรวจงานเวอร์ชันล่าสุดตามกฎในคู่มือ: ลายชิ้น/ของตกแต่งนอกเล็บหรือล้นขอบ (OUTSIDE_NAIL),
ลายชิ้นที่ทรงเล็บยืดจนเพี้ยน (STRETCHED), สีที่กลืนกับพื้น (LOW_CONTRAST) และจำนวน stroke/เลเยอร์ใกล้เพดาน (NEAR_LIMIT)`,
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).optional().describe('เฉพาะบางนิ้ว (ไม่ใส่ = ทุกนิ้ว)'),
    },
    annotations: { readOnlyHint: true },
  }, async ({ projectId, nails }) => {
    try {
      const { version } = await api.getProject(projectId)
      const findings = lintDesign(version.document, nails ? { nails: expandTargets(nails) } : {})
      return text(formatFindings(findings, 40) ?? 'ไม่พบปัญหา')
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('validate_document', {
    ...authMetadata,
    title: 'ตรวจเอกสาร',
    description: 'ตรวจเอกสาร JSON กับ designDocumentSchema ตัวจริง (เอกสาร v2 จะถูก migrate ก่อนตรวจ)',
    inputSchema: { document: z.unknown() },
    annotations: { readOnlyHint: true },
  }, async ({ document }) => {
    const result = designDocumentSchema.safeParse(document)
    return result.success ? text('ผ่าน schema') : errorResult(result.error)
  })

  // ── สร้าง / แก้ (ทุกครั้ง = เวอร์ชันใหม่) ────────────────────────────────

  server.registerTool('create_project', {
    ...authMetadata,
    title: 'สร้างงานใหม่',
    description: 'สร้างงานใหม่ แล้วลง preset หรือ recipe ได้ทันที (ไม่ใส่ = เล็บเปล่า)',
    inputSchema: {
      name: z.string().min(1).max(120),
      preset: z.enum(Object.keys(PRESETS) as [string, ...string[]]).optional(),
      recipe: recipeSchema.optional(),
    },
  }, async ({ name, preset, recipe }) => {
    try {
      const project = await api.createProject(name)
      const chosen = recipe ?? (preset ? PRESETS[preset]!.recipe : undefined)
      if (!chosen) return text(`สร้างงาน ${project.id} แล้ว\n${editorLink(project.id)}`)
      const saved = await updateDesign(project.id, (document) => buildFromRecipe(chosen, document).document, { recipe: chosen })
      const [first, ...rest] = saved.content
      const message = first?.type === 'text' ? `\n${first.text}` : ''
      return { content: [{ type: 'text' as const, text: `สร้างงาน ${project.id} แล้ว${message}` }, ...(first?.type === 'text' ? rest : saved.content)] }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('apply_recipe', {
    ...authMetadata,
    title: 'ลงลายจาก recipe',
    description: `ลงลายบนงานจาก recipe ระดับสูง แล้วบันทึกเป็นเวอร์ชันใหม่ — นิ้วที่ระบุถูกแทนทั้งนิ้ว นิ้วที่ไม่ระบุคงของเดิม
คีย์ nails: ชื่อนิ้ว (thumb/index/middle/ring/little = ทั้งสองมือ, มือซ้าย mirror ให้) หรือคีย์เต็ม (right.index)`,
    inputSchema: { projectId: z.string().uuid(), recipe: recipeSchema, dryRun: dryRunInput, preview: previewInput },
  }, async ({ projectId, recipe, dryRun, preview }) => {
    try {
      return await updateDesign(projectId, (document) => buildFromRecipe(recipe, document).document, { dryRun, preview, recipe })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('apply_preset', {
    ...authMetadata,
    title: 'ลงดีไซน์สำเร็จรูป',
    description: 'ลง preset ทั้งชุดบนงาน (ทุกนิ้วที่ preset กำหนด) แล้วบันทึกเป็นเวอร์ชันใหม่',
    inputSchema: {
      projectId: z.string().uuid(),
      preset: z.enum(Object.keys(PRESETS) as [string, ...string[]]),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, preset, dryRun, preview }) => {
    try {
      const recipe = PRESETS[preset]!.recipe
      return await updateDesign(projectId, (document) => buildFromRecipe(recipe, document).document, { dryRun, preview, recipe })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('set_nail', {
    ...authMetadata,
    title: 'แก้เล็บบางนิ้ว',
    description: 'แทนเล็บที่ระบุด้วย recipe ของนิ้วเดียว (ทรง สีพื้น ลาย ของตกแต่ง)',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      nail: nailRecipeSchema,
      mirrorLeft: z.boolean().default(true),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, nails, nail, mirrorLeft, dryRun, preview }) => {
    try {
      const recipe = { mirrorLeft, nails: Object.fromEntries(nails.map((key) => [key, nail])) }
      return await updateDesign(projectId, (document) => buildFromRecipe(recipe, document).document, { dryRun, preview, recipe })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('set_nail_properties', {
    ...authMetadata,
    title: 'ปรับลักษณะเล็บโดยเก็บลายเดิม',
    description: 'ปรับทรง ความยาว ผิว หรือสีพื้นของนิ้วที่ระบุ โดยเก็บเลเยอร์ ลาย และของตกแต่งเดิม แล้วบันทึกเวอร์ชันใหม่; ชื่อนิ้วอย่าง index ใช้กับทั้งสองมือ',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      shape: nailRecipeSchema.shape.shape,
      length: nailRecipeSchema.shape.length,
      finish: nailRecipeSchema.shape.finish,
      base: nailRecipeSchema.shape.base,
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, nails, shape, length, finish, base, dryRun, preview }) => {
    if (shape === undefined && length === undefined && finish === undefined && base === undefined) {
      return errorResult(new Error('ระบุอย่างน้อยหนึ่งค่า: shape, length, finish หรือ base'))
    }
    try {
      return await updateDesign(projectId, (document) => {
        const next = { ...document, nails: { ...document.nails } }
        for (const key of expandTargets(nails)) {
          const old = document.nails[key]
          next.nails[key] = {
            ...old,
            shape: shape ?? old.shape,
            length: length ?? old.length,
            finish: finish ?? old.finish,
            baseColor: base ?? old.baseColor,
          }
        }
        return next
      }, { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('copy_nail', {
    ...authMetadata,
    title: 'คัดลอกลายเล็บ',
    description: 'คัดลอกเล็บนิ้วหนึ่งไปยังนิ้วอื่น (mirror = กลับซ้าย-ขวา)',
    inputSchema: {
      projectId: z.string().uuid(),
      from: z.enum(NAIL_KEYS as unknown as [NailKey, ...NailKey[]]),
      to: z.array(nailTarget).min(1),
      mirror: z.boolean().default(false),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, from, to, mirror, dryRun, preview }) => {
    try {
      return await updateDesign(projectId, (document) => copyNail(document, from, expandTargets(to).filter((k) => k !== from), mirror), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('mirror_hand', {
    ...authMetadata,
    title: 'ทำอีกมือให้สมมาตร',
    description: 'คัดลอกทั้งมือไปอีกข้างแบบกลับซ้าย-ขวา',
    inputSchema: { projectId: z.string().uuid(), from: z.enum(HANDS), dryRun: dryRunInput, preview: previewInput },
  }, async ({ projectId, from, dryRun, preview }) => {
    try {
      return await updateDesign(projectId, (document) => mirrorHand(document, from), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('add_path', {
    ...authMetadata,
    title: 'เพิ่มลายอิสระจาก SVG path',
    description: 'ต่อ SVG path (M L H V C S Q T A Z) บนเล็บเดิม ใช้ fill/stroke และ viewBox [0,0,100,100]; dryRun ดูภาพและคำเตือนก่อนบันทึก',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      paths: z.array(pathSpecSchema).min(1).max(40),
      mirrorLeft: z.boolean().default(true),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, nails, paths, mirrorLeft, dryRun, preview }) => {
    try {
      const strokes: Stroke[] = []
      for (const [i, path] of paths.entries()) {
        try {
          const generated = renderPattern({ type: 'path', ...path })
          if (strokes.length + generated.length > MAX_LAYERS_PER_NAIL * MAX_STROKES_PER_LAYER) throw new Error('stroke รวมต่อเล็บเกิน 3,000 — แบ่ง path หรือลดรายละเอียด')
          strokes.push(...generated)
        } catch (error) { throw new Error(`paths[${i}]: ${error instanceof Error ? error.message : String(error)}`) }
      }
      if (strokes.length === 0) throw new Error('ไม่มีรูปที่วาดได้')
      const targets = expandTargets(nails)
      return await updateDesign(projectId, (document) => targets.reduce((doc, key) => {
        // คีย์เต็มชนะคีย์ชื่อนิ้วเหมือน buildFromRecipe
        const mirror = mirrorLeft && key.startsWith('left.') && !nails.includes(key)
        return addStrokes(doc, key, mirror ? strokes.map(mirrorStroke) : strokes)
      }, document), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('add_strokes', {
    ...authMetadata,
    title: 'เพิ่ม stroke ดิบ (ขั้นสูง)',
    description: `ต่อ stroke ตาม schema ตรง ๆ บนเล็บที่ระบุ — ใช้เมื่อลายที่ต้องการไม่มีใน list_patterns
points: x = u, y = v (0 ปลายเล็บ → 1 โคนเล็บ), p = แรงกด; size = พิกเซลบน texture 1024 (รัศมี = size/2)`,
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      strokes: z.array(strokeSchema).min(1).max(500),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, nails, strokes, dryRun, preview }) => {
    try {
      return await updateDesign(projectId, (document) =>
        expandTargets(nails).reduce((doc, key) => addStrokes(doc, key, strokes), document), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('add_decoration', {
    ...authMetadata,
    title: 'วางของตกแต่ง',
    description: 'วางของตกแต่ง 3 มิติ (catalogId จาก list_decorations) บนเล็บที่ระบุ',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      decorations: z.array(decorationSpecSchema).min(1).max(30),
      dryRun: dryRunInput,
      preview: previewInput,
    },
  }, async ({ projectId, nails, decorations, dryRun, preview }) => {
    try {
      const unknown = decorations.map((d) => d.catalogId).filter((id) => !DECORATIONS.some((d) => d.id === id))
      if (unknown.length > 0) return errorResult(new Error(`ไม่รู้จัก catalogId: ${unknown.join(', ')} — ดู list_decorations`))
      return await updateDesign(projectId, (document) => expandTargets(nails).reduce((doc, key) => addDecorations(doc, key,
        decorations.map((d, i) => ({
          id: `ai-${d.catalogId}-${Date.now().toString(36)}-${i}`,
          catalogId: d.catalogId, u: d.u, v: d.v, rotation: d.rotation, scale: d.scale,
          ...(d.color === undefined ? {} : { color: d.color }),
        }))), document), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('clear_nail', {
    ...authMetadata,
    title: 'ล้างลาย',
    description: 'ล้างลาย (และของตกแต่งถ้าไม่สั่ง keepDecorations) โดยคงทรง ความยาว ผิว สีพื้น',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      keepDecorations: z.boolean().default(false),
      dryRun: dryRunInput,
      preview: previewInput,
    },
    annotations: { destructiveHint: true },
  }, async ({ projectId, nails, keepDecorations, dryRun, preview }) => {
    try {
      return await updateDesign(projectId, (document) =>
        expandTargets(nails).reduce((doc, key) => clearNail(doc, key, !keepDecorations), document), { dryRun, preview })
    } catch (error) { return errorResult(error) }
  })

  // ── Resources / Prompts ─────────────────────────────────────────────────

  server.registerResource('guide', 'nailstudio://guide', {
    title: 'คู่มือออกแบบลายเล็บ',
    description: 'ระบบพิกัด กฎจากการทดสอบ และวิธีใช้ recipe',
    mimeType: 'text/markdown',
  }, async (uri) => ({
    contents: [{
      uri: uri.href,
      mimeType: 'text/markdown',
      text: `# NailStudio — คู่มือสำหรับ AI\n\n## กฎ\n${DESIGN_RULES}\n\n## ภาพตัวอย่างและการตรวจ\n${PREVIEW_GUIDE}\n\n## ชนิดลาย\n${PATTERN_TYPES.map((p) => `- \`${p.type}\` — ${p.description}`).join('\n')}\n\n## ตัวอย่าง recipe\n\`\`\`json\n${JSON.stringify(PRESETS['lavender-butterfly']!.recipe, null, 2)}\n\`\`\``,
    }],
  }))

  server.registerResource('recipe-schema', 'nailstudio://schema/recipe', {
    title: 'JSON Schema ของ recipe',
    mimeType: 'application/json',
  }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(z.toJSONSchema(recipeSchema, { io: 'input' }), null, 2) }],
  }))

  server.registerPrompt('design_from_description', {
    title: 'ออกแบบจากคำบรรยาย',
    description: 'ให้ AI ออกแบบลายเล็บจากคำบรรยาย/รูปตัวอย่าง แล้วลงบนงาน',
    argsSchema: { description: z.string(), projectId: z.string().optional() },
  }, ({ description, projectId }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `ออกแบบลายเล็บตามนี้: ${description}
${projectId ? `ลงบนงาน ${projectId}` : 'สร้างงานใหม่ด้วย create_project'}
ขั้นตอน: แยกลายต่อเล็บ (สีพื้น → ไล่สี/พื้นผิว → ลายหลัก → รายละเอียด) → preview_recipe ดูภาพแล้วปรับ → apply_recipe → render_preview ตรวจ
อ่าน nailstudio://guide ก่อนถ้ายังไม่รู้กฎ`,
      },
    }],
  }))

  return server
}
