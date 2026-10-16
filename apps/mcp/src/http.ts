import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { API_TOKEN_PREFIX } from '@nail-studio/contracts'
import { apiFromEnv, loadConfig } from './config.ts'
import { createNailStudioServer } from './server.ts'

/**
 * MCP แบบ Streamable HTTP — สำหรับ AI client ที่ต่อผ่านเครือข่าย (ไม่ได้รันบนเครื่องผู้ใช้)
 *
 * ทำงานแบบ stateless: ทุกคำขอสร้าง server ใหม่ที่ผูกกับ API token ของผู้เรียก
 * ผู้เรียกต้องส่ง `Authorization: Bearer nsk_...` (สร้างจากหน้าโปรไฟล์) — MCP ส่ง token นี้
 * ต่อให้ API ตรง ๆ และไม่เก็บไว้ที่ไหน สิทธิ์จึงเท่ากับ token ของผู้ใช้คนนั้นพอดี
 * (MCP server เองไม่มีสิทธิ์อะไรเลย ถ้าไม่มี token ก็ทำอะไรไม่ได้)
 *
 *   PORT (ค่าเริ่มต้น 4200), NAIL_STUDIO_API_URL, NAIL_STUDIO_WEB_URL
 *   ตอน production ต้องอยู่หลัง HTTPS reverse proxy เสมอ — token วิ่งใน header
 */

const MAX_BODY_BYTES = 6 * 1024 * 1024
const config = loadConfig()

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    request.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new Error('body ใหญ่เกินไป'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })
    request.on('end', () => {
      try {
        resolve(chunks.length === 0 ? undefined : JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch (error) {
        reject(error)
      }
    })
    request.on('error', reject)
  })
}

function jsonError(response: ServerResponse, status: number, message: string): void {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32000, message }, id: null }))
}

const httpServer = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  if (url.pathname === '/health') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}')
    return
  }
  if (url.pathname !== '/mcp') {
    jsonError(response, 404, 'ไม่พบ — ใช้ POST /mcp')
    return
  }
  if (request.method !== 'POST') {
    // stateless: ไม่มี session ให้เปิดสตรีม GET หรือปิดด้วย DELETE
    jsonError(response, 405, 'รองรับเฉพาะ POST (stateless)')
    return
  }

  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '')?.[1]
  if (!token || !token.startsWith(API_TOKEN_PREFIX)) {
    response.setHeader('WWW-Authenticate', 'Bearer')
    jsonError(response, 401, 'ต้องส่ง Authorization: Bearer <API token จากหน้าโปรไฟล์ NailStudio>')
    return
  }

  try {
    const body = await readBody(request)
    const server = createNailStudioServer({ api: apiFromEnv(process.env, token), webUrl: config.webUrl })
    // ไม่ใส่ sessionIdGenerator = โหมด stateless (SDK อ่านค่าที่ขาดเป็น undefined)
    const transport = new StreamableHTTPServerTransport({})
    response.on('close', () => {
      void transport.close()
      void server.close()
    })
    // type ของ SDK ไม่ได้ประกาศรองรับ exactOptionalPropertyTypes ที่ repo นี้เปิดไว้
    await server.connect(transport as unknown as Transport)
    await transport.handleRequest(request, response, body)
  } catch (error) {
    if (!response.headersSent) jsonError(response, 400, error instanceof Error ? error.message : 'คำขอไม่ถูกต้อง')
  }
})

const port = Number(process.env.PORT ?? 4200)
httpServer.listen(port, () => {
  console.error(`nail-studio MCP (HTTP) ฟังที่ http://localhost:${port}/mcp → API ${config.apiUrl}`)
})
