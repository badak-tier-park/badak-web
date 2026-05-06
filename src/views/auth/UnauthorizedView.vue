<template>
  <div class="unauthorized-page">
    <div class="grid-overlay"></div>

    <div class="unauthorized-card">
      <div class="card-glow"></div>

      <div class="brand">
        <div class="brand-icon">
          <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="iconGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                <stop stop-color="#aa3bff"/>
                <stop offset="1" stop-color="#5865f2"/>
              </linearGradient>
            </defs>
            <rect width="44" height="44" rx="12" fill="url(#iconGrad)"/>
            <rect x="0.5" y="0.5" width="43" height="43" rx="11.5" stroke="white" stroke-opacity="0.15"/>
            <path d="M22 9L31 25H13L22 9Z" fill="white" opacity="0.95"/>
            <path d="M22 18L27.5 27H16.5L22 18Z" fill="white" opacity="0.3"/>
            <rect x="11" y="30" width="22" height="2" rx="1" fill="white" opacity="0.4"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-name"><span class="brand-em">바닥</span>티어</span>
        </div>
      </div>

      <div class="divider"></div>

      <div class="card-content">
        <div class="lock-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6"/>
            <path d="M8 11V7a4 4 0 018 0v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="title">접근 불가</h1>
        <p class="desc">
          등록되지 않은 디스코드 계정입니다.<br>
          관리자에게 문의하세요.
        </p>
        <button class="logout-btn" @click="handleLogout">
          다른 계정으로 로그인
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<style lang="scss" scoped>
@use './UnauthorizedView.scss';
</style>
