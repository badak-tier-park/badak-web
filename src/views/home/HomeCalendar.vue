<template>
  <section class="home-cal">
    <div class="home-cal-header">
      <h3 class="home-cal-title">일정</h3>
      <div class="home-cal-nav">
        <button class="cal-nav-btn" @click="prevMonth" aria-label="이전 달">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="cal-month-label">{{ viewYear }}.{{ String(viewMonth + 1).padStart(2, '0') }}</span>
        <button class="cal-nav-btn" @click="nextMonth" aria-label="다음 달">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M5 2L10 7L5 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="cal-state">불러오는 중...</div>
    <div v-else-if="loadError" class="cal-state cal-state--error">{{ loadError }}</div>

    <div v-else class="cal-body">
      <div class="cal-weekdays">
        <div v-for="(w, i) in weekdays" :key="w" class="cal-weekday" :class="{ 'sun': i === 0, 'sat': i === 6 }">
          {{ w }}
        </div>
      </div>
      <div class="cal-grid" :key="`${viewYear}-${viewMonth}`">
        <div
          v-for="cell in calendarCells"
          :key="cell.key"
          class="cal-cell"
          :class="{
            'out': !cell.inMonth,
            'today': cell.isToday,
            'sun': cell.dow === 0,
            'sat': cell.dow === 6,
            'has-events': cell.events.length > 0,
          }"
        >
          <span class="cal-day">{{ cell.day }}</span>
          <div class="cal-events">
            <div
              v-for="ev in cell.events.slice(0, 2)"
              :key="ev.id"
              class="cal-chip"
              :style="{
                background: EVENT_TYPE_META[ev.event_type].bg,
                color: EVENT_TYPE_META[ev.event_type].text,
                borderLeftColor: EVENT_TYPE_META[ev.event_type].color,
              }"
              @click="openDetail(ev)"
            >
              <span v-if="ev.event_time" class="cal-chip-time">{{ formatTime(ev.event_time) }}</span>
              <span class="cal-chip-title">{{ ev.title }}</span>
            </div>
            <div v-if="cell.events.length > 2" class="cal-more" @click="openMore(cell)">
              +{{ cell.events.length - 2 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="detailOpen" class="cal-modal-backdrop">
        <div class="cal-modal">
          <div class="cal-modal-header">
            <span class="cal-modal-title">{{ moreCell ? `${moreCell.key} 일정` : '일정 상세' }}</span>
            <button class="cal-modal-close" @click="closeDetail">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="cal-modal-body">
            <template v-if="moreCell">
              <div v-for="ev in moreCell.events" :key="ev.id" class="cal-detail-item" @click="openSingle(ev)">
                <span class="cal-detail-tag" :style="{ background: EVENT_TYPE_META[ev.event_type].color }">
                  {{ EVENT_TYPE_META[ev.event_type].label }}
                </span>
                <span v-if="ev.event_time" class="cal-detail-time">{{ formatTime(ev.event_time) }}</span>
                <span class="cal-detail-title">{{ ev.title }}</span>
              </div>
            </template>
            <template v-else-if="detailEvent">
              <div class="cal-detail-row">
                <span class="cal-detail-tag" :style="{ background: EVENT_TYPE_META[detailEvent.event_type].color }">
                  {{ EVENT_TYPE_META[detailEvent.event_type].label }}
                </span>
                <h4 class="cal-detail-heading">{{ detailEvent.title }}</h4>
              </div>
              <div class="cal-detail-meta">
                <span>{{ detailEvent.event_date }}</span>
                <span v-if="detailEvent.event_time">{{ formatTime(detailEvent.event_time) }}</span>
              </div>
              <p v-if="detailEvent.description" class="cal-detail-desc">{{ detailEvent.description }}</p>

              <div v-if="predLoading" class="pred-loading">예측 정보 불러오는 중...</div>
              <div v-else-if="predMatch" class="pred-section">
                <div class="pred-section-title">
                  <span>승부 예측</span>
                  <span v-if="predMatch.is_completed" class="pred-status pred-status--done">종료</span>
                  <span v-else-if="!predMatch.in_window" class="pred-status pred-status--closed">기간 외</span>
                  <span v-else-if="!predMatch.is_open" class="pred-status pred-status--closed">마감</span>
                  <span v-else class="pred-status pred-status--open">진행 중</span>
                  <span class="pred-points">내 포인트 {{ userPoints?.toLocaleString() ?? '-' }}pt</span>
                </div>

                <div class="pred-prob-bar">
                  <div class="pred-prob-a" :style="{ width: barPct('a') + '%' }">
                    <span v-if="predMatch.total_pot > 0">{{ (predMatch.prob_a * 100).toFixed(0) }}%</span>
                  </div>
                  <div class="pred-prob-b" :style="{ width: barPct('b') + '%' }">
                    <span v-if="predMatch.total_pot > 0">{{ (predMatch.prob_b * 100).toFixed(0) }}%</span>
                  </div>
                  <div v-if="predMatch.total_pot === 0" class="pred-prob-empty">아직 베팅 없음</div>
                </div>

                <div class="pred-teams">
                  <button
                    class="pred-team"
                    :class="predTeamClass('a')"
                    :disabled="!predMatch.is_open || predMatch.is_completed || !predMatch.in_window"
                    @click="openBet(predMatch.team_a_captain_id)"
                  >
                    <span v-if="strongerSide() === 'a'" class="pred-strength pred-strength--fav">강세</span>
                    <span v-else-if="strongerSide() === 'b'" class="pred-strength pred-strength--und">열세</span>
                    <span class="pred-name">{{ predMatch.team_a_name }}</span>
                    <span class="pred-mult">{{ formatMult(predMatch.multiplier_a) }}</span>
                  </button>
                  <div class="pred-vs">VS</div>
                  <button
                    class="pred-team"
                    :class="predTeamClass('b')"
                    :disabled="!predMatch.is_open || predMatch.is_completed || !predMatch.in_window"
                    @click="openBet(predMatch.team_b_captain_id)"
                  >
                    <span v-if="strongerSide() === 'b'" class="pred-strength pred-strength--fav">강세</span>
                    <span v-else-if="strongerSide() === 'a'" class="pred-strength pred-strength--und">열세</span>
                    <span class="pred-name">{{ predMatch.team_b_name }}</span>
                    <span class="pred-mult">{{ formatMult(predMatch.multiplier_b) }}</span>
                  </button>
                </div>

                <div class="pred-footer">
                  <span v-if="predMatch.is_completed && predMatch.user_prediction_captain_id !== null">
                    <span v-if="(predMatch.user_points_earned ?? 0) > 0" class="pred-result-win">
                      +{{ (predMatch.user_points_earned ?? 0).toLocaleString() }}pt ({{ formatMult(predMatch.user_final_multiplier ?? 0) }})
                    </span>
                    <span v-else class="pred-result-lose">예측 실패 (-{{ (predMatch.user_bet_amount ?? 0).toLocaleString() }}pt)</span>
                  </span>
                  <span v-else-if="predMatch.user_prediction_captain_id" class="pred-my-bet">
                    내 베팅 {{ (predMatch.user_bet_amount ?? 0).toLocaleString() }}pt · 마감 {{ formatDeadline(predMatch.deadline) }}
                  </span>
                  <span v-else-if="!predMatch.in_window" class="pred-deadline">현재 예측 기간이 아닙니다</span>
                  <span v-else-if="predMatch.is_open" class="pred-deadline">마감 {{ formatDeadline(predMatch.deadline) }}</span>
                  <span v-else class="pred-deadline">예측 마감</span>
                  <button
                    v-if="predMatch.user_prediction_captain_id && predMatch.is_open && !predMatch.is_completed"
                    class="pred-cancel"
                    @click="handleCancel"
                  >취소</button>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

    </Teleport>

    <BetModal
      :open="betModal.open"
      :team-name="betModal.teamName"
      :my-total="betModalMyTotal"
      :other-total="betModalOtherTotal"
      :available-balance="availableBalance"
      :initial-amount="betModalInitial"
      :saving="betModal.saving"
      :error="betModal.error"
      @close="closeBet"
      @confirm="confirmBet"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getCalendarItems, EVENT_TYPE_META, type CalendarItem } from '@/lib/events'
import {
  getMatchForPrediction,
  placePrediction,
  cancelPrediction,
  getUserPoints,
  type PredictableMatch,
} from '@/lib/predictions'
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId } from '@/lib/players'
import BetModal from '@/components/BetModal.vue'

const auth = useAuthStore()
const events = ref<CalendarItem[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myUserId = ref<number | null>(null)
const userPoints = ref<number | null>(null)

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

interface Cell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  dow: number
  events: CalendarItem[]
}

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarItem[]>()
  for (const ev of events.value) {
    const arr = map.get(ev.event_date) ?? []
    arr.push(ev)
    map.set(ev.event_date, arr)
  }
  return map
})

const calendarCells = computed((): Cell[] => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m, 1)
  const startDow = first.getDay()
  const todayKey = isoDate(today)

  const cells: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const offset = i - startDow
    const date = new Date(y, m, 1 + offset)
    const key = isoDate(date)
    cells.push({
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === m,
      isToday: key === todayKey,
      dow: date.getDay(),
      events: eventsByDate.value.get(key) ?? [],
    })
  }
  return cells
})

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

const detailOpen = ref(false)
const detailEvent = ref<CalendarItem | null>(null)
const moreCell = ref<Cell | null>(null)
const predMatch = ref<PredictableMatch | null>(null)
const predLoading = ref(false)

async function openDetail(ev: CalendarItem) {
  detailEvent.value = ev
  moreCell.value = null
  detailOpen.value = true
  predMatch.value = null
  if (ev.source === 'schedule' && ev.schedule_id && myUserId.value) {
    predLoading.value = true
    try {
      predMatch.value = await getMatchForPrediction(ev.schedule_id, myUserId.value)
    } finally {
      predLoading.value = false
    }
  }
}

async function openSingle(ev: CalendarItem) {
  await openDetail(ev)
}

function predTeamClass(side: 'a' | 'b') {
  if (!predMatch.value) return {}
  const captainId = side === 'a' ? predMatch.value.team_a_captain_id : predMatch.value.team_b_captain_id
  return {
    'pred-team--picked': predMatch.value.user_prediction_captain_id === captainId,
    'pred-team--winner': predMatch.value.is_completed && predMatch.value.winner_captain_id === captainId,
    'pred-team--loser': predMatch.value.is_completed && predMatch.value.winner_captain_id !== null && predMatch.value.winner_captain_id !== captainId,
  }
}

function strongerSide(): 'a' | 'b' | null {
  if (!predMatch.value || predMatch.value.total_pot === 0) return null
  if (Math.abs(predMatch.value.prob_a - predMatch.value.prob_b) < 0.05) return null
  return predMatch.value.prob_a > predMatch.value.prob_b ? 'a' : 'b'
}

function barPct(side: 'a' | 'b') {
  if (!predMatch.value || predMatch.value.total_pot === 0) return 50
  return side === 'a' ? predMatch.value.prob_a * 100 : predMatch.value.prob_b * 100
}

function formatMult(v: number | null | undefined) {
  if (!v || v <= 0) return '—'
  return `${v.toFixed(2)}x`
}

function formatDeadline(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── 베팅 모달 ─────────────────────────────────────────
const betModal = reactive({
  open: false,
  captainId: 0,
  teamName: '',
  side: 'a' as 'a' | 'b',
  saving: false,
  error: null as string | null,
})

const availableBalance = computed(() => {
  const owned = userPoints.value ?? 0
  const refundable = predMatch.value?.user_bet_amount ?? 0
  return owned + refundable
})

const betModalMyTotal = computed(() => {
  if (!predMatch.value) return 0
  const m = predMatch.value
  let myA = m.total_bet_a, myB = m.total_bet_b
  if (m.user_prediction_captain_id === m.team_a_captain_id) myA -= (m.user_bet_amount ?? 0)
  if (m.user_prediction_captain_id === m.team_b_captain_id) myB -= (m.user_bet_amount ?? 0)
  return betModal.side === 'a' ? myA : myB
})

const betModalOtherTotal = computed(() => {
  if (!predMatch.value) return 0
  const m = predMatch.value
  let myA = m.total_bet_a, myB = m.total_bet_b
  if (m.user_prediction_captain_id === m.team_a_captain_id) myA -= (m.user_bet_amount ?? 0)
  if (m.user_prediction_captain_id === m.team_b_captain_id) myB -= (m.user_bet_amount ?? 0)
  return betModal.side === 'a' ? myB : myA
})

const betModalInitial = computed(() => {
  const m = predMatch.value
  if (!m) return 100
  return m.user_bet_amount && m.user_prediction_captain_id === betModal.captainId ? m.user_bet_amount : 100
})

function openBet(captainId: number) {
  if (!predMatch.value || !predMatch.value.is_open || predMatch.value.is_completed || !predMatch.value.in_window) return
  betModal.captainId = captainId
  betModal.side = captainId === predMatch.value.team_a_captain_id ? 'a' : 'b'
  betModal.teamName = captainId === predMatch.value.team_a_captain_id ? predMatch.value.team_a_name : predMatch.value.team_b_name
  betModal.error = null
  betModal.open = true
}

function closeBet() {
  if (betModal.saving) return
  betModal.open = false
}

async function confirmBet(amount: number) {
  if (!predMatch.value || !myUserId.value) return
  betModal.saving = true
  betModal.error = null
  try {
    const res = await placePrediction(predMatch.value.schedule_id, myUserId.value, betModal.captainId, amount)
    userPoints.value = res.remaining_points
    predMatch.value = await getMatchForPrediction(predMatch.value.schedule_id, myUserId.value)
    betModal.open = false
  } catch (e: any) {
    betModal.error = e.message ?? '베팅 실패'
  } finally {
    betModal.saving = false
  }
}

async function handleCancel() {
  if (!predMatch.value || !myUserId.value) return
  if (!confirm('예측을 취소하시겠습니까? (베팅 포인트는 환불됩니다)')) return
  try {
    await cancelPrediction(predMatch.value.schedule_id, myUserId.value)
    predMatch.value = await getMatchForPrediction(predMatch.value.schedule_id, myUserId.value)
    userPoints.value = await getUserPoints(myUserId.value)
  } catch (e: any) {
    alert(e.message ?? '예측 취소 실패')
  }
}

function openMore(cell: Cell) {
  moreCell.value = cell
  detailEvent.value = null
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailEvent.value = null
  moreCell.value = null
  predMatch.value = null
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    if (discordId) {
      const me = await getPlayerByDiscordId(discordId)
      if (me) {
        myUserId.value = me.id
        userPoints.value = await getUserPoints(me.id)
      }
    }
    events.value = await getCalendarItems()
  } catch (e: any) {
    loadError.value = e.message ?? '일정을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './HomeCalendar.scss';
</style>
