import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// 최상위 shared/ 폴더 (팀 공용 데이터)
const sharedDir = fileURLToPath(new URL('../shared', import.meta.url))
const frontendDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    // import places from '@shared/places.json' 처럼 쓸 수 있게 해 줌
    alias: { '@shared': sharedDir },
  },
  build: {
    // three.js가 원래 커서 나오는 "500kB 넘음" 경고 기준을 올림 (배포에는 문제 없음)
    chunkSizeWarningLimit: 1600,
  },
  server: {
    // 개발 서버가 frontend 바깥(shared/) 파일도 읽을 수 있게 허용
    fs: { allow: [frontendDir, sharedDir] },
  },
})
