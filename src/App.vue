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
import { consumePendingPushNavigation, isAppPath, PUSH_NAV_CHANNEL } from '@/lib/push'

const route = useRoute()
const router = useRouter()

// 푸시 알림을 눌렀을 때의 이동. 서비스워커(public/push-sw.js)가 열린 창에 메시지(postMessage +
// BroadcastChannel)를 보내고, 메시지가 유실되거나 앱이 새로 열린 경우를 위해 경로를 남겨 둔다 — 모두 받는다.
// 같은 이동이 여러 번 와도 router.push가 같은 주소는 무시한다
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

let pushNavChannel: BroadcastChannel | null = null

onMounted(() => {
  navigator.serviceWorker?.addEventListener('message', onSwMessage)
  if ('BroadcastChannel' in window) {
    pushNavChannel = new BroadcastChannel(PUSH_NAV_CHANNEL)
    pushNavChannel.addEventListener('message', onSwMessage)
  }
  document.addEventListener('visibilitychange', onVisible)
  // 앱이 화면에 떠 있는 채로 알림을 누르면 visibilitychange가 없다. 포커스가 돌아올 때도 확인한다
  window.addEventListener('focus', applyPendingPushNavigation)
  applyPendingPushNavigation()
})
onBeforeUnmount(() => {
  navigator.serviceWorker?.removeEventListener('message', onSwMessage)
  pushNavChannel?.close()
  document.removeEventListener('visibilitychange', onVisible)
  window.removeEventListener('focus', applyPendingPushNavigation)
})
</script>

<style lang="scss">
@use './App.scss';
</style>
