import { NailStudioApi } from './apiClient.ts'

/**
 * ค่าตั้งจาก environment
 *   NAIL_STUDIO_API_URL   ค่าเริ่มต้น http://localhost:4000/api/v1
 *   NAIL_STUDIO_WEB_URL   ค่าเริ่มต้น http://localhost:5173 (ใช้สร้างลิงก์ editor)
 *   NAIL_STUDIO_TOKEN     API token จากหน้าโปรไฟล์ (แนะนำ)
 *   NAIL_STUDIO_TOKEN_FILE  ไฟล์ที่เก็บ API token — อ่านใหม่ทุกครั้ง ไม่ต้องใส่ secret ใน config ของ AI client
 *   NAIL_STUDIO_EMAIL / NAIL_STUDIO_PASSWORD   ล็อกอินแบบเว็บ — สำหรับ dev บนเครื่องเท่านั้น
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env) {
  return {
    apiUrl: (env.NAIL_STUDIO_API_URL ?? 'http://localhost:4000/api/v1').replace(/\/$/, ''),
    webUrl: (env.NAIL_STUDIO_WEB_URL ?? 'http://localhost:5173').replace(/\/$/, ''),
    token: env.NAIL_STUDIO_TOKEN,
    tokenFile: env.NAIL_STUDIO_TOKEN_FILE,
    email: env.NAIL_STUDIO_EMAIL,
    password: env.NAIL_STUDIO_PASSWORD,
  }
}

export function apiFromEnv(env: NodeJS.ProcessEnv = process.env, token?: string): NailStudioApi {
  const config = loadConfig(env)
  return new NailStudioApi({
    baseUrl: config.apiUrl,
    token: token ?? config.token,
    tokenFile: token ? undefined : config.tokenFile,
    email: config.email,
    password: config.password,
  })
}
