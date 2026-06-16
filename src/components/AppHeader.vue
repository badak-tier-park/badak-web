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

      <!-- 출석 -->
      <div v-if="auth.user && myUserId !== null" class="attendance-wrap">
        <button
          class="attendance-btn"
          :class="{ 'attendance-btn--done': attendanceStatus.attendedToday }"
          :disabled="attendanceStatus.attendedToday || checkingIn"
          :title="attendanceStatus.attendedToday ? `출석 완료 (${attendanceStatus.streak}일 연속)` : '오늘 출석하기'"
          @click="handleCheckIn"
        >
          <span class="attendance-fire">🔥</span>
          <span class="attendance-streak">{{ attendanceStatus.streak }}</span>
          <span class="attendance-label">{{ attendanceStatus.attendedToday ? '완료' : '출석' }}</span>
        </button>
      </div>

      <!-- 알림 -->
      <div v-if="auth.user && myUserId !== null" class="notif-wrap" ref="notifRef">
        <button class="notif-btn" :class="{ 'notif-btn--active': notifOpen }" @click="toggleNotif" title="알림">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2v1.2M4.5 14.5h9l-1.2-1.5V8.5a3.3 3.3 0 10-6.6 0V13l-1.2 1.5zM7 16a2 2 0 004 0" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span v-if="unreadCount > 0" class="notif-badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
        </button>
        <div v-if="notifOpen" class="notif-pop">
          <div class="notif-head">
            <span class="notif-title">알림</span>
            <button v-if="unreadCount > 0" class="notif-mark-all" @click="handleMarkAll">모두 읽음</button>
          </div>
          <div v-if="notifLoading" class="notif-state">불러오는 중...</div>
          <div v-else-if="!notifs.length" class="notif-state">알림이 없습니다.</div>
          <div v-else class="notif-list">
            <button
              v-for="n in notifs"
              :key="n.id"
              class="notif-item"
              :class="{ 'notif-item--unread': !n.is_read, [`notif-item--${n.type}`]: true }"
              @click="handleNotifClick(n)"
            >
              <span class="notif-item-title">{{ n.title }}</span>
              <span v-if="n.body" class="notif-item-body">{{ n.body }}</span>
              <span class="notif-item-time">{{ formatRelTime(n.created_at) }}</span>
            </button>
          </div>
        </div>
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

  <Teleport to="body">
    <div v-if="toast" class="attendance-toast">{{ toast }}</div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useTheme } from '@/composables/useTheme'
import { getPlayerByDiscordId } from '@/lib/players'
import {
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  type NotificationRow,
} from '@/lib/notifications'
import { getAttendanceStatus, checkIn, type AttendanceStatus } from '@/lib/attendance'
import { useToast } from '@/composables/useToast'

const auth = useAuthStore()
const router = useRouter()
const { theme, toggle, init } = useTheme()
const { toast, showToast } = useToast()

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

// ── 출석 ───────────────────────────────────────────────
const attendanceStatus = ref<AttendanceStatus>({ attendedToday: false, streak: 0 })
const checkingIn = ref(false)

async function loadAttendance(userId: number) {
  try {
    attendanceStatus.value = await getAttendanceStatus(userId)
  } catch {}
}

async function handleCheckIn() {
  if (myUserId.value === null || checkingIn.value) return
  checkingIn.value = true
  try {
    const result = await checkIn(myUserId.value)
    attendanceStatus.value = { attendedToday: true, streak: result.streak }
    if (result.isMilestone) {
      showToast(`🔥 ${result.streak}일 연속 출석! +${result.pointsEarned.toLocaleString()}pt (마일스톤 보너스 +${result.milestoneBonus.toLocaleString()}pt 포함)`)
    } else {
      showToast(`출석 완료! +${result.pointsEarned.toLocaleString()}pt (${result.streak}일 연속)`)
    }
  } catch (e: any) {
    showToast(e.message ?? '출석 처리 중 오류가 발생했습니다.')
  } finally {
    checkingIn.value = false
  }
}

// ── 알림 ───────────────────────────────────────────────
const myUserId = ref<number | null>(null)
const notifOpen = ref(false)
const notifLoading = ref(false)
const notifs = ref<NotificationRow[]>([])
const unreadCount = ref(0)
const notifRef = ref<HTMLElement | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

async function resolveMyUserId() {
  const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
  if (!discordId) return
  try {
    const me = await getPlayerByDiscordId(discordId)
    if (me) {
      myUserId.value = me.id
      loadAttendance(me.id)
    }
  } catch {}
}

async function refreshUnread() {
  if (myUserId.value === null) return
  try {
    unreadCount.value = await getUnreadCount(myUserId.value)
  } catch {}
}

async function loadNotifs() {
  if (myUserId.value === null) return
  notifLoading.value = true
  try {
    notifs.value = await getNotifications(myUserId.value, 20)
  } finally {
    notifLoading.value = false
  }
}

async function toggleNotif() {
  if (notifOpen.value) {
    notifOpen.value = false
    return
  }
  notifOpen.value = true
  await loadNotifs()
}

async function handleNotifClick(n: NotificationRow) {
  if (!n.is_read) {
    try {
      await markNotificationRead(n.id)
      n.is_read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch {}
  }
}

async function handleMarkAll() {
  if (myUserId.value === null) return
  await markAllRead(myUserId.value)
  notifs.value.forEach(n => { n.is_read = true })
  unreadCount.value = 0
}

function onDocClick(e: MouseEvent) {
  if (!notifOpen.value) return
  if (notifRef.value && !notifRef.value.contains(e.target as Node)) {
    notifOpen.value = false
  }
}

function formatRelTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금 전'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}일 전`
  const date = new Date(iso)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

onMounted(() => {
  init()
  resolveMyUserId().then(() => {
    refreshUnread()
    pollTimer = setInterval(refreshUnread, 30000)
  })
  document.addEventListener('click', onDocClick)
})

watch(() => auth.user?.id, () => { resolveMyUserId().then(refreshUnread) })

onBeforeUnmount(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('click', onDocClick)
})
</script>

<style lang="scss" scoped>
@use './AppHeader.scss';
</style>
