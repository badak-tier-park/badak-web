<template>
  <Teleport to="body">
    <div v-if="needRefresh" class="pwa-update" role="status">
      <span class="pwa-update-text">새 버전이 있습니다</span>
      <button class="btn-pill btn-pill--purple btn-pill--md btn-pill--filled" @click="updateServiceWorker()">
        새로고침
      </button>
      <button class="pwa-update-close" aria-label="닫기" @click="needRefresh = false">×</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { useRegisterSW } from 'virtual:pwa-register/vue'

// 홈 화면 앱은 며칠씩 켜 둔 채로 쓰기 때문에, 열 때만 확인하면 새 배포를 한참 못 받는다
const UPDATE_CHECK_MS = 60 * 60 * 1000

const { needRefresh, updateServiceWorker } = useRegisterSW({
  onRegisteredSW(_url, registration) {
    if (!registration) return
    setInterval(() => {
      if (navigator.onLine) registration.update()
    }, UPDATE_CHECK_MS)
  },
})
</script>

<style lang="scss" scoped>
@use './PwaUpdatePrompt.scss';
</style>
