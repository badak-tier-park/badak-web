<template>
  <nav class="mobile-tabbar" :aria-label="label" :style="{ '--tabbar-cols': items.length }">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="mobile-tab"
      :class="{ active: item.key === active }"
      :aria-current="item.key === active ? 'page' : undefined"
      @click="emit('select', item.key)"
    >
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
        <template v-if="item.icon === 'trophy'">
          <path d="M6 3h10v5a5 5 0 01-10 0V3z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M6 5H3v1.5A3 3 0 006 9.5M16 5h3v1.5a3 3 0 01-3 3M11 13v3.5M7.5 19h7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </template>
        <template v-else-if="item.icon === 'ranking'">
          <rect x="3" y="12" width="4" height="7" rx="1" stroke="currentColor" stroke-width="1.6"/>
          <rect x="9" y="7" width="4" height="12" rx="1" stroke="currentColor" stroke-width="1.6"/>
          <rect x="15" y="3" width="4" height="16" rx="1" stroke="currentColor" stroke-width="1.6"/>
        </template>
        <template v-else-if="item.icon === 'person'">
          <circle cx="11" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.6"/>
          <path d="M3.5 19c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </template>
        <template v-else-if="item.icon === 'calendar'">
          <rect x="3" y="4" width="16" height="15" rx="2" stroke="currentColor" stroke-width="1.6"/>
          <path d="M3 9h16M8 2v4M14 2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </template>
        <template v-else-if="item.icon === 'home'">
          <path d="M3 10l8-6 8 6v8a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1v-8z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
        </template>
        <template v-else-if="item.icon === 'back'">
          <path d="M13 4l-7 7 7 7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M6.5 11H19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </template>
      </svg>
      <span>{{ item.label }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
// 휴대폰 하단 탭바 (640px 이하에서만 보인다). 사용법은 src/styles/_mobile-tabbar.scss 머리 주석.
// 탭 전환과 상위 화면 이동을 구분하지 않는다 — 누르면 select만 내보내고, 무엇을 할지는 화면이 정한다
export type MobileTabIcon = 'trophy' | 'ranking' | 'person' | 'calendar' | 'home' | 'back'
export interface MobileTabItem { key: string; label: string; icon: MobileTabIcon }

withDefaults(defineProps<{
  items: MobileTabItem[]
  active?: string
  label?: string
}>(), { label: '화면 메뉴' })

const emit = defineEmits<{ select: [key: string] }>()
</script>

<style lang="scss" scoped>
@use '../styles/mobile-tabbar' as tabbar;
@include tabbar.bar;
</style>
