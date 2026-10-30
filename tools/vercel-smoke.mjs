/**
 * ตรวจว่า function ที่ bundle แล้ว (.vercel/output/functions/api.func) โหลดและตอบได้จริง
 * ใช้ค่า env จาก .env ของเครื่อง — รันหลัง `node tools/vercel-build.mjs`
 */
import { existsSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

process.loadEnvFile(path.resolve(import.meta.dirname, '../.env'))
process.env.NODE_ENV = 'production'

const entry = path.resolve(import.meta.dirname, '../.vercel/output/functions/api.func/index.mjs')
const { default: handler } = await import(pathToFileURL(entry).href)
const server = createServer(handler).listen(0)
await new Promise((resolve) => server.once('listening', resolve))
const base = `http://127.0.0.1:${server.address().port}/api/v1`

try {
  const health = await fetch(`${base}/health`)
  const body = await health.json()
  if (health.status !== 200 || body.success !== true) throw new Error(`health: ${health.status} ${JSON.stringify(body)}`)
  // เส้นทางที่ต้องใช้ DB + argon2 (native addon) — ต้องไม่ 500
  const login = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: `nscsrf=smoke`, 'x-csrf-token': 'smoke' },
    body: JSON.stringify({ email: 'nobody@example.test', password: 'wrong-password-123' }),
  })
  if (login.status >= 500) throw new Error(`login: ${login.status} ${await login.text()}`)
  console.log(`smoke ok — health 200, login ${login.status}`)
} finally {
  server.close()
}

// MCP (mcp.func) — โหลดได้, ไม่มี token ต้องได้ 401, native canvas + hand.glb อยู่ใน function
const mcpDir = path.resolve(import.meta.dirname, '../.vercel/output/functions/mcp.func')
const { default: mcpHandler } = await import(pathToFileURL(path.join(mcpDir, 'index.mjs')).href)
const mcpServer = createServer(mcpHandler).listen(0)
await new Promise((resolve) => mcpServer.once('listening', resolve))
const mcpBase = `http://127.0.0.1:${mcpServer.address().port}`

try {
  const health = await fetch(`${mcpBase}/health`)
  if (health.status !== 200) throw new Error(`mcp health: ${health.status}`)
  const unauthorized = await fetch(`${mcpBase}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
  })
  if (unauthorized.status !== 401) throw new Error(`mcp without token: ${unauthorized.status}`)
  createRequire(path.join(mcpDir, 'index.mjs'))('@napi-rs/canvas').createCanvas(1, 1)
  if (!existsSync(path.join(mcpDir, 'hand.glb'))) throw new Error('mcp.func ไม่มี hand.glb')
  console.log('smoke ok — mcp health 200, /mcp 401, canvas + hand.glb')
} finally {
  mcpServer.close()
}
process.exit(0)
