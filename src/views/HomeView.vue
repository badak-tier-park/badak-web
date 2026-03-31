<template>
  <div class="home">
    <AppHeader>
      <template #actions>
        <RouterLink to="/maps/register" class="header-btn header-btn--primary">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          맵 등록
        </RouterLink>
      </template>
    </AppHeader>

    <div class="home-content">
      <p class="welcome">준비 중인 콘텐츠입니다</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #0a0b10;
  display: flex;
  flex-direction: column;
}

.home-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome {
  font-size: 15px;
  color: rgba(255, 255, 255, 0.25);
  font-family: system-ui, sans-serif;
}

.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(170, 59, 255, 0.4);
  background: rgba(170, 59, 255, 0.12);
  color: #c084fc;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &--primary:hover {
    background: rgba(170, 59, 255, 0.22);
    border-color: rgba(170, 59, 255, 0.65);
    color: #d8a4ff;
  }
}
</style>
