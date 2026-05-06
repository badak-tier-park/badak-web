import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const isAdmin = ref(false)
  const isRegistered = ref(false)

  async function fetchIsAdmin(discordId: string) {
    const { data } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .single()
    isRegistered.value = data !== null
    isAdmin.value = data?.is_admin === true
  }

  let _initPromise: Promise<void> | null = null

  function init(): Promise<void> {
    if (_initPromise) return _initPromise
    _initPromise = new Promise<void>((resolve) => {
      let resolved = false

      // 콜백을 async로 만들지 않음 — Supabase v2는 auth lock 안에서 콜백을 await하므로,
      // 콜백 안에서 supabase DB 쿼리를 await하면 getSession() → _acquireLock() 데드락 발생.
      // setTimeout(0)으로 DB 호출을 auth lock 컨텍스트 바깥으로 꺼낸다.
      supabase.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
        if (!user.value) { isAdmin.value = false; isRegistered.value = false }

        const discordId = user.value?.identities?.find(i => i.provider === 'discord')?.id ?? ''

        setTimeout(async () => {
          try {
            if (discordId) await fetchIsAdmin(discordId)
          } catch {}
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
      },
    })
  }

  async function logout() {
    await supabase.auth.signOut()
  }

  return { user, loading, isAdmin, isRegistered, init, loginWithDiscord, logout }
})
