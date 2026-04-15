<template>
  <div class="slot-result-page">
    <AppHeader />

    <div class="slot-result-content">
      <button class="btn-back" @click="$router.push({ name: 'league-schedule', params: { id: leagueId } })">
        <AppIcon name="chevron-left" :size="13" />
        경기 관리
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <!-- 헤더 -->
        <div class="match-info">
          <div class="match-info-title">경기 결과 입력</div>
          <div class="match-info-teams">
            <div class="match-team-col">
              <span class="match-team-badge" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                {{ teamA?.teamName || teamA?.nickname }}
              </span>
              <span v-if="entryPointsA > 0" class="match-team-pts">{{ entryPointsA }}pt</span>
            </div>
            <div class="match-score-col">
              <span class="match-score">{{ scoreA }} : {{ scoreB }}</span>
              <div v-if="schedule?.match_date" class="match-info-date">
                {{ schedule.match_date.replaceAll('-', '/') }}
              </div>
            </div>
            <div class="match-team-col match-team-col--right">
              <span class="match-team-badge" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                {{ teamB?.teamName || teamB?.nickname }}
              </span>
              <span v-if="entryPointsB > 0" class="match-team-pts">{{ entryPointsB }}pt</span>
            </div>
          </div>
        </div>

        <!-- 슬롯별 결과 -->
        <div class="slot-list">
          <div
            v-for="slot in REGULAR_SLOTS"
            :key="slot.num"
            class="slot-row"
            :class="{ 'slot-row--done': slotWinners.get(slot.num) != null }"
          >
            <div class="slot-label">
              <span class="slot-num">경기{{ slot.num }}</span>
              <span class="slot-type" :class="slot.type === 'team' ? 'slot-type--team' : ''">
                {{ slot.type === 'team' ? '팀전' : '개인전' }}
              </span>
            </div>

            <div class="slot-teams">
              <button
                class="slot-team-btn"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(slot.num) === schedule!.team_a_captain_id,
                  'slot-team-btn--loser': slotWinners.get(slot.num) != null && slotWinners.get(slot.num) !== schedule!.team_a_captain_id,
                  'slot-team-btn--saving': savingSlot === slot.num,
                }"
                :disabled="savingSlot === slot.num || isCompleted"
                @click="toggleWinner(slot.num, schedule!.team_a_captain_id)"
              >
                <div class="slot-players">
                  <template v-if="slotPlayerMap.get(slot.num)?.teamA?.length">
                    <div v-for="p in slotPlayerMap.get(slot.num)!.teamA" :key="p.id" class="slot-player-row">
                      <span v-if="p.race" class="slot-race" :class="`race-badge--${p.race.toLowerCase()}`">{{ p.race.toUpperCase() }}</span>
                      <span class="slot-player-name" :class="`tier-badge--${p.tier.toLowerCase()}`">{{ p.nickname }}</span>
                    </div>
                  </template>
                  <span v-else class="slot-team-name" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                    {{ teamA?.teamName || teamA?.nickname }}
                  </span>
                </div>
                <span v-if="slotWinners.get(slot.num) === schedule!.team_a_captain_id" class="win-badge">WIN</span>
              </button>

              <span class="slot-vs">VS</span>

              <button
                class="slot-team-btn slot-team-btn--right"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(slot.num) === schedule!.team_b_captain_id,
                  'slot-team-btn--loser': slotWinners.get(slot.num) != null && slotWinners.get(slot.num) !== schedule!.team_b_captain_id,
                  'slot-team-btn--saving': savingSlot === slot.num,
                }"
                :disabled="savingSlot === slot.num || isCompleted"
                @click="toggleWinner(slot.num, schedule!.team_b_captain_id)"
              >
                <span v-if="slotWinners.get(slot.num) === schedule!.team_b_captain_id" class="win-badge">WIN</span>
                <div class="slot-players">
                  <template v-if="slotPlayerMap.get(slot.num)?.teamB?.length">
                    <div v-for="p in slotPlayerMap.get(slot.num)!.teamB" :key="p.id" class="slot-player-row slot-player-row--right">
                      <span class="slot-player-name" :class="`tier-badge--${p.tier.toLowerCase()}`">{{ p.nickname }}</span>
                      <span v-if="p.race" class="slot-race" :class="`race-badge--${p.race.toLowerCase()}`">{{ p.race.toUpperCase() }}</span>
                    </div>
                  </template>
                  <span v-else class="slot-team-name" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                    {{ teamB?.teamName || teamB?.nickname }}
                  </span>
                </div>
              </button>
            </div>
          </div>
          <!-- 에이스 결정전: 6경기 3:3이고 포인트 차이 3 미만일 때만 노출 -->
          <div
            v-if="showAce"
            class="slot-row"
            :class="{ 'slot-row--done': slotWinners.get(ACE_SLOT.num) != null }"
          >
            <div class="slot-label">
              <span class="slot-num">에이스</span>
              <span class="slot-type">결정전</span>
            </div>

            <div class="slot-teams">
              <button
                class="slot-team-btn"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(ACE_SLOT.num) === schedule!.team_a_captain_id,
                  'slot-team-btn--loser': slotWinners.get(ACE_SLOT.num) != null && slotWinners.get(ACE_SLOT.num) !== schedule!.team_a_captain_id,
                  'slot-team-btn--saving': savingSlot === ACE_SLOT.num,
                }"
                :disabled="savingSlot === ACE_SLOT.num || isCompleted"
                @click="toggleWinner(ACE_SLOT.num, schedule!.team_a_captain_id)"
              >
                <span class="slot-team-name" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                  {{ teamA?.teamName || teamA?.nickname }}
                </span>
                <span v-if="slotWinners.get(ACE_SLOT.num) === schedule!.team_a_captain_id" class="win-badge">WIN</span>
              </button>

              <span class="slot-vs">VS</span>

              <button
                class="slot-team-btn slot-team-btn--right"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(ACE_SLOT.num) === schedule!.team_b_captain_id,
                  'slot-team-btn--loser': slotWinners.get(ACE_SLOT.num) != null && slotWinners.get(ACE_SLOT.num) !== schedule!.team_b_captain_id,
                  'slot-team-btn--saving': savingSlot === ACE_SLOT.num,
                }"
                :disabled="savingSlot === ACE_SLOT.num || isCompleted"
                @click="toggleWinner(ACE_SLOT.num, schedule!.team_b_captain_id)"
              >
                <span v-if="slotWinners.get(ACE_SLOT.num) === schedule!.team_b_captain_id" class="win-badge">WIN</span>
                <span class="slot-team-name" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                  {{ teamB?.teamName || teamB?.nickname }}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div class="match-result-footer">
          <p v-if="completeError" class="complete-error">{{ completeError }}</p>
          <span v-if="isCompleted" class="badge-completed">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            경기 종료
          </span>
          <button
            v-else
            class="btn-complete"
            :disabled="completing || savingSlot != null"
            @click="handleComplete"
          >
            {{ completing ? '저장 중...' : '저장' }}
          </button>
        </div>

      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { getLeague } from '@/lib/leagues'
import { getCaptains } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import { getSchedules, getSlotResults, setSlotResult, completeMatch, type ScheduleRow } from '@/lib/schedules'
import { getScheduleEntries } from '@/lib/entries'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const leagueId = route.params.id as string
const matchId = Number(route.params.matchId)

const REGULAR_SLOTS = [
  { num: 1, type: 'individual' },
  { num: 2, type: 'individual' },
  { num: 3, type: 'individual' },
  { num: 4, type: 'team' },
  { num: 5, type: 'individual' },
  { num: 6, type: 'individual' },
] as const

const ACE_SLOT = { num: 7, type: 'ace' } as const

const TIER_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }

interface TeamInfo {
  captainId: number
  nickname: string
  teamName: string
  tier: string
}

const loading = ref(true)
const pageError = ref<string | null>(null)
const savingSlot = ref<number | null>(null)
const isCompleted = ref(false)
const completing = ref(false)
const completeError = ref<string | null>(null)

interface SlotPlayerInfo { id: number; nickname: string; tier: string; race: string }
interface SlotPlayers { teamA: SlotPlayerInfo[]; teamB: SlotPlayerInfo[] }

const schedule = ref<ScheduleRow | null>(null)
const teamA = ref<TeamInfo | null>(null)
const teamB = ref<TeamInfo | null>(null)
const slotWinners = ref(new Map<number, number>())
const slotPlayerMap = ref(new Map<number, SlotPlayers>())
const entryPointsA = ref(0)
const entryPointsB = ref(0)

// 1~6경기 스코어
const score6A = computed(() =>
  [...slotWinners.value.entries()].filter(([s, w]) => s !== ACE_SLOT.num && w === schedule.value?.team_a_captain_id).length
)
const score6B = computed(() =>
  [...slotWinners.value.entries()].filter(([s, w]) => s !== ACE_SLOT.num && w === schedule.value?.team_b_captain_id).length
)

// 전체 스코어 (에이스 포함)
const scoreA = computed(() =>
  [...slotWinners.value.entries()].filter(([, w]) => w === schedule.value?.team_a_captain_id).length
)
const scoreB = computed(() =>
  [...slotWinners.value.entries()].filter(([, w]) => w === schedule.value?.team_b_captain_id).length
)

// 3:3이고 포인트 차이가 3 미만일 때 에이스 결정전 진행
const showAce = computed(() => {
  if (score6A.value !== 3 || score6B.value !== 3) return false
  if (entryPointsA.value === 0 && entryPointsB.value === 0) return true  // 엔트리 없으면 기본 진행
  return Math.abs(entryPointsA.value - entryPointsB.value) < 3
})

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames, schedules, slotResults, entries] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
      getSchedules(leagueId),
      getSlotResults(matchId),
      getScheduleEntries(matchId),
    ]))

    void leagueData

    const match = schedules.find(s => s.id === matchId)
    if (!match) throw new Error('경기를 찾을 수 없습니다.')
    schedule.value = match
    isCompleted.value = match.is_completed

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))

    const makeTeam = (captainId: number): TeamInfo => {
      const p = playerMap.get(captainId)
      return {
        captainId,
        nickname: p?.nickname ?? `선수 ${captainId}`,
        teamName: nameMap.get(captainId) ?? '',
        tier: p?.tier ?? 'e',
      }
    }

    const captainIds = captains.map(c => c.player_id)
    if (captainIds.includes(match.team_a_captain_id)) teamA.value = makeTeam(match.team_a_captain_id)
    if (captainIds.includes(match.team_b_captain_id)) teamB.value = makeTeam(match.team_b_captain_id)

    const winnerMap = new Map<number, number>()
    for (const r of slotResults) {
      if (r.winner_captain_id != null) winnerMap.set(r.slot_num, r.winner_captain_id)
    }
    slotWinners.value = winnerMap

    // 슬롯별 선수 맵 구성 (엔트리 공개된 경우에만 데이터 있음)
    const toInfo = (id: number): SlotPlayerInfo => {
      const p = playerMap.get(id)
      return { id, nickname: p?.nickname ?? `선수${id}`, tier: p?.tier ?? 'e', race: p?.race ?? '' }
    }
    const aEntries = entries.filter(e => e.captain_player_id === match.team_a_captain_id)
    const bEntries = entries.filter(e => e.captain_player_id === match.team_b_captain_id)
    const spMap = new Map<number, SlotPlayers>()
    const allSlots = new Set([...aEntries.map(e => e.match_slot), ...bEntries.map(e => e.match_slot)])
    for (const slotNum of allSlots) {
      const aSlot = aEntries.find(e => e.match_slot === slotNum)
      const bSlot = bEntries.find(e => e.match_slot === slotNum)
      spMap.set(slotNum, {
        teamA: (aSlot?.player_ids ?? []).map(toInfo),
        teamB: (bSlot?.player_ids ?? []).map(toInfo),
      })
    }
    slotPlayerMap.value = spMap

    // 팀별 총 포인트 계산 (슬롯 1~6)
    const calcPoints = (captainId: number) =>
      entries
        .filter(e => e.captain_player_id === captainId)
        .flatMap(e => e.player_ids)
        .reduce((sum, pid) => sum + (TIER_POINTS[(playerMap.get(pid)?.tier ?? 'e').toUpperCase()] ?? 1), 0)
    entryPointsA.value = calcPoints(match.team_a_captain_id)
    entryPointsB.value = calcPoints(match.team_b_captain_id)
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

async function handleComplete() {
  completing.value = true
  completeError.value = null
  try {
    const winner = scoreA.value > scoreB.value
      ? schedule.value!.team_a_captain_id
      : scoreB.value > scoreA.value
        ? schedule.value!.team_b_captain_id
        : null
    await completeMatch(matchId, winner)
    isCompleted.value = true
  } catch (e: any) {
    completeError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    completing.value = false
  }
}

async function toggleWinner(slotNum: number, captainId: number) {
  if (savingSlot.value != null) return
  const current = slotWinners.value.get(slotNum)
  const next = current === captainId ? null : captainId

  savingSlot.value = slotNum
  try {
    await setSlotResult(matchId, slotNum, next)
    const map = new Map(slotWinners.value)
    if (next == null) map.delete(slotNum)
    else map.set(slotNum, next)
    slotWinners.value = map
  } catch (e: any) {
    console.error(e)
  } finally {
    savingSlot.value = null
  }
}
</script>

<style lang="scss" scoped>
@use './MatchSlotResultView.scss';
</style>
