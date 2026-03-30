<template>
  <div>로그인 처리 중...</div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()

onMounted(async () => {
  await supabase.auth.getSession()
  router.replace({ name: 'home' })
})
</script>
