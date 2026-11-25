import { createApp } from './app.js'
import { attachRealtime } from './realtime.js'
import { createSupabaseFactory } from './supabase.js'

// 환경변수 (로컬은 server/.env, Render는 대시보드 Environment에 입력)
const supabase = createSupabaseFactory({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY,
})

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://aleph-capstone.vercel.app')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const port = Number(process.env.PORT) || 4000

const server = createApp({ supabase, allowedOrigins }).listen(port, () => {
  console.log(`[scenewalk-api] http://localhost:${port}  (허용 화면 주소: ${allowedOrigins.join(', ')})`)
})

// 멀티 접속: 같은 포트에서 WebSocket(/realtime)도 받음 (Render 무료 서비스는 포트 1개)
attachRealtime(server, { supabase, allowedOrigins })
