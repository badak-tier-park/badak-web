<template>
  <div class="login">
    <h1>badak-web</h1>
    <button @click="auth.loginWithDiscord()">Discord로 로그인</button>
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<style scoped>
.login {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  gap: 1.5rem;
}
</style>
