<template>
  <Teleport to="body">
    <div v-if="visible" class="pwa-install" role="dialog" aria-label="바닥티어 앱 설치 안내">
      <img src="/pwa-192x192.png" alt="" class="pwa-install-icon" />

      <div class="pwa-install-body">
        <p class="pwa-install-title">바닥티어를 앱처럼 쓰기</p>

        <p v-if="mode === 'android'" class="pwa-install-desc">
          홈 화면에 설치하면 주소창 없이 바로 열리고, 로그인도 유지됩니다.
        </p>

        <p v-else-if="mode === 'ios'" class="pwa-install-desc">
          <span class="pwa-install-share" aria-label="공유">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 10.5V1.5M8 1.5L4.5 5M8 1.5L11.5 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M3.5 7.5H2.75v7h10.5v-7H12.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            공유
          </span>
          버튼 → <b>홈 화면에 추가</b>를 누르세요.
        </p>

        <p v-else class="pwa-install-desc">
          이 화면(앱 내 브라우저)에서는 설치할 수 없습니다.
          메뉴에서 <b>{{ isIos ? 'Safari' : 'Chrome' }}로 열기</b>를 누른 뒤 설치하세요.
        </p>

        <div class="pwa-install-actions">
          <button v-if="mode === 'android'" class="btn-pill btn-pill--purple btn-pill--md btn-pill--filled" @click="install">
            설치
          </button>
          <button class="btn-pill btn-pill--ghost btn-pill--md" @click="dismiss">나중에</button>
        </div>
      </div>

      <button class="pwa-install-close" aria-label="닫기" @click="dismiss">×</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

// Chrome/삼성 인터넷 전용 이벤트라 lib.dom 타입에 없다
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// "나중에"를 누르면 이 기간 동안 다시 띄우지 않는다. 매번 뜨면 그냥 닫는 버튼이 된다
const DISMISS_KEY = 'badak-pwa-install-dismissed-at'
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000
// 화면에 들어오자마자 덮으면 내용을 보기도 전에 닫게 된다
const SHOW_DELAY_MS = 3000

const route = useRoute()

const ua = navigator.userAgent
// iPadOS는 데스크톱 Safari로 위장하므로 터치 지원 여부로 구분한다
const isIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
// 카카오톡·인스타그램 등 앱 내 브라우저는 홈 화면 추가 메뉴가 없다
const isInAppBrowser = /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps/i.test(ua)
const isMobile = window.matchMedia('(pointer: coarse)').matches && window.matchMedia('(max-width: 900px)').matches

const deferredPrompt = ref<BeforeInstallPromptEvent | null>(null)
const ready = ref(false)
const dismissed = ref(wasDismissedRecently())

const mode = computed<'android' | 'ios' | 'in-app' | null>(() => {
  if (isInAppBrowser) return 'in-app'
  // iOS는 설치 API가 없어 어떤 브라우저든 공유 메뉴로 안내한다
  if (isIos) return 'ios'
  if (deferredPrompt.value) return 'android'
  // 설치 이벤트를 지원하지 않는 브라우저(파이어폭스 등)는 안내할 방법이 마땅치 않아 띄우지 않는다
  return null
})

const visible = computed(() =>
  ready.value
  && !dismissed.value
  && isMobile
  && !isStandalone()
  && mode.value !== null
  && route.name !== 'auth-callback',
)

function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function wasDismissedRecently() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY))
    return at > 0 && Date.now() - at < DISMISS_MS
  } catch {
    return false
  }
}

function dismiss() {
  dismissed.value = true
  try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
}

async function install() {
  const e = deferredPrompt.value
  if (!e) return
  // prompt()는 이벤트당 한 번만 쓸 수 있다
  deferredPrompt.value = null
  await e.prompt()
  const { outcome } = await e.userChoice
  if (outcome === 'dismissed') dismiss()
}

function onBeforeInstallPrompt(e: Event) {
  // 브라우저 기본 미니 배너 대신 우리 안내에서 설치 버튼으로 띄운다
  e.preventDefault()
  deferredPrompt.value = e as BeforeInstallPromptEvent
}

function onInstalled() {
  deferredPrompt.value = null
  dismissed.value = true
}

let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.addEventListener('appinstalled', onInstalled)
  timer = setTimeout(() => { ready.value = true }, SHOW_DELAY_MS)
})

onBeforeUnmount(() => {
  window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  window.removeEventListener('appinstalled', onInstalled)
  if (timer) clearTimeout(timer)
})
</script>

<style lang="scss" scoped>
@use './PwaInstallPrompt.scss';
</style>
