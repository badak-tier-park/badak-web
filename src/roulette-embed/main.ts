// 마블 룰렛 iframe 페이지(roulette.html)의 진입점 — 바닥티어 코드.
// 룰렛 엔진은 src/vendor/roulette(lazygyu/roulette, MIT)를 그대로 쓴다.
//
// 앱과는 postMessage로만 이야기한다. 같은 출처(origin)이고 부모 창이 보낸 메시지만 받는다.
//   앱 → 룰렛: init { names, winnerType, theme } / rule { winnerType } / start
//   룰렛 → 앱: loaded / ready / started / goal { winner } / error { message }
// 구슬 이름은 앱이 룰렛 이름 문법(/ * ,)과 겹치지 않게, 서로 다르게 만들어 보낸다(RouletteModal.vue)
//
// 원본은 화면 하나에 계속 떠 있는 앱이라 정리(requestAnimationFrame·창 이벤트·wasm 메모리)가 없다.
// iframe으로 띄우면 창을 닫을 때 iframe째 사라져 전부 정리된다 — 이 방식을 고른 이유
import { Roulette } from '../vendor/roulette/roulette';

type WinnerType = 'first' | 'last';
const PREFIX = 'badak-roulette:';

const stage = document.getElementById('stage') as HTMLElement;
const roulette = new Roulette(stage);

let winnerType: WinnerType = 'first';
let started = false;

function post(type: string, payload: Record<string, unknown> = {}) {
  window.parent.postMessage({ ...payload, type: PREFIX + type }, location.origin);
}

/** 첫 번째 도착 = 1등, 마지막 도착 = 꼴찌 (원본 화면의 winnerType first / last 와 같다) */
function applyWinnerType() {
  const count = roulette.getCount();
  const rank = winnerType === 'last' ? Math.max(0, count - 1) : 0;
  roulette.setWinnerRange(rank, rank);
}

/** 원본은 box2d(wasm)를 비동기로 읽는다. 준비되기 전 명령은 잠깐 기다렸다 실행 */
function whenReady(fn: () => void, waited = 0) {
  if (roulette.isReady) return fn();
  if (waited > 15000) return post('error', { message: '룰렛을 준비하지 못했습니다' });
  setTimeout(() => whenReady(fn, waited + 50), 50);
}

window.addEventListener('message', (e: MessageEvent) => {
  if (e.origin !== location.origin || e.source !== window.parent) return;
  const data = e.data as { type?: unknown; names?: unknown; winnerType?: unknown; theme?: unknown };
  if (typeof data?.type !== 'string' || !data.type.startsWith(PREFIX)) return;
  const kind = data.type.slice(PREFIX.length);

  if (kind === 'init') {
    const names = Array.isArray(data.names) ? data.names.filter((n): n is string => typeof n === 'string') : [];
    if (data.winnerType === 'first' || data.winnerType === 'last') winnerType = data.winnerType;
    whenReady(() => {
      if (data.theme === 'light' || data.theme === 'dark') roulette.setTheme(data.theme);
      roulette.setMarbles(names);
      started = false;
      applyWinnerType();
      post('ready', { count: roulette.getCount() });
    });
  } else if (kind === 'rule') {
    if (data.winnerType === 'first' || data.winnerType === 'last') winnerType = data.winnerType;
    if (!started) whenReady(applyWinnerType);
  } else if (kind === 'start') {
    whenReady(() => {
      if (started) return;
      started = true;
      applyWinnerType();
      roulette.start();
      post('started');
    });
  }
});

roulette.addEventListener('goal', (e: Event) => {
  const detail = (e as CustomEvent<{ winner: string }>).detail;
  post('goal', { winner: detail.winner });
});

// wasm을 못 읽는 등 원본 초기화가 실패하면 앱이 "직접 고르기"로 넘어갈 수 있게 알린다
window.addEventListener('unhandledrejection', (e) => {
  post('error', { message: String((e as PromiseRejectionEvent).reason ?? '룰렛 오류') });
});
window.addEventListener('error', (e) => {
  post('error', { message: e.message || '룰렛 오류' });
});

post('loaded');
