<template>
  <div class="tournaments-page">
    <AppHeader />

    <div class="tournaments-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">개인 토너먼트</h1>
        <button class="btn-create" @click="openCreate">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          토너먼트 만들기
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="tournaments.length === 0" class="state-msg">아직 만들어진 토너먼트가 없습니다.</div>

      <div v-else class="tournament-list">
        <div v-for="t in sortedTournaments" :key="t.id" class="tournament-card">
          <div class="tournament-card-row">
            <RouterLink
              :to="{ name: 'tournament-detail', params: { id: t.id } }"
              class="tournament-card-main"
            >
              <div class="tournament-card-header">
                <span class="tournament-status" :class="`status--${t.status.toLowerCase()}`">
                  {{ TOURNAMENT_STATUS_LABEL[t.status] }}
                </span>
                <span class="tournament-start">{{ formatDateTime(t.start_at) }}</span>
              </div>
              <p class="tournament-name">{{ t.name }}</p>
              <p class="tournament-sub">참가 {{ t.player_count }}명 · 주최 {{ nicknameOf(t.host_user_id) }}</p>
            </RouterLink>

            <button
              type="button"
              class="tournament-expand-btn"
              :class="{ 'tournament-expand-btn--open': expandedId === t.id }"
              :aria-label="expandedId === t.id ? '접기' : '펼치기'"
              @click="toggleExpand(t.id)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <div v-if="expandedId === t.id" class="tournament-expand-panel">
            <p v-if="summaryLoading" class="state-msg">불러오는 중...</p>
            <p v-else-if="summaryError" class="state-msg state-msg--error">{{ summaryError }}</p>

            <!-- 대진이 있으면 결과 요약 -->
            <template v-else-if="summaryMatches.length > 0">
              <p v-if="t.winner_user_id" class="result-winner">{{ nicknameOf(t.winner_user_id) }} 우승</p>
              <TournamentBracket :matches="summaryMatches" :nickname-of="nicknameOf" />
            </template>

            <!-- 아직 대진 전이면 참가자 목록 -->
            <template v-else-if="summaryPlayers.length > 0">
              <p class="result-label">참가자 {{ summaryPlayers.length }}명</p>
              <div class="result-player-chips">
                <span v-for="p in summaryPlayers" :key="p.user_id" class="result-player-chip">
                  <span class="tier-badge" :class="`tier-badge--${$tierClass(p.tier)}`">{{ p.tier }}</span>
                  {{ nicknameOf(p.user_id) }}
                </span>
              </div>
            </template>

            <p v-else class="state-msg">아직 참가자가 없습니다.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 생성 모달 -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop">
        <div class="modal edit-modal">
          <div class="modal-header">
            <span class="modal-title">토너먼트 만들기</span>
            <button class="modal-close" @click="closeCreate">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label">토너먼트 이름</label>
              <input
                v-model="form.name"
                class="field-input"
                type="text"
                maxlength="50"
                placeholder="이름 입력"
              />
            </div>

            <div class="field">
              <label class="field-label">시작 일시</label>

              <div class="datetime-inline">
                <div class="calendar-header">
                  <button type="button" class="calendar-nav-btn" @click="shiftMonth(-1)">‹</button>
                  <span class="calendar-month-label">{{ monthLabel }}</span>
                  <button type="button" class="calendar-nav-btn" @click="shiftMonth(1)">›</button>
                </div>
                <div class="calendar-weekday-row">
                  <span v-for="w in weekdayLabels" :key="w" class="calendar-weekday">{{ w }}</span>
                </div>
                <div class="calendar-grid">
                  <button
                    v-for="(day, i) in calendarDays"
                    :key="i"
                    type="button"
                    class="calendar-day-btn"
                    :class="{
                      'calendar-day-btn--outside': !day.inMonth,
                      'calendar-day-btn--selected': form.startDate && isSameDay(day.date, form.startDate),
                      'calendar-day-btn--today': isSameDay(day.date, today),
                    }"
                    :disabled="day.disabled"
                    @click="pickDay(day)"
                  >{{ day.date.getDate() }}</button>
                </div>

                <div class="time-spinner-row">
                  <div class="time-spinner">
                    <button type="button" class="spinner-arrow" @click="stepHour(1)">▲</button>
                    <span class="spinner-value">{{ pad(form.startHour) }}</span>
                    <button type="button" class="spinner-arrow" @click="stepHour(-1)">▼</button>
                  </div>
                  <span class="spinner-colon">:</span>
                  <div class="time-spinner">
                    <button type="button" class="spinner-arrow" @click="stepMinute(1)">▲</button>
                    <span class="spinner-value">{{ pad(form.startMinute) }}</span>
                    <button type="button" class="spinner-arrow" @click="stepMinute(-1)">▼</button>
                  </div>
                </div>

                <p class="datetime-summary" :class="{ 'datetime-summary--empty': !form.startDate }">
                  {{ selectedLabel }}
                </p>
              </div>

              <p class="field-hint">이 시간이 되면 모집이 자동으로 마감됩니다.</p>
            </div>

            <div class="field">
              <label class="field-label">참여 가능 티어</label>
              <div class="tier-select-grid">
                <button
                  v-for="t in TIER_ORDER"
                  :key="t"
                  type="button"
                  class="tier-toggle-btn"
                  :class="[`tier-badge--${$tierClass(t)}`, { 'tier-toggle-btn--off': !selectedTiers.has(t) }]"
                  @click="toggleTier(t)"
                >{{ t }}</button>
              </div>
              <p class="field-hint">기본은 전체 참여 가능. 특정 티어 위주로 진행하려면 해제하세요.</p>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeCreate" :disabled="saving">취소</button>
              <button class="btn-save" :disabled="saving" @click="handleCreate">
                {{ saving ? '생성 중...' : '생성' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import TournamentBracket from './TournamentBracket.vue'
import { useAuthStore } from '@/stores/auth'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import {
  getTournaments, createTournament, getTournamentSummary, TOURNAMENT_STATUS_LABEL,
  type TournamentListRow, type TournamentPlayerRow, type TournamentMatchRow,
} from '@/lib/tournaments'
import { TIER_ORDER } from '@/lib/constants'

const router = useRouter()
const auth = useAuthStore()

const tournaments = ref<TournamentListRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myPlayer = ref<PlayerRow | null>(null)

const nicknameOf = (userId: number | null) =>
  userId === null ? '-' : (allPlayers.value.find(p => p.id === userId)?.nickname ?? `선수 ${userId}`)

/** 종료/취소된 토너먼트는 아래로, 그 안에서는 최신순 */
const sortedTournaments = computed(() => {
  const isDone = (s: string) => s === 'FINISHED' || s === 'CANCELLED'
  return [...tournaments.value].sort((a, b) => {
    const da = isDone(a.status) ? 1 : 0
    const db = isDone(b.status) ? 1 : 0
    if (da !== db) return da - db
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

const today = startOfDay(new Date())

// ── 날짜+시간 선택 (모달 안에 항상 펼쳐진 인라인 패널) ──────────
// 팝오버로 띄우면 패널이 모달보다 커서 어디에 붙이든 잘리거나 모달 스크롤이
// 늘어난다(팀배틀에서 검증됨). 그래서 팝업 없이 폼의 일부로 그냥 펼쳐 둔다.
interface CalendarDay { date: Date; inMonth: boolean; disabled: boolean }

const calendarMonth = ref(new Date())
const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

const monthLabel = computed(() => `${calendarMonth.value.getFullYear()}년 ${calendarMonth.value.getMonth() + 1}월`)

const calendarDays = computed<CalendarDay[]>(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7
  const gridStart = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: cellCount }, (_, i) => {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date: d, inMonth: d.getMonth() === month, disabled: startOfDay(d) < today }
  })
})

function shiftMonth(delta: number) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + delta, 1)
}

function pickDay(day: CalendarDay) {
  if (day.disabled) return
  form.startDate = day.date
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function stepHour(delta: number) {
  form.startHour = (form.startHour + delta + 24) % 24
}

function stepMinute(delta: number) {
  form.startMinute = (form.startMinute + delta + 60) % 60
}

/** 선택한 날짜 + 시/분을 하나의 Date로 합친 값 (날짜 미선택이면 null) */
const startAt = computed<Date | null>(() => {
  if (!form.startDate) return null
  const d = new Date(form.startDate)
  d.setHours(form.startHour, form.startMinute, 0, 0)
  return d
})

const selectedLabel = computed(() =>
  startAt.value ? formatDateTime(startAt.value.toISOString()) : '날짜를 선택하세요',
)

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    const [tournamentsData, players, me] = await Promise.all([
      getTournaments(),
      getPlayers(),
      discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    ])
    tournaments.value = tournamentsData
    allPlayers.value = players
    myPlayer.value = me
  } catch (e: any) {
    loadError.value = e.message ?? '토너먼트 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 카드 펼치기 (펼칠 때만 해당 토너먼트 상세를 조회) ──────────
const expandedId = ref<string | null>(null)
const summaryLoading = ref(false)
const summaryError = ref<string | null>(null)
const summaryPlayers = ref<TournamentPlayerRow[]>([])
const summaryMatches = ref<TournamentMatchRow[]>([])

async function toggleExpand(tournamentId: string) {
  if (expandedId.value === tournamentId) {
    expandedId.value = null
    return
  }
  expandedId.value = tournamentId
  summaryLoading.value = true
  summaryError.value = null
  summaryPlayers.value = []
  summaryMatches.value = []
  try {
    const summary = await getTournamentSummary(tournamentId)
    summaryPlayers.value = summary.players
    summaryMatches.value = summary.matches
  } catch (e: any) {
    summaryError.value = e.message ?? '내용을 불러올 수 없습니다.'
  } finally {
    summaryLoading.value = false
  }
}

// ── 생성 모달 ─────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({
  name: '',
  startDate: null as Date | null,
  startHour: 20,
  startMinute: 0,
})

// ── 참여 가능 티어 (디폴트 전체 선택) ─────────────────────
const selectedTiers = ref<Set<string>>(new Set(TIER_ORDER))

function toggleTier(tier: string) {
  const next = new Set(selectedTiers.value)
  if (next.has(tier)) next.delete(tier)
  else next.add(tier)
  selectedTiers.value = next
}

function openCreate() {
  form.name = ''
  form.startDate = null
  form.startHour = 20
  form.startMinute = 0
  selectedTiers.value = new Set(TIER_ORDER)
  calendarMonth.value = new Date()
  saveError.value = null
  showForm.value = true
}

function closeCreate() {
  if (saving.value) return
  showForm.value = false
}

async function handleCreate() {
  if (!myPlayer.value) { saveError.value = '선수 정보를 불러오지 못했습니다.'; return }
  if (!form.name.trim()) { saveError.value = '이름을 입력해주세요.'; return }
  if (!startAt.value) { saveError.value = '날짜를 선택해주세요.'; return }
  if (selectedTiers.value.size === 0) { saveError.value = '참여 가능 티어를 최소 1개는 선택해주세요.'; return }

  const allowedTiers = selectedTiers.value.size === TIER_ORDER.length ? null : [...selectedTiers.value]

  saving.value = true
  saveError.value = null
  try {
    const created = await createTournament(
      { name: form.name.trim(), start_at: startAt.value.toISOString(), allowed_tiers: allowedTiers },
      myPlayer.value,
    )
    showForm.value = false
    router.push({ name: 'tournament-detail', params: { id: created.id } })
  } catch (e: any) {
    saveError.value = e.message ?? '생성 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TournamentsView.scss';
</style>
