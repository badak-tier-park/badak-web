<template>
  <Teleport to="body">
    <div class="reveal-overlay">
      <div class="reveal-modal">
        <div class="reveal-header">
          <div>
            <p class="reveal-title">{{ showResults ? '경기 결과' : '엔트리 확인' }}</p>
            <p class="reveal-subtitle">
              {{ roundLabel }}
              <template v-if="matchDate"> · {{ matchDate.replaceAll('-', '/') }}</template>
            </p>
          </div>
          <button class="reveal-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="reveal-body">
          <div v-if="loading" class="reveal-state">불러오는 중...</div>
          <div v-else-if="loadError" class="reveal-state reveal-state--error">{{ loadError }}</div>

          <template v-else>
            <!-- 머리줄: 팀A 점수 팀B + 각 팀 엔트리 포인트 (관리자 경기 결과 입력과 같은 모양) -->
            <div class="match-info-teams reveal-head">
              <div class="match-team-col">
                <span class="match-team-badge" :class="teamHeadClass('A')">
                  <span class="reveal-team-name">{{ teamAName }}</span>
                  <span v-if="isMatchWinner('A')" class="reveal-win-crown">👑</span>
                </span>
                <span class="match-team-pts">{{ totalPoints(teamACaptainId) }}pt</span>
              </div>
              <div class="match-score-col">
                <span v-if="showResults" class="match-score">{{ scoreA }} : {{ scoreB }}</span>
                <span v-else class="reveal-vs">VS</span>
                <span v-if="showResults && tieBreakWinner" class="reveal-tiebreak-note">포인트 룰</span>
                <span v-if="showResults" class="reveal-match-points">승점 {{ matchPointsA }} : {{ matchPointsB }}</span>
              </div>
              <div class="match-team-col match-team-col--right">
                <span class="match-team-badge" :class="teamHeadClass('B')">
                  <span class="reveal-team-name">{{ teamBName }}</span>
                  <span v-if="isMatchWinner('B')" class="reveal-win-crown">👑</span>
                </span>
                <span class="match-team-pts">{{ totalPoints(teamBCaptainId) }}pt</span>
              </div>
            </div>

            <!-- 경기마다 한 줄: 경기명 | 팀A 선수 | 작은 맵 | 팀B 선수 -->
            <div class="slot-list">
              <div v-for="slot in SLOT_CONFIG" :key="slot.num" class="slot-row reveal-slot-row">
                <div class="slot-label">
                  <span class="slot-num">경기{{ slot.num }}</span>
                  <span class="slot-type" :class="slot.type === 'team' ? 'slot-type--team' : ''">
                    {{ slot.type === 'team' ? '팀전' : '개인전' }}
                  </span>
                </div>

                <div class="slot-teams">
                  <template v-for="side in SIDES" :key="side">
                    <div
                      class="slot-team-cell"
                      :class="[side === 'A' ? 'slot-team-cell--a' : 'slot-team-cell--b', slotCellClass(slot.num, side)]"
                      :data-team="teamName(side)"
                    >
                      <div class="slot-players">
                        <div v-for="(pid, pidIdx) in getSlotPlayerIds(captainOf(side), slot.num)" :key="pidIdx" class="slot-player-row">
                          <span class="slot-player-name">{{ playerName(pid) }}</span>
                          <RaceBadge :race="playerRace(pid)" :random="slot.type === 'team' && isRandomPlayer(captainOf(side), slot.num, pid)" size="sm" />
                          <TierBadge :tier="playerTier(pid)" size="sm" />
                          <HpBadge v-if="slot.type !== 'team' && pidIdx === 0 && hpBadge(slot.num, side)" :label="hpBadge(slot.num, side)!" :tip="hpTitle(slot.num)" />
                          <span v-if="isSubstituted(captainOf(side), slot.num, pidIdx)" class="rse-sub-badge">대체</span>
                          <span class="reveal-pt">{{ playerPt(pid) }}pt</span>
                        </div>
                        <span v-if="slot.type === 'team' && getSlotPlayerIds(captainOf(side), slot.num).length" class="reveal-slot-total">
                          합계 {{ slotTotal(captainOf(side), slot.num) }}pt
                        </span>
                      </div>
                      <span v-if="showResults && slotWinner(slot.num) === captainOf(side)" class="win-tag">WIN</span>
                    </div>

                    <!-- 가운데(팀A 칸 다음): 확정 맵 / 사다리타기 / 맵 없음. 밴·픽은 작은 버튼으로 펼친다 -->
                    <div v-if="side === 'A'" class="slot-center">
                      <template v-if="slotMapRows[slot.num]?.length">
                        <template v-if="slotMapResults[slot.num].isUndecided">
                          <span class="reveal-ladder-chip">사다리타기</span>
                          <span class="slot-map-name reveal-candidates">{{ candidateNames(slot.num) }}</span>
                        </template>
                        <div v-else-if="resolvedMap(slot.num)" class="slot-map">
                          <div class="slot-map-thumb">
                            <img v-if="resolvedMap(slot.num)!.thumbnail_url" :src="resolvedMap(slot.num)!.thumbnail_url!" alt="" />
                            <div v-else class="slot-map-thumb-empty" />
                          </div>
                          <span class="slot-map-name">{{ resolvedMap(slot.num)!.name }}</span>
                        </div>
                        <span v-else class="slot-vs">vs</span>
                        <button
                          v-if="!showResults && hasBanPick(slot.num)"
                          type="button"
                          class="reveal-banpick-btn"
                          :aria-expanded="expandedBanSlots.includes(slot.num)"
                          @click="toggleBanInfo(slot.num)"
                        >밴·픽 {{ expandedBanSlots.includes(slot.num) ? '▴' : '▾' }}</button>
                      </template>
                      <span v-else class="slot-vs">vs</span>
                    </div>
                  </template>
                </div>

                <!-- 밴·픽 상세 (엔트리 확인) — 줄 아래 작은 글자 -->
                <div v-if="!showResults && expandedBanSlots.includes(slot.num)" class="reveal-banpick">
                  <span v-for="ban in slotMapResults[slot.num].bannedMapInfo" :key="`ban-${ban.mapId}`" class="reveal-banpick-item">
                    <span class="reveal-banpick-kind reveal-banpick-kind--ban">밴</span>
                    <span class="reveal-banpick-map">{{ getMapInfo(slot.num, ban.mapId)?.name }}</span>
                    <span class="reveal-banpick-by">{{ byTeams(ban) }}</span>
                  </span>
                  <span
                    v-for="pick in slotMapResults[slot.num].pickedMapInfo"
                    :key="`pick-${pick.mapId}-${pick.byTeamA}-${pick.byTeamB}`"
                    class="reveal-banpick-item"
                  >
                    <span class="reveal-banpick-kind reveal-banpick-kind--pick">픽</span>
                    <span class="reveal-banpick-map">{{ getMapInfo(slot.num, pick.mapId)?.name }}</span>
                    <span class="reveal-banpick-by">{{ byTeams(pick) }}</span>
                  </span>
                </div>
              </div>

              <!-- 에이스 결정전 (경기 결과: 실제로 치렀을 때만) -->
              <div v-if="showResults && acePlayed" class="slot-row reveal-slot-row">
                <div class="slot-label">
                  <span class="slot-num">에결</span>
                  <span class="slot-type slot-type--team">에이스</span>
                </div>
                <div class="slot-teams">
                  <template v-for="side in SIDES" :key="side">
                    <div
                      class="slot-team-cell"
                      :class="[side === 'A' ? 'slot-team-cell--a' : 'slot-team-cell--b', slotCellClass(7, side)]"
                      :data-team="teamName(side)"
                    >
                      <div class="slot-players">
                        <div v-if="acePlayerOf(side)" class="slot-player-row">
                          <span class="slot-player-name">{{ playerName(acePlayerOf(side)!) }}</span>
                          <RaceBadge :race="playerRace(acePlayerOf(side)!)" size="sm" />
                          <TierBadge :tier="playerTier(acePlayerOf(side)!)" size="sm" />
                          <span class="reveal-pt">{{ playerPt(acePlayerOf(side)!) }}pt</span>
                        </div>
                      </div>
                      <span v-if="slotWinner(7) === captainOf(side)" class="win-tag">WIN</span>
                    </div>
                    <div v-if="side === 'A'" class="slot-center">
                      <span v-if="aceSlotResult?.ace_tier" class="reveal-ace-tier" :class="`tier-badge--${$tierClass(aceSlotResult.ace_tier)}`">{{ aceSlotResult.ace_tier }} 티어</span>
                      <span v-else class="reveal-ladder-chip">티어 사다리타기</span>
                      <div v-if="aceMap" class="slot-map">
                        <div class="slot-map-thumb">
                          <img v-if="aceMap.thumbnail_url" :src="aceMap.thumbnail_url" alt="" />
                          <div v-else class="slot-map-thumb-empty" />
                        </div>
                        <span class="slot-map-name">{{ aceMap.name }}</span>
                      </div>
                    </div>
                  </template>
                </div>
              </div>
            </div>

            <!-- 에결 티어(경기 시작 때 사다리) — 결과 모드에서 에결 줄이 따로 보이면 생략 -->
            <div v-if="showAceTierLine" class="reveal-ace-tier-line">
              <span class="reveal-ace-bans-title">에이스 결정전</span>
              <template v-if="aceSlotResult?.ace_tier">
                <span class="reveal-ace-tier" :class="`tier-badge--${$tierClass(aceSlotResult.ace_tier)}`">{{ aceSlotResult.ace_tier }} 티어</span>
                <span v-if="aceMap" class="reveal-ace-tier-map">
                  <span class="slot-map-thumb reveal-ace-tier-thumb">
                    <img v-if="aceMap.thumbnail_url" :src="aceMap.thumbnail_url" alt="" />
                  </span>
                  {{ aceMap.name }}
                </span>
              </template>
              <span v-else class="reveal-ace-bans-none">티어 사다리 전</span>
            </div>

            <!-- 에결 티어 밴 (팀당 2개, 이전 경기는 1개) — 맨 아래 한 줄 -->
            <div v-if="aceTierBansA.length || aceTierBansB.length" class="reveal-ace-bans">
              <span class="reveal-ace-bans-title">에결 티어 밴</span>
              <span v-for="side in SIDES" :key="side" class="reveal-ace-bans-team">
                <span class="reveal-ace-bans-name">{{ teamName(side) }}</span>
                <template v-if="aceBansOf(side).length">
                  <TierBadge v-for="t in aceBansOf(side)" :key="t" :tier="t" size="sm" />
                </template>
                <span v-else class="reveal-ace-bans-none">없음</span>
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getScheduleEntries, TIER_POINTS, getAceTierBans, aceBanTiers, calcEntryPoints, pointTiebreakWinner, isAceSkippedByPoints, INDIVIDUAL_SLOTS, TEAM_SLOT, type EntryRecord } from '@/lib/entries'
import { tierPoint } from '@/lib/constants'
import { getMatchMaps, getLeaguePlayers } from '@/lib/leagueDetail'
import { getMaps } from '@/lib/maps'
import { getLeague, MATCH_SLOT_POINTS } from '@/lib/leagues'
import { isHandicapMatch, slotHandicap, type HandicapRow } from '@/lib/handicap'
import TierBadge from '@/components/TierBadge.vue'
import RaceBadge from '@/components/RaceBadge.vue'
import HpBadge from '@/components/HpBadge.vue'
import { type PlayerRow } from '@/lib/players'
import { getSlotResults, type SlotResult } from '@/lib/schedules'
import { withTimeout } from '@/lib/supabase'

const props = withDefaults(defineProps<{
  scheduleId: number
  round: number
  matchType?: string
  matchDate: string | null
  leagueId: string
  teamACaptainId: number
  teamBCaptainId: number
  teamAName: string
  teamBName: string
  showResults?: boolean
}>(), { showResults: false, matchType: 'regular' })

const roundLabel = computed(() => {
  const labels: Record<string, string> = {
    semifinal: '준결승',
    final_set1: '결승 1세트',
    final_set2: '결승 2세트',
    super_ace: '슈퍼에이스',
  }
  return labels[props.matchType ?? ''] ?? `${props.round}라운드`
})

defineEmits<{ close: [] }>()

const SLOT_CONFIG = [
  { num: 1, type: 'individual' },
  { num: 2, type: 'individual' },
  { num: 3, type: 'individual' },
  { num: 4, type: 'team' },
  { num: 5, type: 'individual' },
  { num: 6, type: 'individual' },
] as const

const loading = ref(true)
const loadError = ref<string | null>(null)

interface MapInfo { id: string; name: string; thumbnail_url: string | null }

const entriesMap = ref(new Map<number, Map<number, EntryRecord>>())
const playerMap = ref(new Map<number, PlayerRow>())
const slotMapRows = ref<Record<number, MapInfo[]>>({})
const slotWinners = ref(new Map<number, number>())
// showResults 모드에서 사다리타기로 확정된 맵 (slot_num → map_id)
const slotSelectedMaps = ref(new Map<number, string>())
// 슬롯별 선수 대체 정보 (slot_num → { teamA, teamB } — 각 배열은 원본 인덱스 순서)
const slotSubs = ref(new Map<number, { teamA: number[] | null; teamB: number[] | null }>())

// 에이스 결정전
const aceSlotResult = ref<SlotResult | null>(null)
// 팀당 밴 티어 목록 — 2026-11-22부터 2개, 이전 경기는 1개(tier_ban2 null)
const aceTierBansA = ref<string[]>([])
const aceTierBansB = ref<string[]>([])
const allMapsById = ref(new Map<string, MapInfo>())
const aceSkipGap = ref<number | null>(null)
const handicapGap = ref<number | null>(null)
const handicapTable = ref<HandicapRow[] | null>(null)

onMounted(async () => {
  try {
    const [entries, players, matchMaps, allMaps, slotResultsData, aceTierBans, league] = await withTimeout(Promise.all([
      getScheduleEntries(props.scheduleId),
      getLeaguePlayers(props.leagueId),
      getMatchMaps(props.leagueId),
      getMaps(),
      // 엔트리 확인 모드도 에결 티어(경기 시작 때 사다리로 정함)를 보여 주려고 읽는다.
      // 못 읽어도 엔트리 확인은 되게 실패는 무시한다
      props.showResults
        ? getSlotResults(props.scheduleId)
        : getSlotResults(props.scheduleId).catch(() => [] as SlotResult[]),
      getAceTierBans(props.scheduleId),
      getLeague(props.leagueId),
    ]))

    aceSkipGap.value = league.ace_skip_point_gap ?? null
    handicapGap.value = league.handicap_point_gap ?? null
    handicapTable.value = league.handicap_table ?? null
    playerMap.value = new Map(players.map(p => [p.id, p]))

    const mapInfoMap = new Map<string, MapInfo>(allMaps.map(m => [m.id, { id: m.id, name: m.name, thumbnail_url: m.thumbnail_url ?? null }]))
    allMapsById.value = mapInfoMap

    const smr: Record<number, MapInfo[]> = {}
    for (const mm of matchMaps) {
      smr[mm.match_number] = mm.map_ids.map(id => {
        const m = mapInfoMap.get(id)
        return { id, name: m?.name ?? id, thumbnail_url: m?.thumbnail_url ?? null }
      })
    }
    slotMapRows.value = smr

    const em = new Map<number, Map<number, EntryRecord>>()
    for (const e of entries) {
      if (!em.has(e.captain_player_id)) em.set(e.captain_player_id, new Map())
      em.get(e.captain_player_id)!.set(e.match_slot, e)
    }
    entriesMap.value = em

    // 에이스 티어 밴
    const banForA = aceTierBans.find(b => b.captain_player_id === props.teamACaptainId)
    const banForB = aceTierBans.find(b => b.captain_player_id === props.teamBCaptainId)
    aceTierBansA.value = aceBanTiers(banForA)
    aceTierBansB.value = aceBanTiers(banForB)

    // 엔트리 확인 모드: 에결 티어·맵만 쓴다(승패·대타는 결과 모드에서만 반영)
    if (!props.showResults) {
      aceSlotResult.value = slotResultsData.find(r => r.slot_num === 7) ?? null
    }

    // 슬롯 결과 (showResults 모드)
    if (props.showResults && slotResultsData.length) {
      const wm = new Map<number, number>()
      const sm = new Map<number, string>()
      const subs = new Map<number, { teamA: number[] | null; teamB: number[] | null }>()
      for (const r of slotResultsData) {
        if (r.winner_captain_id != null) wm.set(r.slot_num, r.winner_captain_id)
        if (r.selected_map_id) sm.set(r.slot_num, r.selected_map_id)
        if (r.slot_num === 7) aceSlotResult.value = r
        if (r.sub_player_a_ids || r.sub_player_b_ids) {
          subs.set(r.slot_num, { teamA: r.sub_player_a_ids, teamB: r.sub_player_b_ids })
        }
      }
      slotWinners.value = wm
      slotSelectedMaps.value = sm
      slotSubs.value = subs
    }
  } catch (e: any) {
    loadError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

function getEntry(captainId: number, slotNum: number): EntryRecord | undefined {
  return entriesMap.value.get(captainId)?.get(slotNum)
}

function getSlotPlayerIds(captainId: number, slotNum: number): number[] {
  const original = getEntry(captainId, slotNum)?.player_ids ?? []
  const sub = slotSubs.value.get(slotNum)
  if (!sub) return original
  const isTeamA = captainId === props.teamACaptainId
  const subIds = isTeamA ? sub.teamA : sub.teamB
  return subIds && subIds.length ? subIds : original
}

function isSubstituted(captainId: number, slotNum: number, idx: number): boolean {
  const sub = slotSubs.value.get(slotNum)
  if (!sub) return false
  const original = getEntry(captainId, slotNum)?.player_ids ?? []
  const isTeamA = captainId === props.teamACaptainId
  const subIds = isTeamA ? sub.teamA : sub.teamB
  if (!subIds) return false
  return subIds[idx] != null && subIds[idx] !== original[idx]
}

function isRandomPlayer(captainId: number, slotNum: number, pid: number): boolean {
  const e = getEntry(captainId, slotNum)
  return !!e?.random_player_ids?.includes(pid)
}

function getBan(captainId: number, slotNum: number): string | null {
  return getEntry(captainId, slotNum)?.banned_map_id ?? null
}

function getPick(captainId: number, slotNum: number): string | null {
  return getEntry(captainId, slotNum)?.picked_map_id ?? null
}

function resolvePickInReveal(
  slotNum: number,
  candidates: MapInfo[],
  pickedMapInfo: SlotMapResult['pickedMapInfo'],
): string | null {
  const pickA = getPick(props.teamACaptainId, slotNum)
  const pickB = getPick(props.teamBCaptainId, slotNum)
  const candidateIds = new Set(candidates.map(m => m.id))
  const validPickA = pickA && candidateIds.has(pickA) ? pickA : null
  const validPickB = pickB && candidateIds.has(pickB) ? pickB : null

  if (!validPickA && !validPickB) return null

  if (validPickA && validPickA === validPickB) {
    pickedMapInfo.push({ mapId: validPickA, byTeamA: true, byTeamB: true })
    return validPickA
  }

  if (validPickA) pickedMapInfo.push({ mapId: validPickA, byTeamA: true, byTeamB: false })
  if (validPickB) pickedMapInfo.push({ mapId: validPickB, byTeamA: false, byTeamB: true })

  const playerIdA = getSlotPlayerIds(props.teamACaptainId, slotNum)[0]
  const playerIdB = getSlotPlayerIds(props.teamBCaptainId, slotNum)[0]
  const rankA = playerIdA ? tierPoint(playerTier(playerIdA)) : 0
  const rankB = playerIdB ? tierPoint(playerTier(playerIdB)) : 0
  if (rankA === rankB) return null  // 동티어 → 사다리 필요

  return rankA < rankB ? (validPickA ?? validPickB!) : (validPickB ?? validPickA!)
}

function playerName(id: number): string {
  return playerMap.value.get(id)?.nickname ?? `선수 ${id}`
}

function playerTier(id: number): string {
  return playerMap.value.get(id)?.tier ?? '?'
}

function playerRace(id: number): string {
  return playerMap.value.get(id)?.race ?? '?'
}

function playerPt(id: number): number {
  return TIER_POINTS[playerTier(id)] ?? 0
}

const getPlayer = (id: number) => playerMap.value.get(id)

// 대타가 나와도 포인트는 제출한 엔트리 그대로 진행한다(규정) — 대타 선수가 아니라 원래 엔트리로 합산
const entryPlayerIds = (captainId: number, slotNum: number) => getEntry(captainId, slotNum)?.player_ids ?? []

// 군인 감점은 개인전·팀전 중복 출전 시 개인전 쪽에서만 빠지므로, 팀전 합계는 엔트리 전체를 보고 계산한다
function slotTotal(captainId: number, slotNum: number): number {
  if (slotNum !== TEAM_SLOT) {
    return calcEntryPoints([{ match_slot: slotNum, player_ids: entryPlayerIds(captainId, slotNum) }], getPlayer).total
  }
  const slots = [...INDIVIDUAL_SLOTS, TEAM_SLOT].map(n => ({ match_slot: n, player_ids: entryPlayerIds(captainId, n) }))
  return calcEntryPoints(slots, getPlayer).team
}

function totalPoints(captainId: number): number {
  return calcEntryPoints([...(entriesMap.value.get(captainId)?.values() ?? [])], getPlayer).total
}

// ── 결과 로직 ─────────────────────────────────────────────────
function slotWinner(slotNum: number): number | null {
  return slotWinners.value.get(slotNum) ?? null
}

const scoreA = computed(() =>
  [...slotWinners.value.values()].filter(w => w === props.teamACaptainId).length
)
const scoreB = computed(() =>
  [...slotWinners.value.values()].filter(w => w === props.teamBCaptainId).length
)

const regularScoreA = computed(() =>
  [...slotWinners.value.entries()].filter(([slot, w]) => slot !== 7 && w === props.teamACaptainId).length
)
const regularScoreB = computed(() =>
  [...slotWinners.value.entries()].filter(([slot, w]) => slot !== 7 && w === props.teamBCaptainId).length
)

const ptA = computed(() => totalPoints(props.teamACaptainId))
const ptB = computed(() => totalPoints(props.teamBCaptainId))

// 핸디: 양팀 엔트리 포인트 차이가 리그 기준 이상일 때, 개인전마다 상위 티어 선수에게.
// 포인트와 마찬가지로 대타가 아니라 제출한 엔트리 선수 기준이다
const handicapActive = computed(() => isHandicapMatch(ptA.value, ptB.value, handicapGap.value))
function slotHandicapOf(slotNum: number) {
  if (!handicapActive.value) return null
  const idA = entryPlayerIds(props.teamACaptainId, slotNum)[0]
  const idB = entryPlayerIds(props.teamBCaptainId, slotNum)[0]
  if (!idA || !idB) return null
  const h = slotHandicap(slotNum, playerTier(idA), playerTier(idB), handicapTable.value)
  return h ? { h, name: playerName(h.stronger === 'A' ? idA : idB) } : null
}
/** 핸디 받는(상위 티어) 쪽 선수 옆 배지 문구 — 예) "75%", 체력 %가 없으면 "핸디" */
function hpBadge(slotNum: number, side: 'A' | 'B'): string | null {
  const r = slotHandicapOf(slotNum)
  if (!r || r.h.stronger !== side) return null
  return r.h.hp != null ? `${r.h.hp}%` : '핸디'
}
/** 배지 툴팁 — 예) "체력 75% · 일꾼 4기 시작" */
function hpTitle(slotNum: number): string {
  const r = slotHandicapOf(slotNum)
  if (!r) return ''
  return [r.h.hp != null ? `체력 ${r.h.hp}%` : '', r.h.note].filter(Boolean).join(' · ')
}

// 에이스 결정전이 실제로 진행됐는지 여부
const acePlayed = computed(() => {
  if (!props.showResults) return true
  return !!(aceSlotResult.value?.ace_player_a_id || aceSlotResult.value?.ace_player_b_id || aceSlotResult.value?.winner_captain_id)
})

// 3:3 동률 + 포인트 차이가 리그 기준 이상 → 낮은 포인트 팀 승리
const tieBreakWinner = computed((): number | null => {
  if (!props.showResults || acePlayed.value) return null
  if (regularScoreA.value !== regularScoreB.value) return null
  return pointTiebreakWinner(ptA.value, ptB.value, props.teamACaptainId, props.teamBCaptainId, aceSkipGap.value)
})


const matchPointsA = computed(() => {
  let pts = 0
  for (const [slot, winner] of slotWinners.value) {
    if (winner === props.teamACaptainId) pts += MATCH_SLOT_POINTS[slot] ?? 1
  }
  return pts
})
const matchPointsB = computed(() => {
  let pts = 0
  for (const [slot, winner] of slotWinners.value) {
    if (winner === props.teamBCaptainId) pts += MATCH_SLOT_POINTS[slot] ?? 1
  }
  return pts
})

// ── 밴 로직 ───────────────────────────────────────────────────

interface SlotMapResult {
  matchMapIds: Set<string>
  bannedMapInfo: { mapId: string; byTeamA: boolean; byTeamB: boolean }[]
  pickedMapInfo: { mapId: string; byTeamA: boolean; byTeamB: boolean }[]
  isUndecided: boolean
}

const slotMapResults = computed<Record<number, SlotMapResult>>(() => {
  const results: Record<number, SlotMapResult> = {}
  for (const slot of SLOT_CONFIG) {
    const n = slot.num
    const maps = slotMapRows.value[n] ?? []
    const banA = getBan(props.teamACaptainId, n)
    const banB = getBan(props.teamBCaptainId, n)
    const bannedMapInfo: SlotMapResult['bannedMapInfo'] = []
    const pickedMapInfo: SlotMapResult['pickedMapInfo'] = []
    let isUndecided = false

    // 1단계: 밴 적용 → candidates 계산
    let candidates = [...maps]
    if (maps.length > 1 && (banA || banB)) {
      if (banA && banB) {
        if (banA === banB) {
          bannedMapInfo.push({ mapId: banA, byTeamA: true, byTeamB: true })
          candidates = candidates.filter(m => m.id !== banA)
        } else {
          const afterBoth = candidates.filter(m => m.id !== banA && m.id !== banB)
          if (afterBoth.length > 0) {
            bannedMapInfo.push({ mapId: banA, byTeamA: true, byTeamB: false })
            bannedMapInfo.push({ mapId: banB, byTeamA: false, byTeamB: true })
            candidates = afterBoth
          } else {
            // 맵이 2개이고 서로 다른 밴 → 낮은 티어 팀의 밴 적용
            const rankA = tierPoint(playerTier(props.teamACaptainId))
            const rankB = tierPoint(playerTier(props.teamBCaptainId))
            if (rankA !== rankB) {
              const effectiveBan = rankA <= rankB ? banA : banB
              bannedMapInfo.push({ mapId: effectiveBan, byTeamA: rankA <= rankB, byTeamB: rankB < rankA })
              candidates = candidates.filter(m => m.id !== effectiveBan)
            }
            // 동티어이면 candidates 그대로 → 픽 로직으로 처리
          }
        }
      } else {
        const banId = banA ?? banB!
        bannedMapInfo.push({ mapId: banId, byTeamA: !!banA, byTeamB: !!banB })
        candidates = candidates.filter(m => m.id !== banId)
      }
    }

    // 2단계: candidates → 픽 로직 또는 확정
    const matchMapIds = new Set<string>()
    if (candidates.length <= 1) {
      candidates.forEach(m => matchMapIds.add(m.id))
    } else {
      const resolvedId = resolvePickInReveal(n, candidates, pickedMapInfo)
      if (resolvedId) {
        matchMapIds.add(resolvedId)
      } else {
        // 동티어 + 다른 픽 → 사다리 필요 (showResults면 사다리 결과 우선)
        const confirmedMapId = slotSelectedMaps.value.get(n)
        if (confirmedMapId) {
          matchMapIds.add(confirmedMapId)
        } else {
          isUndecided = true
          candidates.forEach(m => matchMapIds.add(m.id))
        }
      }
    }

    results[n] = { matchMapIds, bannedMapInfo, pickedMapInfo, isUndecided }
  }
  return results
})

// ── 화면 도우미 (팀A/팀B를 같은 템플릿으로 그린다) ───────────────
type Side = 'A' | 'B'
const SIDES: readonly Side[] = ['A', 'B']
const captainOf = (side: Side) => (side === 'A' ? props.teamACaptainId : props.teamBCaptainId)
const teamName = (side: Side) => (side === 'A' ? props.teamAName : props.teamBName)
const aceBansOf = (side: Side) => (side === 'A' ? aceTierBansA.value : aceTierBansB.value)

function isMatchWinner(side: Side): boolean {
  if (!props.showResults) return false
  const mine = side === 'A' ? scoreA.value : scoreB.value
  const other = side === 'A' ? scoreB.value : scoreA.value
  return mine > other || tieBreakWinner.value === captainOf(side)
}
function teamHeadClass(side: Side): string {
  if (!props.showResults) return ''
  if (isMatchWinner(side)) return 'reveal-team--winner'
  return isMatchWinner(side === 'A' ? 'B' : 'A') ? 'reveal-team--loser' : ''
}
function slotCellClass(slotNum: number, side: Side): string {
  if (!props.showResults) return ''
  const w = slotWinner(slotNum)
  if (w == null) return ''
  return w === captainOf(side) ? 'slot-team-cell--winner' : 'slot-team-cell--loser'
}

/** 확정 맵 1개(밴·픽·사다리 결과까지 반영). 후보가 여럿이면 null */
function resolvedMap(slotNum: number): MapInfo | null {
  const ids = [...(slotMapResults.value[slotNum]?.matchMapIds ?? [])]
  if (ids.length !== 1) return null
  return getMapInfo(slotNum, ids[0]) ?? allMapsById.value.get(ids[0]) ?? null
}
function candidateNames(slotNum: number): string {
  return [...(slotMapResults.value[slotNum]?.matchMapIds ?? [])]
    .map(id => getMapInfo(slotNum, id)?.name ?? '')
    .filter(Boolean)
    .join(' / ')
}
function hasBanPick(slotNum: number): boolean {
  const r = slotMapResults.value[slotNum]
  return !!r && (r.bannedMapInfo.length > 0 || r.pickedMapInfo.length > 0)
}
function byTeams(x: { byTeamA: boolean; byTeamB: boolean }): string {
  return [x.byTeamA ? props.teamAName : '', x.byTeamB ? props.teamBName : ''].filter(Boolean).join(' · ')
}
const acePlayerOf = (side: Side) =>
  (side === 'A' ? aceSlotResult.value?.ace_player_a_id : aceSlotResult.value?.ace_player_b_id) ?? null
const aceMap = computed(() => {
  const id = aceSlotResult.value?.selected_map_id
  return id ? allMapsById.value.get(id) ?? null : null
})

// 맨 아래 "에이스 결정전 · ○ 티어" 줄: 포인트 차이로 에결이 없는 경기는 숨기고,
// 결과 모드는 에결을 치렀으면 에결 줄이 따로 있으니 생략, 안 치렀으면 정해 둔 티어가 있을 때만
const showAceTierLine = computed(() => {
  if (isAceSkippedByPoints(ptA.value, ptB.value, aceSkipGap.value)) return false
  if (!props.showResults) return true
  return !acePlayed.value && !!aceSlotResult.value?.ace_tier
})

const expandedBanSlots = ref<number[]>([])

function toggleBanInfo(slotNum: number) {
  const idx = expandedBanSlots.value.indexOf(slotNum)
  if (idx >= 0) expandedBanSlots.value.splice(idx, 1)
  else expandedBanSlots.value.push(slotNum)
}

function getMapInfo(slotNum: number, mapId: string) {
  return slotMapRows.value[slotNum]?.find(m => m.id === mapId)
}
</script>

<style lang="scss" scoped>
@use './EntryRevealModal.scss';
</style>
