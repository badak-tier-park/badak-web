<template>
  <div class="playoffs-page">
    <AppHeader />

    <div class="playoffs-content">
      <button class="btn-back" @click="$router.push({ name: 'leagues' })">
        <AppIcon name="chevron-left" :size="13" />
        리그 목록
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <!-- 페이지 헤더 -->
        <div class="playoffs-header">
          <div class="playoffs-header-icon">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2.5 4h6M2.5 16h6M8.5 4v12M8.5 10h9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <h1 class="page-title page-title--sm">본선 관리</h1>
            <span class="page-subtitle">{{ league?.name }}</span>
          </div>
        </div>

        <!-- ── STEP 1: 정규리그 순위 ── -->
        <section class="bracket-stage">
          <div class="stage-header">
            <span class="stage-num stage-num--done">1</span>
            <span class="stage-title">정규리그 최종 순위</span>
            <span class="stage-badge" :class="regularAllDone ? 'stage-badge--done' : 'stage-badge--wip'">
              {{ regularAllDone ? '순위 확정' : '진행 중' }}
            </span>
          </div>

          <div class="standings-list">
            <div
              v-for="entry in standings"
              :key="entry.captainId"
              class="standing-row"
              :class="`standing-row--${entry.rank}`"
            >
              <span class="standing-rank">{{ entry.rank }}</span>
              <span class="standing-team">{{ teamLabel(entry.captainId) }}</span>
              <span class="standing-record">{{ entry.wins }}승 {{ entry.losses }}패</span>
              <span v-if="entry.rank === 1" class="standing-badge standing-badge--gold">결승 직행</span>
              <span v-else-if="entry.rank === 2 || entry.rank === 3" class="standing-badge standing-badge--silver">준결승</span>
            </div>
          </div>
        </section>

        <!-- 연결선 -->
        <div class="stage-flow" :class="{ 'stage-flow--active': regularAllDone }">
          <div class="stage-flow-line" />
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="stage-flow-arrow">
            <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- ── STEP 2: 준결승 ── -->
        <section class="bracket-stage" :class="{ 'bracket-stage--locked': !regularAllDone }">
          <div class="stage-header">
            <span class="stage-num" :class="regularAllDone ? (semifinal?.is_completed ? 'stage-num--done' : 'stage-num--active') : 'stage-num--locked'">2</span>
            <span class="stage-title">준결승 <span class="stage-subtitle">2위 vs 3위</span></span>
            <span v-if="!regularAllDone" class="stage-badge stage-badge--locked">대기 중</span>
            <span v-else-if="semifinal?.is_completed" class="stage-badge stage-badge--done">완료</span>
          </div>

          <!-- 잠금 상태 -->
          <div v-if="!regularAllDone" class="stage-locked">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="stage-lock-icon">
              <rect x="2.5" y="6" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            정규경기가 모두 완료되면 설정할 수 있습니다.
          </div>

          <template v-else-if="!semifinal">
            <div class="setup-row">
              <VueDatePicker
                v-model="semifinalDate"
                :enable-time-picker="false"
                :dark="theme === 'dark'"
                :locale="ko"
                format="yyyy/MM/dd"
                auto-apply
                :teleport="false"
                class="date-picker-wrap"
              >
                <template #trigger>
                  <div class="dp-custom-input">
                    <AppIcon name="calendar" :size="13" class="dp-custom-icon" />
                    <span v-if="semifinalDate" class="dp-date-text">{{ formatDate(semifinalDate) }}</span>
                    <span v-else class="dp-placeholder">날짜 선택</span>
                  </div>
                </template>
              </VueDatePicker>
              <button class="btn-pill btn-pill--md btn-pill--purple btn-pill--filled" :disabled="creating" @click="createSemifinal">
                경기 생성
              </button>
            </div>
          </template>

          <template v-else>
            <div class="bracket-card" :class="{ 'bracket-card--done': semifinal.is_completed }">
              <div class="bracket-matchup">
                <div class="bracket-team-block" :class="{ 'bracket-team-block--winner': semifinal.winner_captain_id === semifinal.team_a_captain_id }">
                  <span class="bracket-seed">2위</span>
                  <span class="bracket-team-name">{{ teamLabel(semifinal.team_a_captain_id) }}</span>
                </div>
                <span class="bracket-vs">VS</span>
                <div class="bracket-team-block bracket-team-block--right" :class="{ 'bracket-team-block--winner': semifinal.winner_captain_id === semifinal.team_b_captain_id }">
                  <span class="bracket-seed">3위</span>
                  <span class="bracket-team-name">{{ teamLabel(semifinal.team_b_captain_id) }}</span>
                </div>
              </div>
              <div class="bracket-meta">
                <span v-if="semifinal.match_date" class="bracket-date">
                  <AppIcon name="calendar" :size="11" />
                  {{ semifinal.match_date.replaceAll('-', '/') }}
                </span>
                <div class="bracket-actions">
                  <button v-if="!semifinal.is_entry_revealed && bothSubmittedSet.has(semifinal.id)" class="btn-pill btn-pill--sm btn-pill--green" @click="revealSemifinal">엔트리 공개</button>
                  <span v-else-if="semifinal.is_entry_revealed" class="badge-revealed"><AppIcon name="check" :size="10" /> 공개됨</span>
                  <button v-if="semifinal.is_entry_revealed && isMatchDatePassed(semifinal.match_date)" class="btn-pill btn-pill--sm btn-pill--blue" @click="goToResult(semifinal.id)">결과 입력</button>
                  <button v-if="!semifinal.is_completed && !bothSubmittedSet.has(semifinal.id)" class="btn-pill btn-pill--sm btn-pill--ghost" @click="deleteSemifinal">삭제</button>
                </div>
              </div>
            </div>
          </template>
        </section>

        <!-- 연결선 -->
        <div class="stage-flow" :class="{ 'stage-flow--active': semifinal?.is_completed }">
          <div class="stage-flow-line" />
          <svg width="10" height="6" viewBox="0 0 10 6" fill="none" class="stage-flow-arrow">
            <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>

        <!-- ── STEP 3: 결승전 ── -->
        <section class="bracket-stage" :class="{ 'bracket-stage--locked': !semifinal?.is_completed }">
          <div class="stage-header">
            <span class="stage-num" :class="semifinal?.is_completed ? (finalWinner || (superAce?.is_completed) ? 'stage-num--done' : 'stage-num--active') : 'stage-num--locked'">3</span>
            <span class="stage-title">결승전</span>
            <span v-if="!semifinal?.is_completed" class="stage-badge stage-badge--locked">대기 중</span>
            <span v-else-if="finalWinner || superAce?.is_completed" class="stage-badge stage-badge--done">완료</span>
          </div>

          <!-- 잠금 상태 -->
          <div v-if="!semifinal?.is_completed" class="stage-locked">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="stage-lock-icon">
              <rect x="2.5" y="6" width="9" height="7" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M4.5 6V4.5a2.5 2.5 0 015 0V6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            준결승이 완료되면 설정할 수 있습니다.
          </div>

          <template v-else>
            <!-- 1세트 -->
            <div class="final-set-block">
              <div class="final-set-header">
                <span class="final-set-label">1세트</span>
                <span v-if="finalSet1?.is_completed" class="final-set-done">완료</span>
              </div>
              <template v-if="!finalSet1">
                <div class="setup-row">
                  <VueDatePicker v-model="finalDate" :enable-time-picker="false" :dark="theme === 'dark'" :locale="ko" format="yyyy/MM/dd" auto-apply :teleport="false" class="date-picker-wrap">
                    <template #trigger>
                      <div class="dp-custom-input">
                        <AppIcon name="calendar" :size="13" class="dp-custom-icon" />
                        <span v-if="finalDate" class="dp-date-text">{{ formatDate(finalDate) }}</span>
                        <span v-else class="dp-placeholder">날짜 선택</span>
                      </div>
                    </template>
                  </VueDatePicker>
                  <button class="btn-pill btn-pill--md btn-pill--purple btn-pill--filled" :disabled="creating" @click="createFinalSet(1)">경기 생성</button>
                </div>
              </template>
              <template v-else>
                <div class="bracket-card" :class="{ 'bracket-card--done': finalSet1.is_completed }">
                  <div class="bracket-matchup">
                    <div class="bracket-team-block" :class="{ 'bracket-team-block--winner': finalSet1.winner_captain_id === finalSet1.team_a_captain_id }">
                      <span class="bracket-seed">1위</span>
                      <span class="bracket-team-name">{{ teamLabel(finalSet1.team_a_captain_id) }}</span>
                    </div>
                    <span class="bracket-vs">VS</span>
                    <div class="bracket-team-block bracket-team-block--right" :class="{ 'bracket-team-block--winner': finalSet1.winner_captain_id === finalSet1.team_b_captain_id }">
                      <span class="bracket-seed">준결승 승자</span>
                      <span class="bracket-team-name">{{ teamLabel(finalSet1.team_b_captain_id) }}</span>
                    </div>
                  </div>
                  <div class="bracket-meta">
                    <span v-if="finalSet1.match_date" class="bracket-date"><AppIcon name="calendar" :size="11" />{{ finalSet1.match_date.replaceAll('-', '/') }}</span>
                    <div class="bracket-actions">
                      <button v-if="!finalSet1.is_entry_revealed && bothSubmittedSet.has(finalSet1.id)" class="btn-pill btn-pill--sm btn-pill--green" @click="revealFinalSet(1)">엔트리 공개</button>
                      <span v-else-if="finalSet1.is_entry_revealed" class="badge-revealed"><AppIcon name="check" :size="10" /> 공개됨</span>
                      <button v-if="finalSet1.is_entry_revealed && isMatchDatePassed(finalSet1.match_date)" class="btn-pill btn-pill--sm btn-pill--blue" @click="goToResult(finalSet1.id)">결과 입력</button>
                      <button v-if="!finalSet1.is_completed && !bothSubmittedSet.has(finalSet1.id)" class="btn-pill btn-pill--sm btn-pill--ghost" @click="deleteFinalSet(1)">삭제</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- 2세트 -->
            <div v-if="finalSet1?.is_completed" class="final-set-block">
              <div class="final-set-header">
                <span class="final-set-label">2세트</span>
                <span v-if="finalSet2?.is_completed" class="final-set-done">완료</span>
              </div>
              <template v-if="!finalSet2">
                <div class="setup-row">
                  <VueDatePicker v-model="finalDate2" :enable-time-picker="false" :dark="theme === 'dark'" :locale="ko" format="yyyy/MM/dd" auto-apply :teleport="false" class="date-picker-wrap">
                    <template #trigger>
                      <div class="dp-custom-input">
                        <AppIcon name="calendar" :size="13" class="dp-custom-icon" />
                        <span v-if="finalDate2" class="dp-date-text">{{ formatDate(finalDate2) }}</span>
                        <span v-else class="dp-placeholder">날짜 선택</span>
                      </div>
                    </template>
                  </VueDatePicker>
                  <button class="btn-pill btn-pill--md btn-pill--purple btn-pill--filled" :disabled="creating" @click="createFinalSet(2)">경기 생성</button>
                </div>
              </template>
              <template v-else>
                <div class="bracket-card" :class="{ 'bracket-card--done': finalSet2.is_completed }">
                  <div class="bracket-matchup">
                    <div class="bracket-team-block" :class="{ 'bracket-team-block--winner': finalSet2.winner_captain_id === finalSet2.team_a_captain_id }">
                      <span class="bracket-seed">1위</span>
                      <span class="bracket-team-name">{{ teamLabel(finalSet2.team_a_captain_id) }}</span>
                    </div>
                    <span class="bracket-vs">VS</span>
                    <div class="bracket-team-block bracket-team-block--right" :class="{ 'bracket-team-block--winner': finalSet2.winner_captain_id === finalSet2.team_b_captain_id }">
                      <span class="bracket-seed">준결승 승자</span>
                      <span class="bracket-team-name">{{ teamLabel(finalSet2.team_b_captain_id) }}</span>
                    </div>
                  </div>
                  <div class="bracket-meta">
                    <span v-if="finalSet2.match_date" class="bracket-date"><AppIcon name="calendar" :size="11" />{{ finalSet2.match_date.replaceAll('-', '/') }}</span>
                    <div class="bracket-actions">
                      <button v-if="!finalSet2.is_entry_revealed && bothSubmittedSet.has(finalSet2.id)" class="btn-pill btn-pill--sm btn-pill--green" @click="revealFinalSet(2)">엔트리 공개</button>
                      <span v-else-if="finalSet2.is_entry_revealed" class="badge-revealed"><AppIcon name="check" :size="10" /> 공개됨</span>
                      <button v-if="finalSet2.is_entry_revealed && isMatchDatePassed(finalSet2.match_date)" class="btn-pill btn-pill--sm btn-pill--blue" @click="goToResult(finalSet2.id)">결과 입력</button>
                      <button v-if="!finalSet2.is_completed && !bothSubmittedSet.has(finalSet2.id)" class="btn-pill btn-pill--sm btn-pill--ghost" @click="deleteFinalSet(2)">삭제</button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- 결과: 우승 or 슈퍼 에이스 -->
            <template v-if="finalSet1?.is_completed && finalSet2?.is_completed">
              <div v-if="finalWinner" class="champion-card">
                <span class="champion-icon">
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M9 2l1.4 4H15l-3.5 2.5 1.3 4L9 10.3 5.2 12.5l1.3-4L3 6h4.6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                    <path d="M5 16h8M7 17.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                  </svg>
                </span>
                <div>
                  <p class="champion-label">우승</p>
                  <p class="champion-team">{{ teamLabel(finalWinner) }}</p>
                </div>
              </div>

              <template v-else>
                <div class="final-set-block">
                  <div class="final-set-header">
                    <span class="final-set-label final-set-label--ace">슈퍼 에이스</span>
                    <span class="setup-hint">결승 1:1 동점</span>
                  </div>
                  <template v-if="!superAce">
                    <div v-if="excludedAceTiersSet1.length || excludedAceTiersSet2.length" class="ace-ban-summary">
                      <div v-if="excludedAceTiersSet1.length" class="ace-ban-row">
                        <span class="ace-ban-label">결승 1세트 밴</span>
                        <span class="ace-ban-tiers">
                          <span v-for="t in excludedAceTiersSet1" :key="t" class="ace-ban-chip">{{ t }}</span>
                        </span>
                      </div>
                      <div v-if="excludedAceTiersSet2.length" class="ace-ban-row">
                        <span class="ace-ban-label">결승 2세트 밴</span>
                        <span class="ace-ban-tiers">
                          <span v-for="t in excludedAceTiersSet2" :key="t" class="ace-ban-chip">{{ t }}</span>
                        </span>
                      </div>
                    </div>
                    <div class="setup-row">
                      <button class="btn-pill btn-pill--md btn-pill--amber btn-pill--filled" :disabled="creating" @click="createSuperAce">경기 생성</button>
                    </div>
                  </template>
                  <template v-else>
                    <div class="bracket-card" :class="{ 'bracket-card--done': superAce.is_completed }">
                      <div class="bracket-matchup">
                        <div class="bracket-team-block" :class="{ 'bracket-team-block--winner': superAce.winner_captain_id === superAce.team_a_captain_id }">
                          <span class="bracket-team-name">{{ teamLabel(superAce.team_a_captain_id) }}</span>
                        </div>
                        <span class="bracket-vs">VS</span>
                        <div class="bracket-team-block bracket-team-block--right" :class="{ 'bracket-team-block--winner': superAce.winner_captain_id === superAce.team_b_captain_id }">
                          <span class="bracket-team-name">{{ teamLabel(superAce.team_b_captain_id) }}</span>
                        </div>
                      </div>
                      <div class="bracket-meta">
                        <div class="bracket-actions">
                          <button v-if="isMatchDatePassed(superAce.match_date)" class="btn-pill btn-pill--sm btn-pill--blue" @click="goToResult(superAce.id)">결과 입력</button>
                          <button v-if="!superAce.is_completed" class="btn-pill btn-pill--sm btn-pill--ghost" @click="deleteSuperAce">삭제</button>
                        </div>
                      </div>
                    </div>
                    <div v-if="superAce.is_completed && superAce.winner_captain_id" class="champion-card">
                      <span class="champion-icon">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <path d="M9 2l1.4 4H15l-3.5 2.5 1.3 4L9 10.3 5.2 12.5l1.3-4L3 6h4.6L9 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>
                          <path d="M5 16h8M7 17.5h4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                        </svg>
                      </span>
                      <div>
                        <p class="champion-label">우승</p>
                        <p class="champion-team">{{ teamLabel(superAce.winner_captain_id) }}</p>
                      </div>
                    </div>
                  </template>
                </div>
              </template>
            </template>
          </template>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { getLeague, calculateStandings, allRegularMatchesDone, type LeagueRow } from '@/lib/leagues'
import { getCaptains } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import {
  getRegularSchedules,
  getPlayoffSchedules,
  createPlayoffMatch,
  deletePlayoffMatch,
  revealEntries,

  type ScheduleRow,
} from '@/lib/schedules'
import { getBothSubmittedSet, getAceTierBans } from '@/lib/entries'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

const theme = computed(() => document.documentElement.getAttribute('data-theme') ?? 'dark')

const loading = ref(true)
const pageError = ref<string | null>(null)
const creating = ref(false)
const league = ref<LeagueRow | null>(null)
const regularSchedules = ref<ScheduleRow[]>([])
const playoffSchedules = ref<ScheduleRow[]>([])

interface TeamInfo { captainId: number; nickname: string; teamName: string }
const teamMap = ref(new Map<number, TeamInfo>())
const captainIds = ref<number[]>([])

const semifinalDate = ref<Date | null>(null)
const finalDate = ref<Date | null>(null)
const finalDate2 = ref<Date | null>(null)
const bothSubmittedSet = ref(new Set<number>())

// ── 파생 ────────────────────────────────────────────────────
const regularAllDone = computed(() => allRegularMatchesDone(regularSchedules.value))
const standings = computed(() => calculateStandings(captainIds.value, regularSchedules.value))

const semifinal = computed(() => playoffSchedules.value.find(s => s.match_type === 'semifinal') ?? null)
const finalSet1 = computed(() => playoffSchedules.value.find(s => s.match_type === 'final_set1') ?? null)
const finalSet2 = computed(() => playoffSchedules.value.find(s => s.match_type === 'final_set2') ?? null)
const superAce = computed(() => playoffSchedules.value.find(s => s.match_type === 'super_ace') ?? null)

const semifinalWinner = computed(() => semifinal.value?.winner_captain_id ?? null)

// 결승 각 세트 승자
const set1Winner = computed(() => finalSet1.value?.winner_captain_id ?? null)
const set2Winner = computed(() => finalSet2.value?.winner_captain_id ?? null)

// 두 세트 다 완료되고 같은 팀이 2세트 모두 이겼을 때 우승자
const finalWinner = computed(() => {
  if (!finalSet1.value?.is_completed || !finalSet2.value?.is_completed) return null
  if (set1Winner.value && set1Winner.value === set2Winner.value) return set1Winner.value
  return null
})

// 슈퍼 에이스 시 제외할 티어 (1set, 2set 에결에서 나온 티어)
const excludedAceTiers = ref<string[]>([])
const excludedAceTiersSet1 = ref<string[]>([])
const excludedAceTiersSet2 = ref<string[]>([])

function teamLabel(captainId: number) {
  const t = teamMap.value.get(captainId)
  return t?.teamName || t?.nickname || `선수 ${captainId}`
}

function formatDate(d: Date | null): string {
  if (!d) return ''
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function isMatchDatePassed(matchDate: string | null): boolean {
  if (!matchDate) return false
  return matchDate <= today()
}

function toDateStr(d: Date | null): string | null {
  if (!d) return null
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function goToResult(matchId: number) {
  router.push({ name: 'league-match-slot-result', params: { id: leagueId, matchId } })
}

// ── 데이터 로드 ─────────────────────────────────────────────
async function loadData() {
  const [leagueData, captains, players, teamNames, regular, playoff] = await withTimeout(Promise.all([
    getLeague(leagueId),
    getCaptains(leagueId),
    getPlayers(),
    getTeamNames(leagueId),
    getRegularSchedules(leagueId),
    getPlayoffSchedules(leagueId),
  ]))
  league.value = leagueData
  regularSchedules.value = regular
  playoffSchedules.value = playoff
  captainIds.value = captains.map(c => c.player_id)

  const playerMap = new Map(players.map(p => [p.id, p]))
  const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))
  const map = new Map<number, TeamInfo>()
  captains.forEach(c => {
    const p = playerMap.get(c.player_id)
    map.set(c.player_id, {
      captainId: c.player_id,
      nickname: p?.nickname ?? `선수 ${c.player_id}`,
      teamName: nameMap.get(c.player_id) ?? '',
    })
  })
  teamMap.value = map

  bothSubmittedSet.value = await getBothSubmittedSet(playoff)

  // 슈퍼 에이스 제외 티어 계산
  await loadExcludedTiers(playoff)
}

async function loadExcludedTiers(playoff: ScheduleRow[]) {
  const set1 = playoff.find(s => s.match_type === 'final_set1')
  const set2 = playoff.find(s => s.match_type === 'final_set2')
  const bans1 = set1 ? (await getAceTierBans(set1.id)).map(b => b.tier_ban).filter(Boolean) as string[] : []
  const bans2 = set2 ? (await getAceTierBans(set2.id)).map(b => b.tier_ban).filter(Boolean) as string[] : []
  excludedAceTiersSet1.value = bans1
  excludedAceTiersSet2.value = bans2
  excludedAceTiers.value = [...new Set([...bans1, ...bans2])]
}

onMounted(async () => {
  try {
    await loadData()
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 준결승 ──────────────────────────────────────────────────
async function createSemifinal() {
  const rank2 = standings.value.find(s => s.rank === 2)
  const rank3 = standings.value.find(s => s.rank === 3)
  if (!rank2 || !rank3) return
  creating.value = true
  try {
    const row = await createPlayoffMatch(leagueId, 'semifinal', rank2.captainId, rank3.captainId, toDateStr(semifinalDate.value))
    playoffSchedules.value.push(row)
  } finally {
    creating.value = false
  }
}

async function deleteSemifinal() {
  if (!semifinal.value) return
  await deletePlayoffMatch(semifinal.value.id)
  playoffSchedules.value = playoffSchedules.value.filter(s => s.id !== semifinal.value!.id)
}

async function revealSemifinal() {
  if (!semifinal.value) return
  await revealEntries(semifinal.value.id)
  semifinal.value.is_entry_revealed = true
}

// ── 결승 ────────────────────────────────────────────────────
function getFinalTeams(): [number, number] {
  const rank1 = standings.value.find(s => s.rank === 1)!
  const winner = semifinalWinner.value!
  return [rank1.captainId, winner]
}

async function createFinalSet(set: 1 | 2) {
  if (!semifinalWinner.value) return
  const [teamA, teamB] = getFinalTeams()
  const dateStr = set === 1 ? toDateStr(finalDate.value) : toDateStr(finalDate2.value)
  creating.value = true
  try {
    const matchType = set === 1 ? 'final_set1' as const : 'final_set2' as const
    const row = await createPlayoffMatch(leagueId, matchType, teamA, teamB, dateStr)
    playoffSchedules.value.push(row)
  } finally {
    creating.value = false
  }
}

async function deleteFinalSet(set: 1 | 2) {
  const target = set === 1 ? finalSet1.value : finalSet2.value
  if (!target) return
  await deletePlayoffMatch(target.id)
  playoffSchedules.value = playoffSchedules.value.filter(s => s.id !== target.id)
}

async function revealFinalSet(set: 1 | 2) {
  const target = set === 1 ? finalSet1.value : finalSet2.value
  if (!target) return
  await revealEntries(target.id)
  target.is_entry_revealed = true
}

// ── 슈퍼 에이스 ─────────────────────────────────────────────
async function createSuperAce() {
  if (!finalSet1.value || !finalSet2.value) return
  const [teamA, teamB] = getFinalTeams()
  creating.value = true
  try {
    const row = await createPlayoffMatch(leagueId, 'super_ace', teamA, teamB, finalSet2.value.match_date)
    playoffSchedules.value.push(row)
  } finally {
    creating.value = false
  }
}

async function deleteSuperAce() {
  if (!superAce.value) return
  await deletePlayoffMatch(superAce.value.id)
  playoffSchedules.value = playoffSchedules.value.filter(s => s.id !== superAce.value!.id)
}
</script>

<style lang="scss" scoped>
@use './PlayoffsView.scss';
</style>
