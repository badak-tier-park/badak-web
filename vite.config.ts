import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    VitePWA({
      // 지목식·엔트리 입력 도중에 새 배포가 강제로 새로고침되면 입력이 날아간다.
      // 새 버전은 안내만 하고 사용자가 누를 때 갱신한다 (PwaUpdatePrompt.vue)
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '바닥티어',
        short_name: '바닥티어',
        description: '스타크래프트1 리마스터 바닥티어 커뮤니티',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0a0b10',
        theme_color: '#0a0b10',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 앱 껍데기(JS/CSS/HTML)만 캐시한다. Supabase 응답은 캐시하지 않는다 —
        // 리그·지목식 데이터가 오래된 값으로 보이면 판정이 틀어진다
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // 엑셀 내보내기(관리자 전용, 약 900KB)까지 설치 시 받게 하면 모바일 첫 설치가 무거워진다
        globIgnores: ['**/xlsx-*.js'],
        navigateFallback: '/index.html',
        // api/는 Vercel 서버리스 함수라 SPA 폴백으로 가로채면 안 된다
        navigateFallbackDenylist: [/^\/api\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
