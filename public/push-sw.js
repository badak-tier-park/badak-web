// 웹 푸시 수신. vite.config.ts의 workbox.importScripts로 자동 생성된 서비스워커에 들어간다.
// 발송은 notifications insert → DB 트리거 → Edge Function send-push(badak-tier-park-api)

// 알림을 눌렀을 때 이동할 경로를 앱이 읽어 가도록 남겨 두는 곳(src/lib/push.ts와 같은 값)
const PUSH_NAV_CACHE = 'push-nav'
const PUSH_NAV_KEY = '/__push-nav'

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || '바닥티어', {
      body: data.body || '',
      icon: '/pwa-192x192.png',
      tag: data.tag,
      data: { url: data.url || '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin)
  const path = url.pathname + url.search

  event.waitUntil((async () => {
    // 메시지만으로는 이동이 안 될 때가 있다 — iOS는 백그라운드에서 깨어나는 앱에 보낸 메시지가
    // 유실되고, 앱이 꺼져 있으면 openWindow가 주소를 무시하고 첫 화면을 연다. 그래서 경로를 남겨 두고
    // 앱이 열리거나 다시 보일 때 직접 읽어 가게 한다(src/lib/push.ts consumePendingPushNavigation)
    try {
      const cache = await caches.open(PUSH_NAV_CACHE)
      await cache.put(PUSH_NAV_KEY, new Response(JSON.stringify({ path, at: Date.now() })))
    } catch {}

    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find((w) => new URL(w.url).origin === url.origin)
    if (open) {
      // 열린 창은 주소를 바꾸지 않고 앱에 이동을 맡긴다(App.vue). navigate()는 페이지를 새로 불러
      // 지목식·엔트리 입력 중이던 내용이 날아간다. focus()가 실패해도 메시지는 보내야 해서 순서를 이렇게 둔다
      open.postMessage({ type: 'push-navigate', path })
      try { await open.focus() } catch {}
      return
    }
    await self.clients.openWindow(url.href)
  })())
})
