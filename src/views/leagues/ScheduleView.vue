<template>
  <div class="schedule-page">
    <AppHeader />

    <div class="schedule-content">
      <button class="btn-back" @click="$router.push({ name: 'leagues' })">
        <AppIcon name="chevron-left" :size="13" />
        리그 목록
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <div class="page-title-row">
          <div>
            <h1 class="page-title page-title--sm">경기 관리</h1>
            <span class="page-subtitle">{{ league?.name }}</span>
          </div>
          <button
            class="btn-result"
            :class="{ 'btn-result--disabled': !rows.length }"
            :disabled="!rows.length"
            @click="rows.length && router.push({ name: 'league-match-result', params: { id: leagueId } })"
          >
            <AppIcon name="chart" :size="13" />
            경기 결과 입력
          </button>
        </div>

        <!-- ── 라운드 로빈 자동 생성 ───────────────────────── -->
        <div class="section-card">
          <p class="section-label">라운드 로빈 자동 생성</p>
          <div class="rr-row">
            <div class="rr-input-group">
              <label class="rr-input-label">라운드 수</label>
              <input
                v-model.number="numRoundsInput"
                class="rr-number-input"
                type="text"
                min="1"
                placeholder="자동"
              />
            </div>
            <div class="rr-input-group">
              <label class="rr-input-label">팀당 경기 수</label>
              <input
                v-model.number="gamesPerTeam"
                class="rr-number-input"
                type="text"
                min="1"
                placeholder="1"
              />
            </div>
            <button class="btn-generate" @click="generateRoundRobin">
              <AppIcon name="refresh" :size="12" />
              자동 생성
            </button>
          </div>
        </div>

        <!-- ── 직접 등록 ───────────────────────────────────── -->
        <div class="section-header-row">
          <p class="section-label">경기 목록</p>
          <div class="direct-actions">
            <button class="btn-add-round" @click="addRound">
              <AppIcon name="plus" :size="11" />
              라운드 추가
            </button>
            <button class="btn-add-match" @click="addMatch" :disabled="!rounds.length">
              <AppIcon name="plus" :size="11" />
              경기 추가
            </button>
          </div>
        </div>

        <div v-if="!rows.length" class="empty-msg">
          경기가 없습니다. 자동 생성하거나 직접 추가해주세요.
        </div>

        <div v-else class="schedule-list">
          <div v-for="round in rounds" :key="round" class="round-group">
            <div class="round-header">
              <span class="round-label">{{ round }}라운드</span>
              <button class="btn-remove-round" @click="removeRound(round)" title="라운드 삭제">
                <AppIcon name="close" :size="10" />
              </button>
            </div>
            <div class="match-list">
              <div v-for="(row, idx) in rowsByRound(round)" :key="idx" class="match-row">
                <div class="match-teams">
                  <div class="match-team">
                    <select v-model="row.teamA" class="team-select">
                      <option value="">팀 선택</option>
                      <option v-for="t in teams" :key="t.captainId" :value="t.captainId">
                        {{ t.teamName || t.nickname }}
                      </option>
                    </select>
                  </div>
                  <span class="match-vs">VS</span>
                  <div class="match-team">
                    <select v-model="row.teamB" class="team-select">
                      <option value="">팀 선택</option>
                      <option v-for="t in teams" :key="t.captainId" :value="t.captainId">
                        {{ t.teamName || t.nickname }}
                      </option>
                    </select>
                  </div>
                </div>
                <div class="date-picker-wrap">
                  <VueDatePicker
                    :model-value="row.matchDate ? new Date(row.matchDate) : null"
                    :enable-time-picker="false"
                    :locale="ko"
                    :dark="true"
                    auto-apply
                    :teleport="true"
                    @update:model-value="(val: Date | null) => row.matchDate = val ? toYMD(val) : ''"
                  >
                    <template #trigger>
                      <div class="dp-custom-input">
                        <svg width="13" height="13" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                          <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                          <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                        <span :class="row.matchDate ? 'dp-date-text' : 'dp-placeholder'">
                          {{ row.matchDate ? row.matchDate.replaceAll('-', '/') : '날짜 선택' }}
                        </span>
                      </div>
                    </template>
                  </VueDatePicker>
                </div>
                <button class="btn-remove-match" @click="removeMatch(row)">
                  <AppIcon name="close" :size="11" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="page-footer">
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <button class="btn-save" :disabled="saving" @click="handleSave">
            {{ saving ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ko } from 'date-fns/locale'
import { getLeague, type LeagueRow } from '@/lib/leagues'
import { getCaptains } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import { getSchedules, saveSchedules } from '@/lib/schedules'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

const loading = ref(true)
const pageError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const league = ref<LeagueRow | null>(null)
const gamesPerTeam = ref(1)
const numRoundsInput = ref<number | null>(null)

interface TeamInfo {
  captainId: number
  nickname: string
  teamName: string
  tier: string
  race: string
}

interface MatchRow {
  round: number
  teamA: number | ''
  teamB: number | ''
  matchDate: string
}

const teams = ref<TeamInfo[]>([])
const rows = ref<MatchRow[]>([])

const rounds = computed(() => [...new Set(rows.value.map(r => r.round))].sort((a, b) => a - b))
function rowsByRound(round: number) { return rows.value.filter(r => r.round === round) }

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames, schedules] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
      getSchedules(leagueId),
    ]))
    league.value = leagueData

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))

    teams.value = captains.map(c => {
      const p = playerMap.get(c.player_id)
      return {
        captainId: c.player_id,
        nickname: p?.nickname ?? `선수 ${c.player_id}`,
        teamName: nameMap.get(c.player_id) ?? '',
        tier: p?.tier ?? '',
        race: p?.race ?? '',
      }
    })

    rows.value = schedules.map(s => ({
      round: s.round,
      teamA: s.team_a_captain_id,
      teamB: s.team_b_captain_id,
      matchDate: s.match_date ?? '',
    }))
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// ── 라운드 로빈 자동 생성 ─────────────────────────────────
function generateRoundRobin() {
  const n = teams.value.length
  if (n < 2) return

  const allMatches: { teamA: number; teamB: number }[] = []

  for (let repeat = 0; repeat < gamesPerTeam.value; repeat++) {
    const list = n % 2 === 0
      ? teams.value.map(t => t.captainId)
      : [...teams.value.map(t => t.captainId), -1]

    const size = list.length
    const numRounds = size - 1
    const half = size / 2

    for (let r = 0; r < numRounds; r++) {
      for (let i = 0; i < half; i++) {
        const a = list[i]
        const b = list[size - 1 - i]
        if (a !== -1 && b !== -1) {
          const isReverse = repeat % 2 === 1
          allMatches.push({ teamA: isReverse ? b : a, teamB: isReverse ? a : b })
        }
      }
      list.splice(1, 0, list.pop()!)
    }
  }

  const naturalRounds = (n % 2 === 0 ? n - 1 : n) * gamesPerTeam.value
  const targetRounds = numRoundsInput.value && numRoundsInput.value > 0
    ? numRoundsInput.value
    : naturalRounds

  const matchesPerRound = Math.ceil(allMatches.length / targetRounds)
  rows.value = allMatches.map((m, idx) => ({
    round: Math.min(Math.floor(idx / matchesPerRound) + 1, targetRounds),
    teamA: m.teamA,
    teamB: m.teamB,
    matchDate: '',
  }))
}

// ── 직접 등록 ─────────────────────────────────────────────
function addRound() {
  const nextRound = rounds.value.length ? Math.max(...rounds.value) + 1 : 1
  rows.value.push({ round: nextRound, teamA: '', teamB: '', matchDate: '' })
}

function addMatch() {
  const lastRound = rounds.value.length ? Math.max(...rounds.value) : 1
  rows.value.push({ round: lastRound, teamA: '', teamB: '', matchDate: '' })
}

function removeRound(round: number) {
  rows.value = rows.value.filter(r => r.round !== round)
}

function removeMatch(row: MatchRow) {
  const idx = rows.value.indexOf(row)
  if (idx !== -1) rows.value.splice(idx, 1)
}

async function handleSave() {
  const invalid = rows.value.find(r => !r.teamA || !r.teamB || r.teamA === r.teamB)
  if (invalid) {
    saveError.value = '모든 경기의 팀을 올바르게 선택해주세요.'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    await saveSchedules(leagueId, rows.value.map(r => ({
      round: r.round,
      match_date: r.matchDate || null,
      team_a_captain_id: r.teamA as number,
      team_b_captain_id: r.teamB as number,
    })))
    router.push({ name: 'leagues' })
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './ScheduleView.scss';
</style>
