import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 홈 화면 앱(PWA)에서 매번 디스코드 로그인을 하지 않는 근거가 이 설정이다 — 세션(리프레시 토큰)을
// localStorage에 두고, 만료 전에 알아서 갱신한다. 기본값과 같지만 의도를 드러내려고 명시한다.
// flowType은 기본(implicit)을 유지한다: PKCE는 로그인을 시작한 저장소에서만 코드를 교환할 수 있어,
// iOS 홈 화면 앱처럼 OAuth 창이 별도 브라우저로 열리면 교환이 실패한다
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

/** Supabase 쿼리에 타임아웃을 걸어주는 헬퍼. 기본 8초 */
export function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('요청 시간이 초과되었습니다. 다시 시도해주세요.')), ms),
    ),
  ])
}
