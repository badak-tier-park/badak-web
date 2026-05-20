<template>
  <div class="predictions-tab">
    <div class="info-bar">
      <div class="info-bar-left">
        <span class="balance-label">내 포인트</span>
        <span class="balance-value">{{ userPoints?.toLocaleString() ?? '-' }}<span class="balance-unit">pt</span></span>
      </div>
      <div class="info-bar-right">
        <span>{{ windowLabel }} 범위 예측 · 마감은 경기 하루 전 00:00 · 정산은 적중 베팅 비율로 분배</span>
      </div>
    </div>

    <div v-if="loading" class="state-msg">불러오는 중...</div>
    <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
    <div v-else-if="!matches.length" class="state-msg">예측 가능한 경기가 없습니다.</div>

    <div v-else class="match-list">
      <div v-for="m in matches" :key="m.schedule_id" class="match-card" :class="{ 'match-card--closed': !m.is_open || m.is_completed }">
        <div class="match-card-top">
          <span class="league-tag">{{ m.league_name }}</span>
          <span class="round-tag">{{ matchTypeLabel(m.match_type, m.round) }}</span>
          <span class="date-tag">{{ m.match_date }}</span>
          <span v-if="m.is_completed" class="status-tag status-tag--done">종료</span>
          <span v-else-if="!m.is_open" class="status-tag status-tag--closed">마감</span>
          <span v-else class="status-tag status-tag--open">진행 중</span>
        </div>

        <!-- 확률 바 -->
        <div class="prob-bar" :title="`A ${(m.prob_a*100).toFixed(0)}% / B ${(m.prob_b*100).toFixed(0)}%`">
          <div class="prob-bar-a" :style="{ width: barPct(m, 'a') + '%' }">
            <span v-if="m.total_pot > 0">{{ (m.prob_a * 100).toFixed(0) }}%</span>
          </div>
          <div class="prob-bar-b" :style="{ width: barPct(m, 'b') + '%' }">
            <span v-if="m.total_pot > 0">{{ (m.prob_b * 100).toFixed(0) }}%</span>
          </div>
          <div v-if="m.total_pot === 0" class="prob-bar-empty">아직 베팅 없음</div>
        </div>

        <!-- 팀 비교 -->
        <div class="match-card-body">
          <button
            class="team-btn"
            :class="teamBtnClass(m, 'a')"
            :disabled="m.is_completed || !m.is_open"
            @click="openBet(m, m.team_a_captain_id)"
          >
            <span v-if="strongerSide(m) === 'a'" class="strength-tag strength-tag--favorite">강세</span>
            <span v-else-if="strongerSide(m) === 'b'" class="strength-tag strength-tag--underdog">열세</span>
            <span class="team-name">{{ m.team_a_name }}</span>
            <span class="team-mult">{{ formatMult(m.multiplier_a) }}</span>
            <span class="team-pool">{{ m.total_bet_a.toLocaleString() }}pt</span>
          </button>

          <div class="vs-divider">VS</div>

          <button
            class="team-btn"
            :class="teamBtnClass(m, 'b')"
            :disabled="m.is_completed || !m.is_open"
            @click="openBet(m, m.team_b_captain_id)"
          >
            <span v-if="strongerSide(m) === 'b'" class="strength-tag strength-tag--favorite">강세</span>
            <span v-else-if="strongerSide(m) === 'a'" class="strength-tag strength-tag--underdog">열세</span>
            <span class="team-name">{{ m.team_b_name }}</span>
            <span class="team-mult">{{ formatMult(m.multiplier_b) }}</span>
            <span class="team-pool">{{ m.total_bet_b.toLocaleString() }}pt</span>
          </button>
        </div>

        <div class="match-card-footer">
          <span v-if="m.is_completed && m.user_prediction_captain_id !== null && (m.user_points_earned ?? 0) > 0" class="result-info--win">
            +{{ (m.user_points_earned ?? 0).toLocaleString() }}pt 획득 ({{ formatMult(m.user_final_multiplier ?? 0) }})
          </span>
          <span v-else-if="m.is_completed && m.user_prediction_captain_id !== null" class="result-info--lose">
            예측 실패 (-{{ (m.user_bet_amount ?? 0).toLocaleString() }}pt)
          </span>
          <span v-else-if="m.user_prediction_captain_id" class="my-bet-info">
            내 베팅: {{ (m.user_bet_amount ?? 0).toLocaleString() }}pt · 마감 {{ formatDeadline(m.deadline) }}
          </span>
          <span v-else-if="m.is_open" class="deadline-info">
            마감 {{ formatDeadline(m.deadline) }}
          </span>
          <button
            v-if="m.user_prediction_captain_id && m.is_open && !m.is_completed"
            class="btn-pill btn-pill--red btn-pill--silent"
            @click="handleCancel(m)"
          >예측 취소</button>
        </div>
      </div>
    </div>

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
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import {
  getPredictableMatches,
  placePrediction,
  cancelPrediction,
  getUserPoints,
  getCurrentMonday,
  getNextMonday,
  matchTypeLabel,
  type PredictableMatch,
} from '@/lib/predictions'
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId } from '@/lib/players'
import BetModal from '@/components/BetModal.vue'

const auth = useAuthStore()
const matches = ref<PredictableMatch[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const userId = ref<number | null>(null)
const userPoints = ref<number | null>(null)

const windowLabel = (() => {
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`
  return `${fmt(getCurrentMonday())} ~ ${fmt(getNextMonday())}`
})()

function teamBtnClass(m: PredictableMatch, side: 'a' | 'b') {
  const captainId = side === 'a' ? m.team_a_captain_id : m.team_b_captain_id
  return {
    'team-btn--picked': m.user_prediction_captain_id === captainId,
    'team-btn--winner': m.is_completed && m.winner_captain_id === captainId,
    'team-btn--loser': m.is_completed && m.winner_captain_id !== null && m.winner_captain_id !== captainId,
  }
}

function strongerSide(m: PredictableMatch): 'a' | 'b' | null {
  if (m.total_pot === 0) return null
  if (Math.abs(m.prob_a - m.prob_b) < 0.05) return null
  return m.prob_a > m.prob_b ? 'a' : 'b'
}

function barPct(m: PredictableMatch, side: 'a' | 'b') {
  if (m.total_pot === 0) return 50
  return side === 'a' ? m.prob_a * 100 : m.prob_b * 100
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
  match: null as PredictableMatch | null,
  captainId: 0,
  teamName: '',
  side: 'a' as 'a' | 'b',
  saving: false,
  error: null as string | null,
})

const availableBalance = computed(() => {
  const owned = userPoints.value ?? 0
  const refundable = betModal.match?.user_bet_amount ?? 0
  return owned + refundable
})

// 본인 베팅을 제외한 양 팀 베팅 합 (모달에 전달)
const betModalMyTotal = computed(() => {
  if (!betModal.match) return 0
  const m = betModal.match
  let myA = m.total_bet_a, myB = m.total_bet_b
  if (m.user_prediction_captain_id === m.team_a_captain_id) myA -= (m.user_bet_amount ?? 0)
  if (m.user_prediction_captain_id === m.team_b_captain_id) myB -= (m.user_bet_amount ?? 0)
  return betModal.side === 'a' ? myA : myB
})

const betModalOtherTotal = computed(() => {
  if (!betModal.match) return 0
  const m = betModal.match
  let myA = m.total_bet_a, myB = m.total_bet_b
  if (m.user_prediction_captain_id === m.team_a_captain_id) myA -= (m.user_bet_amount ?? 0)
  if (m.user_prediction_captain_id === m.team_b_captain_id) myB -= (m.user_bet_amount ?? 0)
  return betModal.side === 'a' ? myB : myA
})

const betModalInitial = computed(() => {
  const m = betModal.match
  if (!m) return 100
  return m.user_bet_amount && m.user_prediction_captain_id === betModal.captainId ? m.user_bet_amount : 100
})

function openBet(m: PredictableMatch, captainId: number) {
  if (!m.is_open || m.is_completed) return
  betModal.match = m
  betModal.captainId = captainId
  betModal.side = captainId === m.team_a_captain_id ? 'a' : 'b'
  betModal.teamName = captainId === m.team_a_captain_id ? m.team_a_name : m.team_b_name
  betModal.error = null
  betModal.open = true
}

function closeBet() {
  if (betModal.saving) return
  betModal.open = false
  betModal.match = null
}

async function confirmBet(amount: number) {
  if (!betModal.match || !userId.value) return
  betModal.saving = true
  betModal.error = null
  try {
    const res = await placePrediction(betModal.match.schedule_id, userId.value, betModal.captainId, amount)
    userPoints.value = res.remaining_points
    await reload()
    betModal.open = false
    betModal.match = null
  } catch (e: any) {
    betModal.error = e.message ?? '베팅 실패'
  } finally {
    betModal.saving = false
  }
}

async function reload() {
  if (!userId.value) return
  matches.value = await getPredictableMatches(userId.value)
  userPoints.value = await getUserPoints(userId.value)
}

async function handleCancel(m: PredictableMatch) {
  if (!userId.value || !m.is_open) return
  if (!confirm('예측을 취소하시겠습니까? (베팅 포인트는 환불됩니다)')) return
  try {
    await cancelPrediction(m.schedule_id, userId.value)
    await reload()
  } catch (e: any) {
    loadError.value = e.message ?? '예측 취소 실패'
  }
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    if (!discordId) { loadError.value = '사용자 정보를 찾을 수 없습니다.'; return }
    const me = await getPlayerByDiscordId(discordId)
    if (!me) { loadError.value = '등록된 사용자가 아닙니다.'; return }
    userId.value = me.id
    await reload()
  } catch (e: any) {
    loadError.value = e.message ?? '예측 정보를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './PredictionsTab.scss';
</style>
