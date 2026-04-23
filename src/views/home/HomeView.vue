<template>
  <div class="home">
    <AppHeader />

    <div class="dashboard">

      <!-- ── 히어로 ────────────────────────────────────────────── -->
      <div class="dash-hero">
        <h1 class="dash-hero-title"><span class="dash-hero-em">바닥</span>티어</h1>
        <p class="dash-hero-sub">스타크래프트1 리마스터 · 바닥티어 관리 시스템</p>
      </div>

      <!-- ── 네비게이션 카드 그리드 ─────────────────────────── -->
      <div class="nav-grid">

        <template v-if="auth.isAdmin">
          <RouterLink to="/maps" class="nav-card nav-card--admin">
            <div class="nav-card-icon nav-card-icon--purple">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect x="2" y="2" width="16" height="16" rx="2.5" stroke="currentColor" stroke-width="1.4"/>
                <path d="M2 13l4.5-4.5 3.5 3.5 3-4 5 5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="nav-card-body">
              <p class="nav-card-title">맵 관리</p>
              <p class="nav-card-desc">맵 목록 확인 · 등록 · 수정</p>
            </div>
            <svg class="nav-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </RouterLink>

          <RouterLink to="/players" class="nav-card nav-card--admin">
            <div class="nav-card-icon nav-card-icon--blue">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.5"/>
                <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="nav-card-body">
              <p class="nav-card-title">선수 관리</p>
              <p class="nav-card-desc">닉네임 · 종족 · 티어 변경</p>
            </div>
            <svg class="nav-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </RouterLink>

          <div class="nav-card nav-card--admin nav-card--disabled">
            <div class="nav-card-icon nav-card-icon--red">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M3 5h14M5 5V3.5A1.5 1.5 0 016.5 2h7A1.5 1.5 0 0115 3.5V5M8 9v6M12 9v6M4 5l1 12.5A1 1 0 006 18.5h8a1 1 0 001-.5L16 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="nav-card-body">
              <p class="nav-card-title">경기 관리</p>
              <p class="nav-card-desc">중복 경기 정리 · 기록 삭제</p>
            </div>
            <span class="badge-soon">준비 중</span>
          </div>

          <RouterLink to="/leagues" class="nav-card nav-card--admin">
            <div class="nav-card-icon nav-card-icon--purple">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M10 2l1.5 4.5H16l-3.7 2.7 1.4 4.3L10 11l-3.7 2.5 1.4-4.3L4 6.5h4.5L10 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
                <path d="M5 16h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <path d="M7 18h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="nav-card-body">
              <p class="nav-card-title">리그 관리</p>
              <p class="nav-card-desc">리그 생성 · 조 편성 · 일정 관리</p>
            </div>
            <svg class="nav-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </RouterLink>
        </template>

        <RouterLink to="/participate" class="nav-card">
          <div class="nav-card-icon nav-card-icon--green">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2l1.5 4.5H16l-3.7 2.7 1.4 4.3L10 11l-3.7 2.5 1.4-4.3L4 6.5h4.5L10 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              <path d="M5 16h10" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M7 18h6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">리그 참여</p>
            <p class="nav-card-desc">진행 중인 리그 · 일정 확인</p>
          </div>
          <svg class="nav-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </RouterLink>

        <RouterLink to="/dashboard" class="nav-card">
          <div class="nav-card-icon nav-card-icon--blue">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 16V8M7 16V4M11 16V10M15 16V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="17.5" cy="3.5" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">대시보드</p>
            <p class="nav-card-desc">전적 통계 · 승률 · 매치업</p>
          </div>
          <svg class="nav-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </RouterLink>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
</script>

<style lang="scss" scoped>
@use './HomeView.scss';
</style>
