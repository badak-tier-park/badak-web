<template>
  <Teleport to="body">
    <div class="roulette-overlay">
      <div class="roulette-modal" role="dialog" aria-modal="true" :aria-label="title">
        <div class="roulette-header">
          <span class="roulette-title">{{ title }}</span>
          <button class="roulette-close" :disabled="busy" aria-label="닫기" @click="close">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <!-- 결과 규칙: 마지막 도착 / 첫 번째 도착 (원본 룰렛의 winnerType last / first) -->
        <div v-if="!manual" class="roulette-toolbar">
          <div class="roulette-rule" role="group" aria-label="결과 규칙">
            <button
              v-for="r in RULES"
              :key="r.value"
              type="button"
              class="roulette-rule-btn"
              :class="{ 'roulette-rule-btn--on': rule === r.value }"
              :disabled="phase !== 'ready' && phase !== 'loading'"
              :aria-pressed="rule === r.value"
              @click="setRule(r.value)"
            >{{ r.label }}</button>
          </div>
          <span class="roulette-count">후보 {{ candidates.length }}개</span>
        </div>

        <!-- 룰렛(같은 출처 iframe) -->
        <div v-if="!manual" class="roulette-stage">
          <iframe
            ref="frameEl"
            class="roulette-frame"
            src="/roulette.html"
            title="마블 룰렛"
          />
          <div v-if="phase === 'loading'" class="roulette-veil">룰렛 준비 중...</div>

          <!-- 결과 크게 → 2초 뒤 자동 저장 -->
          <div v-if="resultKey !== null" class="roulette-result">
            <span class="roulette-result-label">{{ ruleLabel }} 결과</span>
            <div class="roulette-result-value">
              <img v-if="resultItem?.thumb" :src="resultItem.thumb" alt="" class="roulette-result-thumb" />
              <span :class="resultItem?.tierClass ? `tier-badge--${resultItem.tierClass}` : ''" class="roulette-result-name">
                {{ resultItem?.label }}
              </span>
            </div>
            <span v-if="phase === 'result'" class="roulette-result-note">잠시 후 저장합니다</span>
            <span v-else-if="phase === 'saving'" class="roulette-result-note">저장 중...</span>
            <template v-else-if="phase === 'save-error'">
              <span class="roulette-error">저장하지 못했습니다: {{ errorMsg }}</span>
              <div class="roulette-result-actions">
                <button type="button" class="roulette-btn roulette-btn--primary" @click="saveResult">다시 시도</button>
                <button type="button" class="roulette-btn" @click="close">닫기</button>
              </div>
            </template>
          </div>
        </div>

        <!-- 비상용: 룰렛이 안 될 때 직접 고르기 -->
        <div v-else class="roulette-manual">
          <p v-if="manualReason" class="roulette-manual-reason">{{ manualReason }}</p>
          <div class="roulette-manual-list">
            <button
              v-for="c in candidates"
              :key="c.key"
              type="button"
              class="roulette-manual-item"
              :class="{ 'roulette-manual-item--on': manualKey === c.key }"
              @click="manualKey = c.key"
            >
              <img v-if="c.thumb" :src="c.thumb" alt="" class="roulette-manual-thumb" />
              <span :class="c.tierClass ? `tier-badge--${c.tierClass}` : ''" class="roulette-manual-name">{{ c.label }}</span>
            </button>
          </div>
          <p v-if="phase === 'save-error'" class="roulette-error">저장하지 못했습니다: {{ errorMsg }}</p>
        </div>

        <div class="roulette-footer">
          <template v-if="!manual">
            <button type="button" class="roulette-link" :disabled="busy" @click="openManual('')">직접 고르기</button>
            <span v-if="phase === 'error'" class="roulette-error">{{ errorMsg }}</span>
            <button
              type="button"
              class="roulette-btn roulette-btn--primary"
              :disabled="phase !== 'ready'"
              @click="start"
            >{{ phase === 'running' ? '진행 중...' : '시작' }}</button>
          </template>
          <template v-else>
            <button v-if="canUseRoulette" type="button" class="roulette-link" :disabled="busy" @click="backToRoulette">룰렛으로</button>
            <button type="button" class="roulette-btn" :disabled="busy" @click="pickRandom">랜덤</button>
            <button
              type="button"
              class="roulette-btn roulette-btn--primary"
              :disabled="manualKey === null || busy"
              @click="saveManual"
            >{{ phase === 'saving' ? '저장 중...' : '확정' }}</button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// 사다리타기 = 마블 룰렛(lazygyu/roulette, MIT — src/vendor/roulette). 같은 출처 페이지(roulette.html)를
// iframe으로 띄우고 postMessage로 후보를 보내 결과를 받는다. 결과는 2초 보여 준 뒤 save()로 바로 저장한다.
// 룰렛이 안 뜨거나(wasm 실패 등) 후보가 1개면 "직접 고르기"(예전 수동 선택)로 한다
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

export interface RouletteCandidate {
  /** 저장할 값(맵 id·티어 문자열) — 구슬 이름과 따로 둔다 */
  key: string
  /** 화면·구슬에 보일 이름 */
  label: string
  thumb?: string | null
  /** 티어 색(tierClass 결과) */
  tierClass?: string
}
export type RouletteRule = 'first' | 'last'

const props = defineProps<{
  title: string
  candidates: RouletteCandidate[]
  /** 기본 결과 규칙 — 창 안에서 매번 바꿀 수 있다(저장하지 않음) */
  defaultRule: RouletteRule
  /** 결과 저장. 실패하면 throw → 오류와 [다시 시도] */
  save: (key: string) => Promise<void>
}>()
const emit = defineEmits<{ close: []; saved: [key: string] }>()

const RULES: { value: RouletteRule; label: string }[] = [
  { value: 'last', label: '마지막 도착' },
  { value: 'first', label: '첫 번째 도착' },
]
const PREFIX = 'badak-roulette:'
const RESULT_HOLD_MS = 2000
const READY_TIMEOUT_MS = 15000

type Phase = 'loading' | 'ready' | 'running' | 'result' | 'saving' | 'save-error' | 'error'
const phase = ref<Phase>('loading')
const rule = ref<RouletteRule>(props.defaultRule)
const frameEl = ref<HTMLIFrameElement | null>(null)
const resultKey = ref<string | null>(null)
const errorMsg = ref('')
const canUseRoulette = computed(() => props.candidates.length > 1)
const manual = ref(!canUseRoulette.value)
const manualReason = ref(canUseRoulette.value ? '' : '후보가 하나뿐이라 룰렛 없이 정합니다')
const manualKey = ref<string | null>(props.candidates.length === 1 ? props.candidates[0].key : null)

const busy = computed(() => phase.value === 'running' || phase.value === 'result' || phase.value === 'saving')
const ruleLabel = computed(() => RULES.find(r => r.value === rule.value)?.label ?? '')
const resultItem = computed(() => props.candidates.find(c => c.key === resultKey.value) ?? null)

// 구슬 이름: 룰렛 이름 문법(이름/가중치, 이름*개수, 쉼표 구분)과 겹치는 글자를 바꾸고, 같은 이름은 번호를 붙여
// 서로 다르게 만든다. 결과는 이 이름 → 후보 순번으로 되돌려 원래 값(key)으로 저장한다
const marbleNames = computed(() => {
  const seen = new Map<string, number>()
  return props.candidates.map((c) => {
    const base = c.label.replace(/[/*,]/g, '·').trim() || '후보'
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base} (${n})`
  })
})

let readyTimer: number | null = null
let holdTimer: number | null = null

function post(type: string, payload: Record<string, unknown> = {}) {
  frameEl.value?.contentWindow?.postMessage({ ...payload, type: PREFIX + type }, location.origin)
}

function onMessage(e: MessageEvent) {
  // 같은 출처 + 우리 iframe이 보낸 것만
  if (e.origin !== location.origin || !frameEl.value || e.source !== frameEl.value.contentWindow) return
  const data = e.data as { type?: unknown; winner?: unknown; message?: unknown }
  if (typeof data?.type !== 'string' || !data.type.startsWith(PREFIX)) return
  const kind = data.type.slice(PREFIX.length)

  if (kind === 'loaded') {
    const theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
    post('init', { names: marbleNames.value, winnerType: rule.value, theme })
  } else if (kind === 'ready') {
    clearReadyTimer()
    if (phase.value === 'loading') phase.value = 'ready'
  } else if (kind === 'started') {
    phase.value = 'running'
  } else if (kind === 'goal') {
    const idx = marbleNames.value.indexOf(String(data.winner))
    if (idx < 0) {
      phase.value = 'error'
      errorMsg.value = '결과를 알아보지 못했습니다. 직접 골라 주세요'
      return
    }
    resultKey.value = props.candidates[idx].key
    phase.value = 'result'
    holdTimer = window.setTimeout(saveResult, RESULT_HOLD_MS)
  } else if (kind === 'error') {
    if (phase.value === 'loading' || phase.value === 'ready') {
      clearReadyTimer()
      openManual('룰렛을 띄우지 못했습니다. 직접 골라 주세요')
    }
  }
}

function clearReadyTimer() {
  if (readyTimer !== null) { window.clearTimeout(readyTimer); readyTimer = null }
}

function setRule(r: RouletteRule) {
  rule.value = r
  post('rule', { winnerType: r })
}

function start() {
  if (phase.value !== 'ready') return
  post('start', { winnerType: rule.value })
  phase.value = 'running'
}

async function saveResult() {
  holdTimer = null
  if (resultKey.value === null) return
  await doSave(resultKey.value)
}

async function doSave(key: string) {
  phase.value = 'saving'
  errorMsg.value = ''
  try {
    await props.save(key)
    emit('saved', key)
    emit('close')
  } catch (e: any) {
    errorMsg.value = e?.message ?? '알 수 없는 오류'
    phase.value = 'save-error'
  }
}

function openManual(reason: string) {
  manualReason.value = reason
  manual.value = true
  if (phase.value !== 'save-error') phase.value = 'ready'
}

function backToRoulette() {
  manual.value = false
  manualReason.value = ''
  // iframe을 다시 만든다(이전 판 상태를 버리고 처음부터)
  phase.value = 'loading'
  resultKey.value = null
  armReadyTimer()
}

function pickRandom() {
  const list = props.candidates
  if (!list.length) return
  manualKey.value = list[Math.floor(Math.random() * list.length)].key
}

function saveManual() {
  if (manualKey.value !== null) doSave(manualKey.value)
}

function close() {
  if (busy.value) return
  emit('close')
}

function armReadyTimer() {
  clearReadyTimer()
  readyTimer = window.setTimeout(() => {
    if (phase.value === 'loading') openManual('룰렛이 응답하지 않습니다. 직접 골라 주세요')
  }, READY_TIMEOUT_MS)
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  if (!manual.value) armReadyTimer()
})
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  clearReadyTimer()
  if (holdTimer !== null) window.clearTimeout(holdTimer)
})
</script>

<style lang="scss" scoped>
@use './RouletteModal.scss';
</style>
