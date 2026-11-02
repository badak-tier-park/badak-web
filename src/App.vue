<template>
  <template v-if="route.name !== 'auth-callback'">
    <div class="orb orb-1"></div>
    <div class="orb orb-2"></div>
    <div class="orb orb-3"></div>
    <div v-if="route.name !== 'login'" class="grid-overlay"></div>
  </template>
  <RouterView />
  <PwaUpdatePrompt />
  <PwaInstallPrompt />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'
import PwaUpdatePrompt from '@/components/PwaUpdatePrompt.vue'
import PwaInstallPrompt from '@/components/PwaInstallPrompt.vue'

const route = useRoute()
const router = useRouter()

// 푸시 알림을 눌렀을 때 이미 열린 창이면 서비스워커(public/push-sw.js)가 이동할 경로만 보낸다
function onSwMessage(e: MessageEvent) {
  if (e.data?.type === 'push-navigate' && typeof e.data.path === 'string' && e.data.path.startsWith('/')) {
    router.push(e.data.path)
  }
}
onMounted(() => navigator.serviceWorker?.addEventListener('message', onSwMessage))
onBeforeUnmount(() => navigator.serviceWorker?.removeEventListener('message', onSwMessage))
</script>

<style lang="scss">
@use './App.scss';
</style>
