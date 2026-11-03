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
import { consumePendingPushNavigation, isAppPath } from '@/lib/push'

const route = useRoute()
const router = useRouter()

// 푸시 알림을 눌렀을 때의 이동. 서비스워커(public/push-sw.js)가 열린 창에 메시지를 보내고,
// 메시지가 유실되거나 앱이 새로 열린 경우를 위해 경로를 남겨 둔다 — 둘 다 받는다
function onSwMessage(e: MessageEvent) {
  if (e.data?.type === 'push-navigate' && isAppPath(e.data.path)) {
    consumePendingPushNavigation() // 같은 이동을 다시 하지 않게 남은 경로를 지운다
    router.push(e.data.path)
  }
}

async function applyPendingPushNavigation() {
  const path = await consumePendingPushNavigation()
  if (path) router.push(path)
}

function onVisible() {
  if (document.visibilityState === 'visible') applyPendingPushNavigation()
}

onMounted(() => {
  navigator.serviceWorker?.addEventListener('message', onSwMessage)
  document.addEventListener('visibilitychange', onVisible)
  applyPendingPushNavigation()
})
onBeforeUnmount(() => {
  navigator.serviceWorker?.removeEventListener('message', onSwMessage)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style lang="scss">
@use './App.scss';
</style>
