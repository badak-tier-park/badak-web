<template>
  <Teleport to="body">
    <div class="reveal-overlay">
      <div class="reveal-modal">
        <div class="reveal-header">
          <div>
            <p class="reveal-title">{{ showResults ? '경기 결과' : '엔트리 확인' }}</p>
            <p class="reveal-subtitle">
              {{ round }}라운드
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
            <!-- 팀 헤더 -->
            <div class="reveal-teams-header">
              <div class="reveal-th">{{ teamAName }}</div>
              <div class="reveal-th-center">
                <span v-if="showResults" class="reveal-score">{{ scoreA }} : {{ scoreB }}</span>
              </div>
              <div class="reveal-th reveal-th--right">{{ teamBName }}</div>
            </div>

            <!-- 슬롯별 행 -->
            <div v-for="slot in SLOT_CONFIG" :key="slot.num" class="reveal-slot" :class="{ 'reveal-slot--team': slot.type === 'team' }">
              <!-- 슬롯 라벨 (row 바깥) -->
              <div class="rsl-center-label">
                <span class="rsl-num">경기{{ slot.num }}</span>
                <span v-if="slot.type === 'team'" class="rsl-type">팀전</span>
              </div>

              <!-- 3컬럼: 팀A | 맵 | 팀B -->
              <div class="reveal-row">
                <!-- 팀A 선수 -->
                <div class="rse-col" :class="{ 'rse-col--winner': showResults && slotWinner(slot.num) === teamACaptainId, 'rse-col--loser': showResults && slotWinner(slot.num) != null && slotWinner(slot.num) !== teamACaptainId }">
                  <!-- 팀전: 선수들 + WIN 배지를 한 row로 -->
                  <template v-if="slot.type === 'team'">
                    <div class="rse-team-group">
                      <div class="rse-players">
                        <div
                          v-for="pid in getSlotPlayerIds(teamACaptainId, slot.num)"
                          :key="pid"
                          class="rse-player"
                        >
                          <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                          <span class="rse-race" :class="`race-badge--${playerRace(pid).toLowerCase()}`">{{ playerRace(pid) }}</span>
                          <span class="rse-name-badge" :class="`tier-badge--${playerTier(pid).toLowerCase()}`">{{ playerName(pid) }}</span>
                        </div>
                      </div>
                      <span v-if="showResults && slotWinner(slot.num) === teamACaptainId" class="rse-win-badge">WIN</span>
                    </div>
                    <div v-if="getSlotPlayerIds(teamACaptainId, slot.num).length" class="rse-total">
                      합계 {{ slotTotal(teamACaptainId, slot.num) }}pt
                    </div>
                  </template>
                  <!-- 개인전 -->
                  <template v-else>
                    <div
                      v-for="(pid, pidIdx) in getSlotPlayerIds(teamACaptainId, slot.num)"
                      :key="pid"
                      class="rse-player"
                    >
                      <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                      <span class="rse-race" :class="`race-badge--${playerRace(pid).toLowerCase()}`">{{ playerRace(pid) }}</span>
                      <span class="rse-name-badge" :class="`tier-badge--${playerTier(pid).toLowerCase()}`">{{ playerName(pid) }}</span>
                      <span v-if="showResults && pidIdx === 0 && slotWinner(slot.num) === teamACaptainId" class="rse-win-badge">WIN</span>
                    </div>
                  </template>
                </div>

                <!-- 맵 정보 (센터, 맵 이미지만) -->
                <div class="rse-maps">
                  <template v-if="slotMapRows[slot.num]?.length">
                    <template v-for="m in slotMapRows[slot.num]" :key="m.id">
                      <div v-if="slotMapResults[slot.num].matchMapIds.has(m.id)" class="rse-map-item">
                        <div class="rse-map-thumb-wrap">
                          <img v-if="m.thumbnail_url" :src="m.thumbnail_url" class="rse-map-thumb" />
                          <div v-else class="rse-map-thumb-empty" />
                        </div>
                        <span class="rse-map-name">{{ m.name }}</span>
                      </div>
                    </template>
                  </template>
                  <div v-else class="rse-map-empty" />
                </div>

                <!-- 팀B 선수 -->
                <div class="rse-col rse-col--right" :class="{ 'rse-col--winner': showResults && slotWinner(slot.num) === teamBCaptainId, 'rse-col--loser': showResults && slotWinner(slot.num) != null && slotWinner(slot.num) !== teamBCaptainId }">
                  <!-- 팀전: WIN 배지 + 선수들을 한 row로 -->
                  <template v-if="slot.type === 'team'">
                    <div class="rse-team-group rse-team-group--right">
                      <span v-if="showResults && slotWinner(slot.num) === teamBCaptainId" class="rse-win-badge">WIN</span>
                      <div class="rse-players">
                        <div
                          v-for="pid in getSlotPlayerIds(teamBCaptainId, slot.num)"
                          :key="pid"
                          class="rse-player"
                        >
                          <span class="rse-name-badge" :class="`tier-badge--${playerTier(pid).toLowerCase()}`">{{ playerName(pid) }}</span>
                          <span class="rse-race" :class="`race-badge--${playerRace(pid).toLowerCase()}`">{{ playerRace(pid) }}</span>
                          <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                        </div>
                      </div>
                    </div>
                    <div v-if="getSlotPlayerIds(teamBCaptainId, slot.num).length" class="rse-total rse-total--right">
                      합계 {{ slotTotal(teamBCaptainId, slot.num) }}pt
                    </div>
                  </template>
                  <!-- 개인전 -->
                  <template v-else>
                    <div
                      v-for="(pid, pidIdx) in getSlotPlayerIds(teamBCaptainId, slot.num)"
                      :key="pid"
                      class="rse-player"
                    >
                      <span v-if="showResults && pidIdx === 0 && slotWinner(slot.num) === teamBCaptainId" class="rse-win-badge">WIN</span>
                      <span class="rse-name-badge" :class="`tier-badge--${playerTier(pid).toLowerCase()}`">{{ playerName(pid) }}</span>
                      <span class="rse-race" :class="`race-badge--${playerRace(pid).toLowerCase()}`">{{ playerRace(pid) }}</span>
                      <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                    </div>
                  </template>
                </div>
              </div>

              <!-- 밴 정보 영역 (row 아래) -->
              <div v-if="slotMapRows[slot.num]?.length" class="rse-ban-area">
                <div v-if="slotMapResults[slot.num].isUndecided" class="rse-undecided">사다리타기로 결정</div>
                <button
                  v-if="slotMapResults[slot.num].bannedMapInfo.length"
                  class="btn-ban-toggle"
                  @click="toggleBanInfo(slot.num)"
                >
                  밴 정보
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style="transition: transform 0.15s" :style="{ transform: expandedBanSlots.includes(slot.num) ? 'rotate(180deg)' : 'none' }">
                    <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <template v-if="expandedBanSlots.includes(slot.num)">
                  <div class="rse-banned-maps">
                    <div
                      v-for="ban in slotMapResults[slot.num].bannedMapInfo"
                      :key="`ban-${ban.mapId}`"
                      class="rse-map-item rse-map--banned"
                    >
                      <div class="rse-map-thumb-wrap">
                        <img v-if="getMapInfo(slot.num, ban.mapId)?.thumbnail_url" :src="getMapInfo(slot.num, ban.mapId)!.thumbnail_url!" class="rse-map-thumb" />
                        <div v-else class="rse-map-thumb-empty" />
                      </div>
                      <span class="rse-map-name">{{ getMapInfo(slot.num, ban.mapId)?.name }}</span>
                      <div class="rse-ban-chips">
                        <span v-if="ban.byTeamA" class="ban-chip ban-chip--a">{{ teamAName }} 밴</span>
                        <span v-if="ban.byTeamB" class="ban-chip ban-chip--b">{{ teamBName }} 밴</span>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- 합계 -->
            <div class="reveal-totals">
              <div class="reveal-total-item">
                <span class="reveal-total-name">{{ teamAName }}</span>
                <span class="reveal-total-pt">{{ totalPoints(teamACaptainId) }}pt</span>
              </div>
              <div class="reveal-total-sep" />
              <div class="reveal-total-item reveal-total-item--right">
                <span class="reveal-total-pt">{{ totalPoints(teamBCaptainId) }}pt</span>
                <span class="reveal-total-name">{{ teamBName }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getScheduleEntries, TIER_POINTS, type EntryRecord } from '@/lib/entries'
import { getMatchMaps } from '@/lib/leagueDetail'
import { getMaps } from '@/lib/maps'
import { getPlayers, type PlayerRow } from '@/lib/players'
import { getSlotResults, type SlotResult } from '@/lib/schedules'
import { withTimeout } from '@/lib/supabase'

const props = withDefaults(defineProps<{
  scheduleId: number
  round: number
  matchDate: string | null
  leagueId: string
  teamACaptainId: number
  teamBCaptainId: number
  teamAName: string
  teamBName: string
  showResults?: boolean
}>(), { showResults: false })

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

onMounted(async () => {
  try {
    const [entries, players, matchMaps, allMaps, slotResultsData] = await withTimeout(Promise.all([
      getScheduleEntries(props.scheduleId),
      getPlayers(),
      getMatchMaps(props.leagueId),
      getMaps(),
      props.showResults ? getSlotResults(props.scheduleId) : Promise.resolve([] as SlotResult[]),
    ]))

    playerMap.value = new Map(players.map(p => [p.id, p]))

    const mapInfoMap = new Map(allMaps.map(m => [m.id, m]))
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

    // 슬롯 결과 (showResults 모드)
    if (slotResultsData.length) {
      const wm = new Map<number, number>()
      const sm = new Map<number, string>()
      for (const r of slotResultsData) {
        if (r.winner_captain_id != null) wm.set(r.slot_num, r.winner_captain_id)
        if (r.selected_map_id) sm.set(r.slot_num, r.selected_map_id)
      }
      slotWinners.value = wm
      slotSelectedMaps.value = sm
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
  return getEntry(captainId, slotNum)?.player_ids ?? []
}

function getBan(captainId: number, slotNum: number): string | null {
  return getEntry(captainId, slotNum)?.banned_map_id ?? null
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

function slotTotal(captainId: number, slotNum: number): number {
  return getSlotPlayerIds(captainId, slotNum).reduce((sum, id) => sum + playerPt(id), 0)
}

function totalPoints(captainId: number): number {
  return [...(entriesMap.value.get(captainId)?.values() ?? [])].reduce(
    (sum, e) => sum + e.player_ids.reduce((s, id) => s + playerPt(id), 0),
    0,
  )
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

// ── 밴 로직 ───────────────────────────────────────────────────

const TIER_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }

interface SlotMapResult {
  matchMapIds: Set<string>
  bannedMapInfo: { mapId: string; byTeamA: boolean; byTeamB: boolean }[]
  isUndecided: boolean
}

const slotMapResults = computed<Record<number, SlotMapResult>>(() => {
  const results: Record<number, SlotMapResult> = {}
  for (const slot of SLOT_CONFIG) {
    const n = slot.num
    const maps = slotMapRows.value[n] ?? []

    // showResults 모드: 사다리타기로 확정된 맵이 있으면 그것만 표시
    const confirmedMapId = slotSelectedMaps.value.get(n)
    if (props.showResults && confirmedMapId) {
      results[n] = {
        matchMapIds: new Set([confirmedMapId]),
        bannedMapInfo: [],
        isUndecided: false,
      }
      continue
    }

    const banA = getBan(props.teamACaptainId, n)
    const banB = getBan(props.teamBCaptainId, n)
    const matchMapIds = new Set<string>()
    const bannedMapInfo: SlotMapResult['bannedMapInfo'] = []
    let isUndecided = false

    if (maps.length <= 1 || (!banA && !banB)) {
      maps.forEach(m => matchMapIds.add(m.id))
    } else if (maps.length === 3) {
      if (banA && banB) {
        if (banA === banB) {
          // 같은 맵 밴 → 나머지 2개 사다리타기
          bannedMapInfo.push({ mapId: banA, byTeamA: true, byTeamB: true })
          maps.filter(m => m.id !== banA).forEach(m => matchMapIds.add(m.id))
          isUndecided = true
        } else {
          // 서로 다른 맵 밴 → 양쪽 밴 적용, 남은 1개가 경기 맵
          bannedMapInfo.push({ mapId: banA, byTeamA: true, byTeamB: false })
          bannedMapInfo.push({ mapId: banB, byTeamA: false, byTeamB: true })
          maps.filter(m => m.id !== banA && m.id !== banB).forEach(m => matchMapIds.add(m.id))
        }
      } else {
        const banId = banA ?? banB!
        bannedMapInfo.push({ mapId: banId, byTeamA: !!banA, byTeamB: !!banB })
        maps.filter(m => m.id !== banId).forEach(m => matchMapIds.add(m.id))
      }
    } else if (maps.length === 2) {
      if (banA && banB) {
        if (banA === banB) {
          // 같은 맵 밴 → 나머지 1개가 경기 맵
          bannedMapInfo.push({ mapId: banA, byTeamA: true, byTeamB: true })
          maps.filter(m => m.id !== banA).forEach(m => matchMapIds.add(m.id))
        } else {
          // 서로 다른 맵 밴 → 티어 낮은 팀의 밴 우선
          const rankA = TIER_RANK[playerTier(props.teamACaptainId)] ?? 0
          const rankB = TIER_RANK[playerTier(props.teamBCaptainId)] ?? 0
          const effectiveId = rankA <= rankB ? banA : banB
          bannedMapInfo.push({ mapId: effectiveId, byTeamA: rankA <= rankB, byTeamB: rankB < rankA })
          maps.filter(m => m.id !== effectiveId).forEach(m => matchMapIds.add(m.id))
        }
      } else {
        const banId = banA ?? banB!
        bannedMapInfo.push({ mapId: banId, byTeamA: !!banA, byTeamB: !!banB })
        maps.filter(m => m.id !== banId).forEach(m => matchMapIds.add(m.id))
      }
    } else {
      maps.forEach(m => matchMapIds.add(m.id))
    }

    results[n] = { matchMapIds, bannedMapInfo, isUndecided }
  }
  return results
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
