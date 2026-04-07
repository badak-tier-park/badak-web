import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(true)
  const isAdmin = ref(false)

  async function fetchIsAdmin(discordId: string) {
    const { data } = await supabase
      .from('users')
      .select('is_admin')
      .eq('discord_id', discordId)
      .single()
    isAdmin.value = data?.is_admin === true
  }

  async function init() {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null

    if (user.value) {
      const discordId = user.value.identities?.find(i => i.provider === 'discord')?.id ?? ''
      if (discordId) await fetchIsAdmin(discordId)
    }

    loading.value = false

    supabase.auth.onAuthStateChange(async (_event, session) => {
      user.value = session?.user ?? null
      if (user.value) {
        const discordId = user.value.identities?.find(i => i.provider === 'discord')?.id ?? ''
        if (discordId) await fetchIsAdmin(discordId)
      } else {
        isAdmin.value = false
      }
    })
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

  return { user, loading, isAdmin, init, loginWithDiscord, logout }
})
