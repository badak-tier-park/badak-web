// 웹 푸시 수신. vite.config.ts의 workbox.importScripts로 자동 생성된 서비스워커에 들어간다.
// 발송은 notifications insert → DB 트리거 → Edge Function send-push(badak-tier-park-api)

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

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const open = windows.find((w) => new URL(w.url).origin === url.origin)
    if (open) {
      // 열린 창은 주소를 바꾸지 않고 앱에 이동을 맡긴다(App.vue). navigate()는 페이지를 새로 불러
      // 지목식·엔트리 입력 중이던 내용이 날아간다
      await open.focus()
      open.postMessage({ type: 'push-navigate', path: url.pathname + url.search })
      return
    }
    await self.clients.openWindow(url.href)
  })())
})
