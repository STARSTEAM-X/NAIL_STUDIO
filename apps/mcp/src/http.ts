import { createMcpApp } from './httpApp.ts'

const port = Number(process.env.PORT ?? 4200)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT ต้องเป็นเลขพอร์ต 1–65535')

const httpServer = createMcpApp().listen(port, '0.0.0.0', () => {
  console.error(`nail-studio MCP (HTTP) ฟังที่พอร์ต ${port}`)
})

// Stop accepting new requests and let active requests finish before Render terminates the process.
process.once('SIGTERM', () => {
  httpServer.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10_000).unref()
})
