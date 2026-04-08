<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 16 16"
    fill="none"
    v-bind="$attrs"
  >
    <!-- ── 내비게이션 ─────────────────────────────────────── -->
    <template v-if="name === 'chevron-left'">
      <path d="M10 3L5 8l5 5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <template v-else-if="name === 'chevron-right'">
      <path d="M6 3l5 5-5 5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- ── 액션 ───────────────────────────────────────────── -->
    <template v-else-if="name === 'close'">
      <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <template v-else-if="name === 'plus'">
      <path d="M8 2v12M2 8h12" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <template v-else-if="name === 'edit'">
      <path d="M10.5 2.5l3 3L4 15H1v-3L10.5 2.5z" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <template v-else-if="name === 'trash'">
      <path d="M2 5h12M5 5V3.5A1.5 1.5 0 016.5 2h3A1.5 1.5 0 0111 3.5V5M6 8v5M10 8v5M3 5l1 9.5A1 1 0 005 15.5h6a1 1 0 001-1L13 5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <template v-else-if="name === 'check'">
      <path d="M2 8.5L6 12.5L14 4" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <template v-else-if="name === 'refresh'">
      <path d="M2 8a6 6 0 1 1 6 6" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
      <path d="M2 5v3h3" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- ── 상태/정보 ──────────────────────────────────────── -->
    <template v-else-if="name === 'info'">
      <circle cx="8" cy="8" r="6" stroke="currentColor" :stroke-width="sw"/>
      <path d="M8 7v5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
      <circle cx="8" cy="5" r="0.8" fill="currentColor"/>
    </template>

    <template v-else-if="name === 'search'">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" :stroke-width="sw"/>
      <path d="M10.5 10.5l3 3" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <!-- ── 리그/게임 ──────────────────────────────────────── -->
    <template v-else-if="name === 'trophy'">
      <path d="M8 2l1.2 3.5H13l-3 2.2 1.1 3.5L8 9.2l-3.1 2 1.1-3.5-3-2.2h3.8L8 2z" stroke="currentColor" :stroke-width="sw" stroke-linejoin="round"/>
      <path d="M4.5 14h7M6 15.5h4" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <template v-else-if="name === 'star'">
      <path d="M8 1.5l1.5 4H14L10.5 8l1.3 4L8 9.8 4.2 12l1.3-4L2 5.5h4.5L8 1.5z" stroke="currentColor" :stroke-width="sw" stroke-linejoin="round"/>
    </template>

    <template v-else-if="name === 'calendar'">
      <rect x="1" y="2.5" width="14" height="12" rx="1.5" stroke="currentColor" :stroke-width="sw"/>
      <path d="M1 6.5h14M5 1v3M11 1v3" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <!-- ── 사람 ───────────────────────────────────────────── -->
    <template v-else-if="name === 'user'">
      <circle cx="8" cy="5.5" r="3" stroke="currentColor" :stroke-width="sw"/>
      <path d="M2 15c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <template v-else-if="name === 'users'">
      <circle cx="6" cy="5.5" r="2.5" stroke="currentColor" :stroke-width="sw"/>
      <path d="M1 14.5c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
      <circle cx="12" cy="5" r="2" stroke="currentColor" :stroke-width="sw"/>
      <path d="M14 10c1.2.6 2 1.9 2 3.5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
    </template>

    <!-- ── 설정 ───────────────────────────────────────────── -->
    <template v-else-if="name === 'gear'">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" :stroke-width="sw" fill="none"/>
      <path d="M6.2 1.5L5.5 3.5A5 5 0 0 0 4.2 4.3L2.2 3.8 1 6l1.5 1.3A5 5 0 0 0 2.3 8c0 .3 0 .6.1.9L1 10l1.2 2.2 2-.5a5 5 0 0 0 1.3.8l.7 2h3.7l.7-2a5 5 0 0 0 1.3-.8l2 .5L15 10l-1.5-1.2a5 5 0 0 0 .1-.9c0-.3 0-.6-.1-.8L15 6l-1.2-2.2-2 .5A5 5 0 0 0 10.5 3.5L9.8 1.5H6.2z" stroke="currentColor" :stroke-width="sw" stroke-linejoin="round" fill="none"/>
    </template>

    <!-- ── 맵/이미지 ──────────────────────────────────────── -->
    <template v-else-if="name === 'image'">
      <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" :stroke-width="sw"/>
      <path d="M1 11l4-4 3.5 3.5 2.5-3.5 4 4" stroke="currentColor" :stroke-width="sw" stroke-linejoin="round"/>
    </template>

    <!-- ── 차트/랭킹 ──────────────────────────────────────── -->
    <template v-else-if="name === 'chart'">
      <path d="M2 14V7M6 14V3M10 14V8M14 14V5" stroke="currentColor" :stroke-width="sw" stroke-linecap="round"/>
      <circle cx="15.5" cy="3" r="1.5" fill="currentColor"/>
    </template>

    <!-- ── 빌딩/팀 ─────────────────────────────────────────── -->
    <template v-else-if="name === 'building'">
      <path d="M2 14V4l6-3 6 3v10M2 14h12" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5.5 14v-4h5v4" stroke="currentColor" :stroke-width="sw" stroke-linecap="round" stroke-linejoin="round"/>
    </template>

    <!-- ── 로딩 스피너 ────────────────────────────────────── -->
    <template v-else-if="name === 'spinner'">
      <circle cx="8" cy="8" r="6" stroke="currentColor" :stroke-width="sw" stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/>
    </template>
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  name: string
  size?: number | string
  strokeWidth?: number
}>(), {
  size: 14,
  strokeWidth: 0,
})

// strokeWidth가 명시되지 않으면 size에 비례해 자동 계산
const sw = computed(() => props.strokeWidth || (Number(props.size) <= 12 ? 1.4 : 1.5))
</script>
