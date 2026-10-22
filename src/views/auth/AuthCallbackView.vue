<template>
  <div class="callback-page">
    <template v-if="errorMsg">
      <p class="callback-title">로그인하지 못했습니다</p>
      <p class="callback-desc">{{ errorMsg }}</p>
      <button class="btn-save" @click="router.replace({ name: 'login' })">다시 로그인</button>
    </template>
    <template v-else>
      <span class="callback-spinner" aria-hidden="true"></span>
      <p class="callback-desc">로그인 처리 중...</p>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '@/lib/supabase'

const router = useRouter()
const errorMsg = ref('')

onMounted(async () => {
  // 디스코드에서 취소하거나 승인이 거부되면 토큰 대신 error가 붙어 돌아온다.
  // 그냥 홈으로 보내면 라우터가 로그인 화면으로 되돌려 아무 일도 없었던 것처럼 보인다
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  if (params.get('error')) {
    errorMsg.value = params.get('error_description') ?? '디스코드 인증이 취소되었습니다.'
    return
  }
  await supabase.auth.getSession()
  router.replace({ name: 'home' })
})
</script>

<style lang="scss" scoped>
@use './AuthCallbackView.scss';
</style>
