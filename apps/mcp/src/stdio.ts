#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { apiFromEnv, loadConfig } from './config.ts'
import { createNailStudioServer } from './server.ts'

// stdio: AI client (Claude Desktop / Claude Code) เปิดโปรเซสนี้เองบนเครื่องผู้ใช้
// ห้ามพิมพ์อะไรลง stdout นอกจากข้อความ MCP — log ใช้ stderr เท่านั้น
const server = createNailStudioServer({ api: apiFromEnv(), webUrl: loadConfig().webUrl })
await server.connect(new StdioServerTransport())
console.error('nail-studio MCP (stdio) พร้อมใช้งาน')
