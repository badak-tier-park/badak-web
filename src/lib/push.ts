import { supabase } from './supabase'

// 웹 푸시 구독. 구독은 기기(브라우저)마다 따로라 휴대폰과 PC를 둘 다 쓰면 각각 켜야 한다.
// 발송은 서버가 한다: notifications insert → DB 트리거 → Edge Function send-push

export type PushState =
  | 'unsupported'   // 이 브라우저는 푸시 불가(또는 개발 서버라 서비스워커가 없음)
  | 'needs-install' // iOS: 홈 화면에 추가한 앱에서만 푸시가 된다
  | 'denied'        // 사용자가 알림 권한을 차단함 — 브라우저 설정에서만 되돌릴 수 있다
  | 'off'
  | 'on'

function isIos(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) return undefined
  return navigator.serviceWorker.getRegistration()
}

export async function getPushState(): Promise<PushState> {
  if (!('PushManager' in window) || !('Notification' in window)) {
    // iOS Safari 탭에는 PushManager 자체가 없다
    return isIos() && !isStandalone() ? 'needs-install' : 'unsupported'
  }
  const reg = await getRegistration()
  if (!reg) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const sub = await reg.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

function base64UrlToBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const bytes = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function saveSubscription(sub: PushSubscription) {
  const keys = sub.toJSON().keys ?? {}
  if (!keys.p256dh || !keys.auth) throw new Error('푸시 구독 정보가 올바르지 않습니다.')
  // 같은 기기에서 다른 계정으로 로그인하면 이 기기를 지금 계정으로 넘겨받는다(서버 함수가 처리)
  const { error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: sub.endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 200),
  })
  if (error) throw error
}

// 반드시 사용자의 탭/클릭 안에서 부른다 — iOS는 그 밖에서의 권한 요청을 무시한다
export async function enablePush(): Promise<PushState> {
  const reg = await getRegistration()
  if (!reg) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return getPushState()

  const { data: publicKey, error } = await supabase.rpc('get_vapid_public_key')
  if (error) throw error
  if (!publicKey) throw new Error('푸시 알림이 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.')

  const options = { userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) }
  let sub: PushSubscription
  try {
    sub = await reg.pushManager.subscribe(options)
  } catch {
    // 서버 키가 바뀌면 기존 구독과 키가 달라 subscribe가 실패한다 — 지우고 다시 구독
    await (await reg.pushManager.getSubscription())?.unsubscribe()
    sub = await reg.pushManager.subscribe(options)
  }
  await saveSubscription(sub)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const sub = await (await getRegistration())?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return getPushState()
}

// 앱을 열 때마다 이 기기의 구독을 서버에 다시 알린다. 서버에서 만료로 지워졌거나
// 다른 계정으로 로그인한 경우를 맞춘다
export async function syncPushSubscription(): Promise<void> {
  try {
    if ((await getPushState()) !== 'on') return
    const sub = await (await getRegistration())?.pushManager.getSubscription()
    if (sub) await saveSubscription(sub)
  } catch {}
}

// ── 알림을 눌렀을 때 이동 ────────────────────────────────
// 서비스워커(public/push-sw.js)가 남겨 둔 경로. 같은 값을 그쪽에도 쓴다
const PUSH_NAV_CACHE = 'push-nav'
const PUSH_NAV_KEY = '/__push-nav'
// 알림을 누르고 이보다 늦게 앱을 열면 그 알림 때문에 연 것이 아니라고 본다
const PUSH_NAV_TTL_MS = 2 * 60 * 1000

// 앱 안의 경로만 받는다('//host'는 다른 사이트로 해석될 수 있다)
export function isAppPath(path: unknown): path is string {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}

// 알림을 눌러 앱이 열리거나 다시 보일 때 부른다. 이동할 경로가 있으면 돌려주고 지운다
export async function consumePendingPushNavigation(): Promise<string | null> {
  if (!('caches' in window)) return null
  try {
    const cache = await caches.open(PUSH_NAV_CACHE)
    const res = await cache.match(PUSH_NAV_KEY)
    if (!res) return null
    await cache.delete(PUSH_NAV_KEY)
    const { path, at } = await res.json() as { path?: unknown; at?: number }
    if (!isAppPath(path) || !at || Date.now() - at > PUSH_NAV_TTL_MS) return null
    return path
  } catch {
    return null
  }
}

// 로그아웃 시: 이 기기로 더는 그 사용자의 푸시가 오지 않게 한다. 세션이 살아 있을 때 불러야 한다
export async function forgetPushSubscription(): Promise<void> {
  try {
    const sub = await (await getRegistration())?.pushManager.getSubscription()
    if (!sub) return
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  } catch {}
}
