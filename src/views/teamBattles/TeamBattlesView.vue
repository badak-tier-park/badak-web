<template>
  <div class="team-battles-page">
    <AppHeader />

    <div class="team-battles-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">팀배틀</h1>
        <button class="btn-create" @click="openCreate">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          팀배틀 만들기
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="battles.length === 0" class="state-msg">아직 만들어진 팀배틀이 없습니다.</div>

      <div v-else class="battle-list">
        <RouterLink
          v-for="b in battles"
          :key="b.id"
          :to="{ name: 'team-battle-detail', params: { id: b.id } }"
          class="battle-card"
        >
          <div class="battle-card-header">
            <span class="battle-status" :class="`status--${b.status.toLowerCase()}`">
              {{ TEAM_BATTLE_STATUS_LABEL[b.status] }}
            </span>
            <span class="battle-start">{{ formatDateTime(b.start_at) }}</span>
          </div>
          <p class="battle-name">{{ b.name }}</p>
        </RouterLink>
      </div>
    </div>

    <!-- 생성 모달 -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop">
        <div class="modal edit-modal">
          <div class="modal-header">
            <span class="modal-title">팀배틀 만들기</span>
            <button class="modal-close" @click="closeCreate">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label">팀배틀 이름</label>
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
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import {
  getTeamBattles, createTeamBattle, TEAM_BATTLE_STATUS_LABEL,
  type TeamBattleRow, type AceMode,
} from '@/lib/teamBattles'

const router = useRouter()
const auth = useAuthStore()

const battles = ref<TeamBattleRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myPlayer = ref<PlayerRow | null>(null)

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
// 팝오버로 띄우면 패널(약 400px)이 모달보다 커서 어디에 붙이든 잘리거나
// 모달 스크롤이 늘어난다. 그래서 팝업 없이 폼의 일부로 그냥 펼쳐 둔다.
interface CalendarDay { date: Date; inMonth: boolean; disabled: boolean }

const calendarMonth = ref(new Date())
const weekdayLabels = ['월', '화', '수', '목', '금', '토', '일']

const monthLabel = computed(() => `${calendarMonth.value.getFullYear()}년 ${calendarMonth.value.getMonth() + 1}월`)

const calendarDays = computed<CalendarDay[]>(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // 필요한 주 수만 그린다 (항상 6줄로 그리면 마지막 줄이 통째로 다음 달이라 공간만 먹음)
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
    const [battlesData, me] = await Promise.all([
      getTeamBattles(),
      discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    ])
    battles.value = battlesData
    myPlayer.value = me
  } catch (e: any) {
    loadError.value = e.message ?? '팀배틀 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 생성 모달 ─────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({
  name: '',
  startDate: null as Date | null,
  startHour: 20,
  startMinute: 0,
  aceMode: 'RANDOM' as AceMode,
})

function openCreate() {
  form.name = ''
  form.startDate = null
  form.startHour = 20
  form.startMinute = 0
  form.aceMode = 'RANDOM'
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

  saving.value = true
  saveError.value = null
  try {
    const created = await createTeamBattle(
      { name: form.name.trim(), start_at: startAt.value.toISOString(), ace_mode: form.aceMode },
      myPlayer.value,
    )
    showForm.value = false
    router.push({ name: 'team-battle-detail', params: { id: created.id } })
  } catch (e: any) {
    saveError.value = e.message ?? '생성 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TeamBattlesView.scss';
</style>
