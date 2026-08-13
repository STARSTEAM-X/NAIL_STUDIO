import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import {
  ARCHETYPES, DECORATIONS, DENSITIES, DocumentSchema, FINISHES,
  LENGTHS, NAIL_KEYS, PALETTES, RecipeSchema, SHAPES, ZONES,
} from './schema.ts'
import { PROMPTS } from './prompts.ts'

/**
 * Spike S5 — คุณภาพผลลัพธ์ของ LLM (ความเสี่ยง R-11)
 *
 * คำถามหลัก: สมมติฐานของ DECISION D-22 ถูกไหม —
 *   "Recipe 8 ฟิลด์ที่เป็น enum ทั้งหมด ได้อัตราผ่าน schema สูงกว่า DesignDocument เต็มรูป"
 *
 * เงื่อนไขที่ทดสอบ
 *   A · Recipe   + format:json     ← ข้อเสนอของ D-22
 *   B · Document + format:json     ← แนวทางของซอร์สเดิม
 *   C · Recipe   ไม่มี format:json ← ablation วัดว่า JSON mode ช่วยแค่ไหน
 *   D · Recipe   + format:json + โมเดลอื่น (qwen2.5:7b) ← ผลขึ้นกับโมเดลหรือ schema
 *
 * ทุกเงื่อนไขมีวงจร validate → repair สูงสุด 2 รอบ (A-17)
 */

const OLLAMA = 'http://localhost:11434/api/generate'
const THAI_MODEL = 'scb10x/llama3.1-typhoon2-8b-instruct:latest'
const ALT_MODEL = 'qwen2.5:7b'
const MAX_REPAIRS = 2

const RECIPE_SCHEMA_TEXT = `{
  "archetype": ${JSON.stringify(ARCHETYPES)},
  "paletteId": ${JSON.stringify(PALETTES)},
  "accentNails": "array (0-4) ของ ${JSON.stringify(NAIL_KEYS)}",
  "finish": ${JSON.stringify(FINISHES)},
  "shape": ${JSON.stringify(SHAPES)},
  "length": ${JSON.stringify(LENGTHS)},
  "decorations": "array (0-3) ของ { catalogId: ${JSON.stringify(DECORATIONS)}, zone: ${JSON.stringify(ZONES)}, density: ${JSON.stringify(DENSITIES)} }"
}`

const DOCUMENT_SCHEMA_TEXT = `{
  "hand": { "skinTone": "#rrggbb", "proportions": { "handScale": 0.8-1.2, "palmWidth": 0.7-1.3, "fingerLength": 0.7-1.3, "fingerWidth": 0.7-1.3 } },
  "nails": {
    "<ทั้ง 10 คีย์: ${NAIL_KEYS.join(', ')}>": {
      "shape": ${JSON.stringify(SHAPES)},
      "length": ${JSON.stringify(LENGTHS)},
      "finish": ${JSON.stringify(FINISHES)},
      "baseColor": "#rrggbb",
      "layers": [ { "name": "string", "visible": true, "opacity": 0-1, "strokes": [ { "kind": "brush", "color": "#rrggbb", "size": 1-200, "opacity": 0-1, "softness": 0-1, "points": [ { "x": 0-1, "y": 0-1, "p": 0-1 } ] } ] } ],
      "decorations": [ { "catalogId": ${JSON.stringify(DECORATIONS)}, "uv": { "u": 0-1, "v": 0-1 }, "rotation": number, "scale": 0.01-1 } ]
    }
  }
}`

function buildPrompt(schemaText: string, request: string, previousError?: string): string {
  const repair = previousError
    ? `\nJSON ที่ส่งมารอบก่อนไม่ผ่านการตรวจ ข้อผิดพลาด:\n${previousError}\nแก้ให้ถูกแล้วส่งใหม่\n`
    : ''
  return `คุณคือตัวสร้าง JSON สำหรับระบบออกแบบเล็บ 3 มิติ

กฎเด็ดขาด:
- ตอบเป็น JSON ที่ถูกต้องเท่านั้น ห้ามมีคำอธิบาย ห้ามมี markdown
- ใช้เฉพาะค่าที่อยู่ในรายการที่กำหนด ห้ามคิดค่าใหม่ขึ้นเอง
- ห้ามเพิ่มฟิลด์นอกเหนือจากที่ระบุ ห้ามตัดฟิลด์ที่จำเป็นออก
- ถ้าผู้ใช้ขอสิ่งที่ไม่มีในรายการ ให้เลือกตัวที่ใกล้เคียงที่สุดจากรายการ

SCHEMA:
${schemaText}
${repair}
คำขอของผู้ใช้:
${request}`
}

interface CallResult {
  raw: string
  latencyMs: number
  error?: string
}

async function callOllama(
  model: string, prompt: string, jsonMode: boolean, numPredict: number,
): Promise<CallResult> {
  const started = Date.now()
  try {
    const response = await fetch(OLLAMA, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        ...(jsonMode ? { format: 'json' } : {}),
        // เงื่อนไข B ต้องสร้าง 10 เล็บพร้อมเลเยอร์และเส้น — ถ้าจำกัด token เท่ากับ
        // Recipe จะถูกตัดกลางคันแล้วนับว่าพังทั้งที่เป็นข้อจำกัดที่เราตั้งเอง
        // จึงให้ budget ต่างกันตามขนาดผลลัพธ์ที่ schema เรียกร้องจริง
        options: { temperature: 0.2, num_predict: numPredict },
      }),
    })
    const data = (await response.json()) as { response?: string }
    return { raw: data.response ?? '', latencyMs: Date.now() - started }
  } catch (error) {
    return {
      raw: '',
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/** ลอกกรอบ markdown ออก — ซอร์สเดิมทำแค่ขั้นนี้แล้วยอมแพ้ */
function stripFences(text: string): string {
  return text.replace(/```json|```/g, '').trim()
}

type Outcome = 'ผ่านรอบแรก' | 'ผ่านหลังซ่อม' | 'JSON เสีย' | 'schema ไม่ผ่าน' | 'เรียกไม่สำเร็จ'

interface Attempt {
  promptId: string
  outcome: Outcome
  repairs: number
  totalLatencyMs: number
  parseOk: boolean
  schemaOk: boolean
  errorSample?: string
  outputBytes: number
}

async function runOne(
  model: string,
  jsonMode: boolean,
  schemaText: string,
  validator: z.ZodType,
  promptId: string,
  request: string,
  numPredict: number,
): Promise<Attempt> {
  let totalLatency = 0
  let lastError = ''
  let parseOk = false
  let bytes = 0

  for (let repairs = 0; repairs <= MAX_REPAIRS; repairs += 1) {
    const prompt = buildPrompt(schemaText, request, repairs > 0 ? lastError : undefined)
    const result = await callOllama(model, prompt, jsonMode, numPredict)
    totalLatency += result.latencyMs
    bytes = result.raw.length

    if (result.error !== undefined) {
      return {
        promptId, outcome: 'เรียกไม่สำเร็จ', repairs, totalLatencyMs: totalLatency,
        parseOk: false, schemaOk: false, errorSample: result.error, outputBytes: 0,
      }
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(stripFences(result.raw))
      parseOk = true
    } catch (error) {
      lastError = `JSON ไม่ถูกต้อง: ${error instanceof Error ? error.message : String(error)}`
      continue
    }

    const checked = validator.safeParse(parsed)
    if (checked.success) {
      return {
        promptId,
        outcome: repairs === 0 ? 'ผ่านรอบแรก' : 'ผ่านหลังซ่อม',
        repairs, totalLatencyMs: totalLatency, parseOk: true, schemaOk: true, outputBytes: bytes,
      }
    }
    lastError = checked.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n')
  }

  return {
    promptId,
    outcome: parseOk ? 'schema ไม่ผ่าน' : 'JSON เสีย',
    repairs: MAX_REPAIRS,
    totalLatencyMs: totalLatency,
    parseOk,
    schemaOk: false,
    errorSample: lastError.slice(0, 300),
    outputBytes: bytes,
  }
}

interface Condition {
  key: string
  label: string
  model: string
  jsonMode: boolean
  schemaText: string
  validator: z.ZodType
  numPredict: number
}

const CONDITIONS: Condition[] = [
  { key: 'A', label: 'Recipe + format:json (typhoon2)', model: THAI_MODEL, jsonMode: true, schemaText: RECIPE_SCHEMA_TEXT, validator: RecipeSchema, numPredict: 2048 },
  { key: 'B', label: 'Document เต็มรูป + format:json (typhoon2)', model: THAI_MODEL, jsonMode: true, schemaText: DOCUMENT_SCHEMA_TEXT, validator: DocumentSchema, numPredict: 16384 },
  { key: 'C', label: 'Recipe ไม่มี format:json (typhoon2)', model: THAI_MODEL, jsonMode: false, schemaText: RECIPE_SCHEMA_TEXT, validator: RecipeSchema, numPredict: 2048 },
  { key: 'D', label: 'Recipe + format:json (qwen2.5:7b)', model: ALT_MODEL, jsonMode: true, schemaText: RECIPE_SCHEMA_TEXT, validator: RecipeSchema, numPredict: 2048 },
]

function summarise(attempts: Attempt[]): Record<string, unknown> {
  const total = attempts.length
  const firstPass = attempts.filter((a) => a.outcome === 'ผ่านรอบแรก').length
  const afterRepair = attempts.filter((a) => a.outcome === 'ผ่านหลังซ่อม').length
  const latencies = attempts.map((a) => a.totalLatencyMs).sort((a, b) => a - b)
  return {
    ทั้งหมด: total,
    ผ่านรอบแรก: firstPass,
    ผ่านหลังซ่อม: afterRepair,
    ผ่านรวม: firstPass + afterRepair,
    'อัตราผ่านรอบแรก %': Number(((firstPass / total) * 100).toFixed(1)),
    'อัตราผ่านรวม %': Number((((firstPass + afterRepair) / total) * 100).toFixed(1)),
    JSON_เสีย: attempts.filter((a) => a.outcome === 'JSON เสีย').length,
    schema_ไม่ผ่าน: attempts.filter((a) => a.outcome === 'schema ไม่ผ่าน').length,
    เรียกไม่สำเร็จ: attempts.filter((a) => a.outcome === 'เรียกไม่สำเร็จ').length,
    ซ่อมเฉลี่ย: Number((attempts.reduce((s, a) => s + a.repairs, 0) / total).toFixed(2)),
    latency_p50_ms: latencies[Math.floor(total / 2)] ?? 0,
    latency_p95_ms: latencies[Math.min(total - 1, Math.floor(total * 0.95))] ?? 0,
    output_เฉลี่ย_bytes: Math.round(attempts.reduce((s, a) => s + a.outputBytes, 0) / total),
  }
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    วันที่: new Date().toISOString(),
    เงื่อนไข: {},
    รายละเอียด: {},
  }

  for (const condition of CONDITIONS) {
    console.log(`\n===== ${condition.key} · ${condition.label} =====`)
    const attempts: Attempt[] = []
    for (const prompt of PROMPTS) {
      const attempt = await runOne(
        condition.model, condition.jsonMode, condition.schemaText,
        condition.validator, prompt.id, prompt.text, condition.numPredict,
      )
      attempts.push(attempt)
      console.log(
        `  ${prompt.id}  ${attempt.outcome.padEnd(14)} ` +
        `ซ่อม=${attempt.repairs} ${attempt.totalLatencyMs}ms` +
        (attempt.errorSample ? `\n        ${attempt.errorSample.split('\n')[0]}` : ''),
      )
    }
    const summary = summarise(attempts)
    ;(report.เงื่อนไข as Record<string, unknown>)[`${condition.key} · ${condition.label}`] = summary
    ;(report.รายละเอียด as Record<string, unknown>)[condition.key] = attempts
    console.log(`  สรุป: ${JSON.stringify(summary)}`)
    writeFileSync(new URL('./result.json', import.meta.url), JSON.stringify(report, null, 2))
  }

  console.log('\n===== สรุปทั้งหมด =====')
  console.log(JSON.stringify(report.เงื่อนไข, null, 2))
}

await main()
