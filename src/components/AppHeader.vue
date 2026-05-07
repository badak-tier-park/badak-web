<template>
  <header class="app-header">
    <!-- 좌: 브랜드 -->
    <RouterLink to="/" class="header-brand">
      <svg width="28" height="28" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="hIconGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
            <stop stop-color="#aa3bff"/>
            <stop offset="1" stop-color="#5865f2"/>
          </linearGradient>
        </defs>
        <rect width="44" height="44" rx="12" fill="url(#hIconGrad)"/>
        <rect x="0.5" y="0.5" width="43" height="43" rx="11.5" stroke="white" stroke-opacity="0.15"/>
        <path d="M22 9L31 25H13L22 9Z" fill="white" opacity="0.95"/>
        <path d="M22 18L27.5 27H16.5L22 18Z" fill="white" opacity="0.3"/>
        <rect x="11" y="30" width="22" height="2" rx="1" fill="white" opacity="0.4"/>
      </svg>
      <span class="brand-word"><span class="brand-em">바닥</span>티어</span>
    </RouterLink>

    <!-- 중: 네비게이션 (확장 가능) -->
    <nav class="header-nav">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="nav-link"
        active-class="nav-link--active"
      >
        {{ item.label }}
      </RouterLink>
    </nav>

    <!-- 우: 유저 + 액션 -->
    <div class="header-right">
      <!-- 유저 정보 -->
      <div v-if="auth.user" class="user-info">
        <img
          v-if="avatarUrl"
          :src="avatarUrl"
          :alt="displayName"
          class="user-avatar"
          referrerpolicy="no-referrer"
        />
        <div v-else class="user-avatar user-avatar--fallback">
          {{ displayName?.charAt(0) }}
        </div>
        <span class="user-name">{{ displayName }}</span>
      </div>

      <!-- 액션 버튼 슬롯 (페이지별로 다른 버튼 주입 가능) -->
      <slot name="actions" />

      <!-- 테마 토글 -->
      <button class="theme-toggle" :title="theme === 'dark' ? '라이트 모드' : '다크 모드'" @click="toggle">
        <!-- 다크 모드일 때: 태양 아이콘 -->
        <svg v-if="theme === 'dark'" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/>
          <path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3.1 3.1l1.06 1.06M11.84 11.84l1.06 1.06M3.1 12.9l1.06-1.06M11.84 4.16l1.06-1.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <!-- 라이트 모드일 때: 달 아이콘 -->
        <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13.5 10.5A6 6 0 015.5 2.5a6 6 0 108 8z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- 로그아웃 -->
      <button class="header-btn" @click="handleLogout">로그아웃</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'

const auth = useAuthStore()
const router = useRouter()
const { theme, toggle, init } = useTheme()

onMounted(init)

// 추후 네비게이션 항목 여기에 추가
const navItems: { to: string; label: string }[] = [
  // { to: '/maps', label: '맵 목록' },
  // { to: '/rankings', label: '랭킹' },
]

const avatarUrl = computed(() => auth.user?.user_metadata?.avatar_url as string | undefined)
const displayName = computed(() => auth.nickname ?? auth.user?.user_metadata?.full_name ?? auth.user?.email)

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<style lang="scss" scoped>
@use './AppHeader.scss';
</style>
