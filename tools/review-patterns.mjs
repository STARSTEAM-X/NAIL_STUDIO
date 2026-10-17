import { resolve } from 'node:path'
import { createServer } from 'vite'

const server = await createServer({
  configFile: resolve('apps/web/vite.config.ts'),
  root: resolve('tools'),
  publicDir: resolve('apps/web/public'),
  server: { host: '127.0.0.1', port: 5175, strictPort: true },
})
await server.listen()
console.log('3D reference review: http://127.0.0.1:5175/pattern-review.html')
