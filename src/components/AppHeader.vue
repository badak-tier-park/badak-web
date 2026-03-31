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

      <!-- 로그아웃 -->
      <button class="header-btn" @click="handleLogout">로그아웃</button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

// 추후 네비게이션 항목 여기에 추가
const navItems = [
  // { to: '/maps', label: '맵 목록' },
  // { to: '/rankings', label: '랭킹' },
]

const avatarUrl = computed(() => auth.user?.user_metadata?.avatar_url as string | undefined)
const displayName = computed(() =>
  (auth.user?.user_metadata?.full_name
  || auth.user?.user_metadata?.name
  || auth.user?.email) as string | undefined
)

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 28px;
  height: 60px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(10, 11, 16, 0.85);
  backdrop-filter: blur(16px);
  position: sticky;
  top: 0;
  z-index: 100;
}

/* 브랜드 */
.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  text-decoration: none;
  flex-shrink: 0;
}

.brand-word {
  font-size: 17px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.75);
  font-family: system-ui, sans-serif;
  letter-spacing: -0.01em;
}

.brand-em {
  background: linear-gradient(135deg, #c084fc, #aa3bff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 900;
}

/* 네비게이션 */
.header-nav {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 1;
}

.nav-link {
  padding: 6px 12px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.45);
  text-decoration: none;
  font-family: system-ui, sans-serif;
  transition: color 0.15s, background 0.15s;

  &:hover {
    color: rgba(255, 255, 255, 0.8);
    background: rgba(255, 255, 255, 0.06);
  }

  &--active {
    color: #c084fc;
    background: rgba(170, 59, 255, 0.1);
  }
}

/* 우측 영역 */
.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

/* 유저 정보 */
.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 4px 4px;
  border-radius: 100px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;

  &--fallback {
    background: linear-gradient(135deg, #aa3bff, #5865f2);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    font-family: system-ui, sans-serif;
  }
}

.user-name {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.75);
  font-family: system-ui, sans-serif;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 버튼 공통 */
.header-btn {
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.75);
  }
}
</style>
