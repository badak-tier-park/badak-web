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

              <!-- 중앙: 맵 정보 -->
              <div class="slot-center">
                <template v-if="slotMapStates.get(slot.num)?.type !== 'none'">
                  <div v-if="getResolvedMap(slot.num)" class="slot-map">
                    <div class="slot-map-thumb">
                      <img v-if="getResolvedMap(slot.num)?.thumbnail_url" :src="getResolvedMap(slot.num)!.thumbnail_url!" />
                      <div v-else class="slot-map-thumb-empty" />
                    </div>
                    <span class="slot-map-name">{{ getResolvedMap(slot.num)?.name }}</span>
                  </div>
                  <button
                    v-else-if="!isCompleted"
                    class="slot-ladder-btn"
                    @click="openLadder(slot.num)"
                  >
                    사다리타기
                  </button>
                </template>
              </div>

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

          <!-- 에이스 결정전 -->
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

              <div class="slot-center">
                <span class="slot-vs">VS</span>
              </div>

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

    <!-- 사다리타기 모달 -->
    <Teleport to="body">
      <div v-if="ladderSlot != null" class="ladder-overlay" @click.self="ladderSlot = null">
        <div class="ladder-modal">
          <div class="ladder-header">
            <span class="ladder-title">경기{{ ladderSlot }} 맵 선택</span>
            <button class="ladder-close" @click="ladderSlot = null">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="ladder-maps">
            <button
              v-for="m in slotMapStates.get(ladderSlot)?.candidateMaps"
              :key="m.id"
              class="ladder-map-btn"
              :class="{ 'ladder-map-btn--selected': ladderPickResult === m.id }"
              @click="ladderPickResult = m.id"
            >
              <div class="ladder-map-thumb">
                <img v-if="m.thumbnail_url" :src="m.thumbnail_url" />
                <div v-else class="ladder-map-thumb-empty" />
              </div>
              <span class="ladder-map-name">{{ m.name }}</span>
            </button>
          </div>
          <div class="ladder-actions">
            <button class="ladder-random-btn" :disabled="ladderPicking" @click="randomPick">
              {{ ladderPicking ? '선택 중...' : '랜덤 선택' }}
            </button>
            <button class="btn-cancel" @click="ladderSlot = null">취소</button>
            <button
              class="btn-complete ladder-confirm-btn"
              :disabled="!ladderPickResult || savingLadderMap"
              @click="confirmLadder"
            >
              {{ savingLadderMap ? '저장 중...' : '확정' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { getLeague } from '@/lib/leagues'
import { getCaptains, getMatchMaps } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import { getSchedules, getSlotResults, setSlotResult, setSlotMap, completeMatch, type ScheduleRow } from '@/lib/schedules'
import { getScheduleEntries } from '@/lib/entries'
import { getMaps } from '@/lib/maps'
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
const BAN_SLOTS = new Set([2, 3])
const TIER_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
const TIER_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }

interface TeamInfo {
  captainId: number
  nickname: string
  teamName: string
  tier: string
}

interface SlotPlayerInfo { id: number; nickname: string; tier: string; race: string }
interface SlotPlayers { teamA: SlotPlayerInfo[]; teamB: SlotPlayerInfo[] }
interface MapInfo { id: string; name: string; thumbnail_url: string | null }
interface SlotMapState {
  type: 'none' | 'fixed' | 'auto' | 'ladder'
  candidateMaps: MapInfo[]
}

const loading = ref(true)
const pageError = ref<string | null>(null)
const savingSlot = ref<number | null>(null)
const isCompleted = ref(false)
const completing = ref(false)
const completeError = ref<string | null>(null)

const schedule = ref<ScheduleRow | null>(null)
const teamA = ref<TeamInfo | null>(null)
const teamB = ref<TeamInfo | null>(null)
const slotWinners = ref(new Map<number, number>())
const slotPlayerMap = ref(new Map<number, SlotPlayers>())
const entryPointsA = ref(0)
const entryPointsB = ref(0)

// 맵 관련 상태
const allMapsById = ref(new Map<string, MapInfo>())
const matchMapConfig = ref(new Map<number, string[]>())
const entryBanMap = ref(new Map<number, Map<number, string | null>>())
const ladderSelectedMaps = ref(new Map<number, string>())

// 사다리타기 모달 상태
const ladderSlot = ref<number | null>(null)
const ladderPicking = ref(false)
const ladderPickResult = ref<string | null>(null)
const savingLadderMap = ref(false)

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

const showAce = computed(() => {
  if (score6A.value !== 3 || score6B.value !== 3) return false
  if (entryPointsA.value === 0 && entryPointsB.value === 0) return true
  return Math.abs(entryPointsA.value - entryPointsB.value) < 3
})

// ── 맵 배정 계산 ────────────────────────────────────────────────

function resolveSlotMap(slotNum: number): SlotMapState {
  const mapIds = matchMapConfig.value.get(slotNum) ?? []
  const maps = mapIds.map(id => allMapsById.value.get(id)).filter(Boolean) as MapInfo[]

  if (maps.length === 0) return { type: 'none', candidateMaps: [] }

  // 밴 없는 경기 (1, 4, 5, 6) 또는 맵이 1개뿐인 경우
  if (!BAN_SLOTS.has(slotNum) || maps.length === 1) {
    return { type: 'fixed', candidateMaps: maps }
  }

  // 밴 슬롯 (2, 3): 밴 결과 계산
  const captAId = schedule.value?.team_a_captain_id ?? 0
  const captBId = schedule.value?.team_b_captain_id ?? 0
  const banA = entryBanMap.value.get(captAId)?.get(slotNum) ?? null
  const banB = entryBanMap.value.get(captBId)?.get(slotNum) ?? null

  let candidates = [...maps]

  if (banA && banB) {
    if (banA === banB) {
      // 같은 맵 밴 → 1개 제거
      candidates = candidates.filter(m => m.id !== banA)
    } else {
      // 다른 맵 밴 → 양쪽 적용
      const afterBoth = candidates.filter(m => m.id !== banA && m.id !== banB)
      if (afterBoth.length === 0) {
        // 맵 없음 → 낮은 티어 팀의 밴 적용
        const rankA = TIER_RANK[(teamA.value?.tier ?? 'e').toUpperCase()] ?? 1
        const rankB = TIER_RANK[(teamB.value?.tier ?? 'e').toUpperCase()] ?? 1
        if (rankA === rankB) {
          // 동티어 → 원래 맵 전체로 사다리타기
          candidates = maps
        } else {
          const effectiveBan = rankA <= rankB ? banA : banB
          candidates = candidates.filter(m => m.id !== effectiveBan)
        }
      } else {
        candidates = afterBoth
      }
    }
  } else if (banA) {
    candidates = candidates.filter(m => m.id !== banA)
  } else if (banB) {
    candidates = candidates.filter(m => m.id !== banB)
  }

  if (candidates.length === 0) return { type: 'none', candidateMaps: [] }
  if (candidates.length === 1) return { type: 'auto', candidateMaps: candidates }
  return { type: 'ladder', candidateMaps: candidates }
}

const slotMapStates = computed(() => {
  const result = new Map<number, SlotMapState>()
  for (const slot of REGULAR_SLOTS) {
    result.set(slot.num, resolveSlotMap(slot.num))
  }
  return result
})

function getResolvedMap(slotNum: number): MapInfo | null {
  const state = slotMapStates.value.get(slotNum)
  if (!state || state.type === 'none') return null
  if (state.type === 'ladder') {
    const selectedId = ladderSelectedMaps.value.get(slotNum)
    return selectedId ? (allMapsById.value.get(selectedId) ?? null) : null
  }
  return state.candidateMaps[0] ?? null
}

// ── 사다리타기 ──────────────────────────────────────────────────

function openLadder(slotNum: number) {
  ladderSlot.value = slotNum
  ladderPickResult.value = ladderSelectedMaps.value.get(slotNum) ?? null
}

function randomPick() {
  if (ladderPicking.value) return
  ladderPicking.value = true
  ladderPickResult.value = null

  const candidates = slotMapStates.value.get(ladderSlot.value!)?.candidateMaps ?? []
  if (candidates.length === 0) { ladderPicking.value = false; return }

  let count = 0
  const totalFlashes = 10 + Math.floor(Math.random() * 8)
  const interval = setInterval(() => {
    ladderPickResult.value = candidates[Math.floor(Math.random() * candidates.length)].id
    count++
    if (count >= totalFlashes) {
      clearInterval(interval)
      ladderPicking.value = false
    }
  }, 80)
}

async function confirmLadder() {
  if (!ladderSlot.value || !ladderPickResult.value) return
  savingLadderMap.value = true
  try {
    await setSlotMap(matchId, ladderSlot.value, ladderPickResult.value)
    const newMap = new Map(ladderSelectedMaps.value)
    newMap.set(ladderSlot.value, ladderPickResult.value)
    ladderSelectedMaps.value = newMap
    ladderSlot.value = null
  } catch (e: any) {
    console.error(e)
  } finally {
    savingLadderMap.value = false
  }
}

// ── 데이터 로딩 ─────────────────────────────────────────────────

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames, schedules, slotResults, entries, matchMapsData, allMapsData] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
      getSchedules(leagueId),
      getSlotResults(matchId),
      getScheduleEntries(matchId),
      getMatchMaps(leagueId),
      getMaps(),
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

    // 슬롯별 선수 맵
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

    // 팀별 총 포인트
    const calcPoints = (captainId: number) =>
      entries
        .filter(e => e.captain_player_id === captainId)
        .flatMap(e => e.player_ids)
        .reduce((sum, pid) => sum + (TIER_POINTS[(playerMap.get(pid)?.tier ?? 'e').toUpperCase()] ?? 1), 0)
    entryPointsA.value = calcPoints(match.team_a_captain_id)
    entryPointsB.value = calcPoints(match.team_b_captain_id)

    // 맵 데이터
    const mapsById = new Map<string, MapInfo>()
    for (const m of allMapsData) {
      mapsById.set(m.id, { id: m.id, name: m.name, thumbnail_url: m.thumbnail_url })
    }
    allMapsById.value = mapsById

    const mmConfig = new Map<number, string[]>()
    for (const mm of matchMapsData) {
      mmConfig.set(mm.match_number, mm.map_ids)
    }
    matchMapConfig.value = mmConfig

    // 엔트리 밴 맵
    const banMap = new Map<number, Map<number, string | null>>()
    for (const e of entries) {
      if (!banMap.has(e.captain_player_id)) banMap.set(e.captain_player_id, new Map())
      banMap.get(e.captain_player_id)!.set(e.match_slot, e.banned_map_id)
    }
    entryBanMap.value = banMap

    // 사다리타기 기선택 맵
    const ladderMap = new Map<number, string>()
    for (const r of slotResults) {
      if (r.selected_map_id) ladderMap.set(r.slot_num, r.selected_map_id)
    }
    ladderSelectedMaps.value = ladderMap

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
