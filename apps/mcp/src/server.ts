import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  FINGERS,
  HANDS,
  NAIL_KEYS,
  designDocumentSchema,
  strokeSchema,
  type DesignDocument,
  type NailKey,
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
  nailRecipeSchema,
  recipeSchema,
  summarizeDocument,
} from '@nail-studio/patterns'
import type { NailStudioApi } from './apiClient.ts'
import { renderPreviewPng, type PreviewScope } from './render.ts'

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

function errorResult(error: unknown) {
  const message = error instanceof z.ZodError
    ? `ข้อมูลไม่ผ่าน schema:\n${error.issues.slice(0, 8).map((i) => `- ${i.path.join('.')}: ${i.message}`).join('\n')}`
    : error instanceof Error ? error.message : String(error)
  return { content: [{ type: 'text' as const, text: message }], isError: true }
}

export function createNailStudioServer({ api, webUrl }: ServerOptions): McpServer {
  const server = new McpServer(
    { name: 'nail-studio', version: '0.1.0' },
    {
      instructions: `เครื่องมือออกแบบลายเล็บของ NailStudio — แก้งานได้ด้วยข้อมูล schema เท่านั้น
ลำดับที่แนะนำ: list_patterns/list_presets → preview_recipe (ดูภาพก่อน) → apply_recipe (บันทึก) → render_preview (ตรวจ)
ทุกการบันทึกสร้างเวอร์ชันใหม่ ผู้ใช้ย้อนกลับได้เสมอ

${DESIGN_RULES}`,
    },
  )

  const editorLink = (projectId: string): string => `${webUrl}/editor/${projectId}`

  /** อ่านเวอร์ชันล่าสุด → แก้ → ตรวจ → บันทึกเวอร์ชันใหม่ (กันทับงานด้วย expectedVersion) */
  async function updateDesign(projectId: string, edit: (document: DesignDocument) => DesignDocument): Promise<string> {
    const current = await api.getProject(projectId)
    const next = designDocumentSchema.parse(edit(current.version.document))
    const saved = await api.saveVersion(projectId, next, current.version.number)
    return `บันทึกเป็นเวอร์ชัน ${saved.versionNumber} แล้ว (จากเวอร์ชัน ${current.version.number})\nเปิดใน editor: ${editorLink(projectId)}`
  }

  const image = (document: DesignDocument, scope: PreviewScope, only?: NailKey[]) => ({
    type: 'image' as const,
    data: renderPreviewPng(document, scope, only).toString('base64'),
    mimeType: 'image/png',
  })

  // ── อ่าน ────────────────────────────────────────────────────────────────

  server.registerTool('list_projects', {
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
    title: 'ชนิดลายที่ใช้ได้',
    description: 'ชนิดลายทั้งหมดที่ใช้ใน recipe.patterns พร้อมคำอธิบาย (พารามิเตอร์ดูได้จาก JSON Schema ของ apply_recipe)',
    annotations: { readOnlyHint: true },
  }, async () => text(PATTERN_TYPES.map((p) => `${p.type} — ${p.description}`).join('\n')))

  server.registerTool('list_decorations', {
    title: 'ของตกแต่ง 3 มิติ',
    description: 'catalogId ของตกแต่งทั้งหมด ใช้กับ recipe.nails[*].decorations หรือ add_decoration',
    annotations: { readOnlyHint: true },
  }, async () => text(DECORATIONS.map((d) => `${d.id} — ${d.label} (${d.category})`).join('\n')))

  server.registerTool('list_palettes', {
    title: 'ชุดสีแนะนำ',
    description: 'ชุดสีที่เข้ากัน (จากระบบ AI recipe เดิมของเว็บ)',
    annotations: { readOnlyHint: true },
  }, async () => text(Object.entries(PALETTES).map(([id, colors]) => `${id}: ${colors.join(' ')}`).join('\n')))

  server.registerTool('list_presets', {
    title: 'ดีไซน์สำเร็จรูป',
    description: 'ดีไซน์ที่ทดสอบบน editor แล้ว — ใช้กับ apply_preset หรือดู recipe เป็นตัวอย่าง (includeRecipe)',
    inputSchema: { includeRecipe: z.boolean().default(false) },
    annotations: { readOnlyHint: true },
  }, async ({ includeRecipe }) => text(Object.entries(PRESETS).map(([id, p]) =>
    `${id} — ${p.title}: ${p.description}${includeRecipe ? `\n${JSON.stringify(p.recipe)}` : ''}`).join('\n')))

  // ── ตรวจ / ดูตัวอย่าง (ไม่บันทึก) ──────────────────────────────────────

  server.registerTool('preview_recipe', {
    title: 'ดูตัวอย่าง recipe (ไม่บันทึก)',
    description: 'สร้างภาพตัวอย่างจาก recipe โดยไม่บันทึกอะไร — ถ้าใส่ projectId จะลงบนงานนั้น (นิ้วที่ไม่ระบุคงของเดิม)',
    inputSchema: {
      recipe: recipeSchema,
      projectId: z.string().uuid().optional(),
      hands: z.enum(['right', 'left', 'both']).default('both'),
    },
    annotations: { readOnlyHint: true },
  }, async ({ recipe, projectId, hands }) => {
    try {
      const base = projectId ? (await api.getProject(projectId)).version.document : undefined
      const { document, changed } = buildFromRecipe(recipe, base)
      return { content: [text(`ตัวอย่าง (ยังไม่บันทึก) — นิ้วที่เปลี่ยน: ${changed.join(', ') || 'ไม่มี'}`).content[0]!, image(document, hands)] }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('render_preview', {
    title: 'ภาพตัวอย่างงาน',
    description: 'ภาพ PNG ลายของงานเวอร์ชันล่าสุดแบบแบน (ปลายเล็บอยู่บน) — ใช้ตรวจผลหลังบันทึก',
    inputSchema: {
      projectId: z.string().uuid(),
      hands: z.enum(['right', 'left', 'both']).default('both'),
      nails: z.array(nailTarget).optional().describe('เฉพาะบางนิ้ว'),
    },
    annotations: { readOnlyHint: true },
  }, async ({ projectId, hands, nails }) => {
    try {
      const { version } = await api.getProject(projectId)
      return { content: [image(version.document, hands, nails ? expandTargets(nails) : undefined)] }
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('validate_document', {
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
      const saved = await updateDesign(project.id, (document) => buildFromRecipe(chosen, document).document)
      return text(`สร้างงาน ${project.id} แล้ว\n${saved}`)
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('apply_recipe', {
    title: 'ลงลายจาก recipe',
    description: `ลงลายบนงานจาก recipe ระดับสูง แล้วบันทึกเป็นเวอร์ชันใหม่ — นิ้วที่ระบุถูกแทนทั้งนิ้ว นิ้วที่ไม่ระบุคงของเดิม
คีย์ nails: ชื่อนิ้ว (thumb/index/middle/ring/little = ทั้งสองมือ, มือซ้าย mirror ให้) หรือคีย์เต็ม (right.index)`,
    inputSchema: { projectId: z.string().uuid(), recipe: recipeSchema },
  }, async ({ projectId, recipe }) => {
    try {
      return text(await updateDesign(projectId, (document) => buildFromRecipe(recipe, document).document))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('apply_preset', {
    title: 'ลงดีไซน์สำเร็จรูป',
    description: 'ลง preset ทั้งชุดบนงาน (ทุกนิ้วที่ preset กำหนด) แล้วบันทึกเป็นเวอร์ชันใหม่',
    inputSchema: { projectId: z.string().uuid(), preset: z.enum(Object.keys(PRESETS) as [string, ...string[]]) },
  }, async ({ projectId, preset }) => {
    try {
      return text(await updateDesign(projectId, (document) => buildFromRecipe(PRESETS[preset]!.recipe, document).document))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('set_nail', {
    title: 'แก้เล็บบางนิ้ว',
    description: 'แทนเล็บที่ระบุด้วย recipe ของนิ้วเดียว (ทรง สีพื้น ลาย ของตกแต่ง)',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      nail: nailRecipeSchema,
      mirrorLeft: z.boolean().default(true),
    },
  }, async ({ projectId, nails, nail, mirrorLeft }) => {
    try {
      const recipe = { mirrorLeft, nails: Object.fromEntries(nails.map((key) => [key, nail])) }
      return text(await updateDesign(projectId, (document) => buildFromRecipe(recipe, document).document))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('copy_nail', {
    title: 'คัดลอกลายเล็บ',
    description: 'คัดลอกเล็บนิ้วหนึ่งไปยังนิ้วอื่น (mirror = กลับซ้าย-ขวา)',
    inputSchema: {
      projectId: z.string().uuid(),
      from: z.enum(NAIL_KEYS as unknown as [NailKey, ...NailKey[]]),
      to: z.array(nailTarget).min(1),
      mirror: z.boolean().default(false),
    },
  }, async ({ projectId, from, to, mirror }) => {
    try {
      return text(await updateDesign(projectId, (document) => copyNail(document, from, expandTargets(to).filter((k) => k !== from), mirror)))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('mirror_hand', {
    title: 'ทำอีกมือให้สมมาตร',
    description: 'คัดลอกทั้งมือไปอีกข้างแบบกลับซ้าย-ขวา',
    inputSchema: { projectId: z.string().uuid(), from: z.enum(HANDS) },
  }, async ({ projectId, from }) => {
    try {
      return text(await updateDesign(projectId, (document) => mirrorHand(document, from)))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('add_strokes', {
    title: 'เพิ่ม stroke ดิบ (ขั้นสูง)',
    description: `ต่อ stroke ตาม schema ตรง ๆ บนเล็บที่ระบุ — ใช้เมื่อลายที่ต้องการไม่มีใน list_patterns
points: x = u, y = v (0 ปลายเล็บ → 1 โคนเล็บ), p = แรงกด; size = พิกเซลบน texture 1024 (รัศมี = size/2)`,
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      strokes: z.array(strokeSchema).min(1).max(500),
    },
  }, async ({ projectId, nails, strokes }) => {
    try {
      return text(await updateDesign(projectId, (document) =>
        expandTargets(nails).reduce((doc, key) => addStrokes(doc, key, strokes), document)))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('add_decoration', {
    title: 'วางของตกแต่ง',
    description: 'วางของตกแต่ง 3 มิติ (catalogId จาก list_decorations) บนเล็บที่ระบุ',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      decorations: z.array(decorationSpecSchema).min(1).max(30),
    },
  }, async ({ projectId, nails, decorations }) => {
    try {
      const unknown = decorations.map((d) => d.catalogId).filter((id) => !DECORATIONS.some((d) => d.id === id))
      if (unknown.length > 0) return errorResult(new Error(`ไม่รู้จัก catalogId: ${unknown.join(', ')} — ดู list_decorations`))
      return text(await updateDesign(projectId, (document) => expandTargets(nails).reduce((doc, key) => addDecorations(doc, key,
        decorations.map((d, i) => ({
          id: `ai-${d.catalogId}-${Date.now().toString(36)}-${i}`,
          catalogId: d.catalogId, u: d.u, v: d.v, rotation: d.rotation, scale: d.scale,
          ...(d.color === undefined ? {} : { color: d.color }),
        }))), document)))
    } catch (error) { return errorResult(error) }
  })

  server.registerTool('clear_nail', {
    title: 'ล้างลาย',
    description: 'ล้างลาย (และของตกแต่งถ้าไม่สั่ง keepDecorations) โดยคงทรง ความยาว ผิว สีพื้น',
    inputSchema: {
      projectId: z.string().uuid(),
      nails: z.array(nailTarget).min(1),
      keepDecorations: z.boolean().default(false),
    },
    annotations: { destructiveHint: true },
  }, async ({ projectId, nails, keepDecorations }) => {
    try {
      return text(await updateDesign(projectId, (document) =>
        expandTargets(nails).reduce((doc, key) => clearNail(doc, key, !keepDecorations), document)))
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
      text: `# NailStudio — คู่มือสำหรับ AI\n\n## กฎ\n${DESIGN_RULES}\n\n## ชนิดลาย\n${PATTERN_TYPES.map((p) => `- \`${p.type}\` — ${p.description}`).join('\n')}\n\n## ตัวอย่าง recipe\n\`\`\`json\n${JSON.stringify(PRESETS['lavender-butterfly']!.recipe, null, 2)}\n\`\`\``,
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
