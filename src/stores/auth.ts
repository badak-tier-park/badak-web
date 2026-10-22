import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

// 마지막으로 확인한 등록/관리자 여부. 홈 화면 앱을 불안정한 모바일 망에서 열 때
// users 조회가 실패하면 미등록으로 판정돼 '접근 불가'로 튕겼다 — 로그아웃된 것처럼 보이는 원인.
// 조회 실패 시에만 이 값으로 대신한다. 실제 권한은 RLS가 막으므로 화면 표시용으로만 쓴다
const PROFILE_CACHE_KEY = 'badak-profile'

interface CachedProfile {
  discordId: string
  isAdmin: boolean
  nickname: string | null
}

function readCachedProfile(discordId: string): CachedProfile | null {
  try {
    const cached = JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) ?? 'null') as CachedProfile | null
    return cached?.discordId === discordId ? cached : null
  } catch {
    return null
  }
}

function writeCachedProfile(profile: CachedProfile | null) {
  try {
    if (profile) localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile))
    else localStorage.removeItem(PROFILE_CACHE_KEY)
  } catch {}
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const isAdmin = ref(false)
  const isRegistered = ref(false)
  const nickname = ref<string | null>(null)

  function applyProfile(profile: CachedProfile | null) {
    isRegistered.value = profile !== null
    isAdmin.value = profile?.isAdmin === true
    nickname.value = profile?.nickname ?? null
  }

  async function fetchIsAdmin(discordId: string) {
    // .single()은 행이 없을 때도 error를 내서 "미등록"과 "네트워크 실패"를 구분할 수 없다
    const { data, error } = await supabase
      .from('users')
      .select('is_admin, nickname')
      .eq('discord_id', discordId)
      .maybeSingle()

    if (error) {
      // 일시적 실패 — 이미 판정된 상태가 있으면 유지하고, 없으면 마지막 확인값을 쓴다
      if (!isRegistered.value) applyProfile(readCachedProfile(discordId))
      return
    }

    const profile = data
      ? { discordId, isAdmin: data.is_admin === true, nickname: data.nickname ?? null }
      : null
    applyProfile(profile)
    writeCachedProfile(profile)
  }

  let _initPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (_initPromise) return _initPromise
    _initPromise = new Promise<void>((resolve) => {
      let resolved = false

      // 콜백을 async로 만들지 않음 — Supabase v2는 auth lock 안에서 콜백을 await하므로,
      // 콜백 안에서 supabase DB 쿼리를 await하면 getSession() → _acquireLock() 데드락 발생.
      // setTimeout(0)으로 DB 호출을 auth lock 컨텍스트 바깥으로 꺼낸다.
      supabase.auth.onAuthStateChange((event, session) => {
        user.value = session?.user ?? null
        if (!user.value) { applyProfile(null) }

        const discordId = user.value?.identities?.find(i => i.provider === 'discord')?.id ?? ''

        // 토큰 갱신(약 1시간마다, 앱이 다시 보일 때마다)은 같은 사용자라 다시 조회할 필요가 없다
        if (event === 'TOKEN_REFRESHED' && isRegistered.value) return

        setTimeout(async () => {
          try {
            if (discordId) await fetchIsAdmin(discordId)
          } catch {
            if (discordId && !isRegistered.value) applyProfile(readCachedProfile(discordId))
          }
          if (!resolved) {
            resolved = true
            loading.value = false
            resolve()
          }
        }, 0)
      })
    })
    return _initPromise
  }

  async function loginWithDiscord() {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // 이미 승인한 사용자는 디스코드 동의 화면을 건너뛰고 바로 돌아온다.
        // 세션이 만료돼 다시 로그인해야 할 때도 버튼 한 번으로 끝나게 하기 위함
        queryParams: { prompt: 'none' },
      },
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    writeCachedProfile(null)
  }

  return { user, loading, isAdmin, isRegistered, nickname, init, loginWithDiscord, logout }
})
