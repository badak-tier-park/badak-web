<template>
  <div class="captain-draft-page">
    <AppHeader />

    <div v-if="loading" class="state-msg">불러오는 중...</div>
    <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
    <div v-else-if="!isCaptain" class="state-msg state-msg--error">이 리그의 팀장이 아닙니다.</div>
    <div v-else-if="!draftStarted" class="state-msg">지목식이 아직 시작되지 않았습니다. 관리자가 시작하면 자동으로 갱신됩니다.</div>

    <template v-else>
      <!-- 뒤로가기 -->
      <div class="draft-nav">
        <div class="draft-nav-inner">
          <button class="btn-back" @click="$router.push({ name: 'participate' })">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            리그 참여
          </button>
        </div>
      </div>

      <!-- 상단 바 -->
      <div class="draft-topbar">
        <div class="draft-topbar-inner">
          <span class="topbar-league">{{ league?.name }}</span>
          <span class="topbar-sep" />

          <span v-if="draftDone" class="topbar-done">선수 배정 완료</span>
          <template v-else>
            <span v-if="isMyTurn" class="topbar-turn topbar-turn--my">
              ✦ 내 차례
            </span>
            <span v-else class="topbar-turn">
              <span class="topbar-turn-name" :class="`tier--${playerById(currentCaptainId!)?.tier.toLowerCase()}`">
                {{ playerById(currentCaptainId!)?.nickname }}
              </span>
              님이 선택 중...
            </span>
            <span class="topbar-round">{{ turnRound }}R {{ turnPositionLabel }}</span>
          </template>

          <div class="topbar-actions">
            <div class="topbar-presence">
              <span
                v-for="cid in captainIds"
                :key="cid"
                class="topbar-presence-chip"
                :class="presentIds.has(String(cid)) ? 'topbar-presence-chip--on' : 'topbar-presence-chip--off'"
              >
                <span class="topbar-presence-indicator" />
                {{ playerById(cid)?.nickname }}
              </span>
            </div>
            <span class="topbar-draft-live">● LIVE</span>
          </div>
        </div>
      </div>

      <!-- 메인 레이아웃 -->
      <div class="draft-layout">
        <!-- 좌측: 선수 풀 -->
        <aside
          v-if="!draftDone"
          class="pool-panel"
          :class="{ 'drop-target': dragOverPool }"
          data-drop-pool
        >
          <div class="pool-header">
            <div class="pool-title-row">
              <h2 class="pool-title">참여 선수</h2>
              <span class="pool-count">{{ availablePlayers.length }}명</span>
              <span v-if="isMyTurn" class="pool-pick-hint">드래그해서 선택</span>
            </div>
            <div class="pool-tier-filter">
              <button
                class="tier-filter-btn"
                :class="{ active: selectedTier === null }"
                @click="selectedTier = null"
              >전체</button>
              <button
                v-for="tier in availableTiers"
                :key="tier"
                class="tier-filter-btn"
                :class="[`tier-filter-btn--${tier.toLowerCase()}`, { active: selectedTier === tier }]"
                @click="selectedTier = selectedTier === tier ? null : tier"
              >{{ tier }}</button>
            </div>
          </div>
          <div class="pool-body">
            <template v-for="tier in TIER_ORDER" :key="tier">
              <div v-if="playersByTierRace[tier] && (selectedTier === null || selectedTier === tier)" class="tier-section">
                <div class="tier-section-label" :class="`tier--${tier.toLowerCase()}`">
                  <span class="tier-letter">{{ tier }}</span>
                  <span class="tier-count">{{ tierCount(tier) }}명</span>
                </div>
                <template v-for="race in RACE_ORDER" :key="race">
                  <div
                    v-for="player in (playersByTierRace[tier]?.[race] ?? [])"
                    :key="player.id"
                    class="player-card"
                    :class="[
                      `tier-bg--${player.tier.toLowerCase()}`,
                      { 'player-card--pickable': isMyTurn },
                      { 'is-dragging': draggingId === player.id },
                    ]"
                    @pointerdown="isMyTurn && onPointerDown($event, player.id, 'pool')"
                  >
                    <span class="card-name">{{ player.nickname }}
                      <span class="card-race" :class="`race--${player.race.toLowerCase()}`">{{ player.race }}</span>
                    </span>
                    <span v-if="seedHolderIds.has(player.id)" class="card-seed">SEED</span>
                  </div>
                </template>
              </div>
            </template>
          </div>
        </aside>

        <!-- 우측: 팀 현황 -->
        <main class="teams-panel" :class="{ 'teams-panel--full': draftDone }">
          <div class="teams-content-row">
            <div class="teams-body">
              <div
                v-for="cid in captainIds"
                :key="cid"
                class="team-column"
                :data-captain-id="cid"
                :class="{
                  'drag-over': dragOverTeam === cid && cid === currentCaptainId,
                  'is-active': cid === currentCaptainId && !draftDone,
                  'is-inactive': currentCaptainId !== null && cid !== currentCaptainId && !draftDone,
                  'is-mine': cid === myCaptainId,
                }"
              >
                <!-- 팀장 헤더 -->
                <div class="team-captain">
                  <div class="captain-crown-row">
                    <div class="captain-crown">
                      <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                        <path d="M1 11h12M2 11L1 4l3.5 3 2.5-5 2.5 5L13 4l-1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      {{ captainIds.indexOf(cid) + 1 }}번 팀장
                    </div>
                    <div style="display:flex;align-items:center;gap:5px">
                      <span v-if="cid === myCaptainId" class="me-badge">나</span>
                      <span class="member-count">{{ (teams[cid] ?? []).length }}명</span>
                    </div>
                  </div>
                  <div class="captain-info">
                    <span class="captain-tier" :class="`tier--${playerById(cid)?.tier.toLowerCase()}`">
                      {{ playerById(cid)?.tier }}
                    </span>
                    <span class="captain-race" :class="`race--${playerById(cid)?.race.toLowerCase()}`">
                      {{ playerById(cid)?.race }}
                    </span>
                    <span class="captain-name">{{ playerById(cid)?.nickname }}</span>
                    <span v-if="seedHolderIds.has(cid)" class="card-seed">SEED</span>
                  </div>
                  <!-- 팀 통계 -->
                  <div class="team-stats">
                    <div class="team-stats-row">
                      <template v-for="tier in TIER_ORDER" :key="tier">
                        <span
                          v-if="teamTierCount(cid, tier) > 0"
                          class="stat-chip"
                          :class="`tier--${tier.toLowerCase()}`"
                        >{{ tier }}{{ teamTierCount(cid, tier) }}</span>
                      </template>
                    </div>
                    <div class="team-stats-row">
                      <template v-for="race in RACE_ORDER" :key="race">
                        <span
                          v-if="teamRaceCount(cid, race) > 0"
                          class="stat-chip stat-chip--race"
                          :class="`race--${race.toLowerCase()}`"
                        >{{ race }}{{ teamRaceCount(cid, race) }}</span>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- 팀원 목록 -->
                <div class="team-members">
                  <div
                    v-for="(member, idx) in (teams[cid] ?? [])"
                    :key="member.id"
                    class="player-card player-card--member"
                    :class="[
                      `tier-bg--${member.tier.toLowerCase()}`,
                      { 'is-dragging': draggingId === member.id },
                    ]"
                    @pointerdown="cid === myCaptainId && onPointerDown($event, member.id, cid)"
                  >
                    <span class="card-pick-num">{{ idx + 1 }}</span>
                    <span class="card-race" :class="`race--${member.race.toLowerCase()}`">{{ member.race }}</span>
                    <span class="card-name">{{ member.nickname }}</span>
                    <span v-if="seedHolderIds.has(member.id)" class="card-seed">SEED</span>
                  </div>
                  <div v-if="cid === currentCaptainId && !draftDone" class="team-drop-hint" :class="{ active: dragOverTeam === cid || (isMyTurn && cid === myCaptainId) }">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                    </svg>
                    {{ isMyTurn && cid === myCaptainId ? '여기에 드롭' : '선택 중...' }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import type { RealtimeChannel } from '@supabase/supabase-js'
import AppHeader from '@/components/AppHeader.vue'
import { supabase } from '@/lib/supabase'
import { getLeague, type LeagueRow } from '@/lib/leagues'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getCaptains, getSeedHolders } from '@/lib/leagueDetail'
import { getDraftPicks, addSinglePick, deleteSinglePick } from '@/lib/draft'
import { setPicksCompleted } from '@/lib/leagues'
import { TIER_ORDER, RACE_ORDER } from '@/lib/constants'
import { useAuthStore } from '@/stores/auth'
import { useDraftDnD } from '@/composables/useDraftDnD'

const route = useRoute()
const leagueId = route.params.id as string
const auth = useAuthStore()

const loading = ref(true)
const loadError = ref<string | null>(null)
const league = ref<LeagueRow | null>(null)
const allPlayers = ref<PlayerRow[]>([])
const captainIds = ref<number[]>([])
const seedHolderIds = ref(new Set<number>())
const teams = ref<Record<number, PlayerRow[]>>({})
const myCaptainId = ref<number | null>(null)
const draftStarted = ref(false)

const presentIds = ref(new Set<string>())
let channel: RealtimeChannel | null = null

const isCaptain = computed(() => myCaptainId.value !== null)

const assignedIds = computed(() => {
  const ids = new Set<number>()
  for (const members of Object.values(teams.value))
    for (const m of members) ids.add(m.id)
  return ids
})

const availablePlayers = computed(() => {
  const eligible = new Set(league.value?.eligible_tiers ?? [])
  return allPlayers.value.filter(
    p => eligible.has(p.tier) && !captainIds.value.includes(p.id) && !assignedIds.value.has(p.id),
  )
})

const playersByTierRace = computed(() => {
  const result: Record<string, Record<string, PlayerRow[]>> = {}
  for (const player of availablePlayers.value) {
    if (!result[player.tier]) result[player.tier] = {}
    if (!result[player.tier][player.race]) result[player.tier][player.race] = []
    result[player.tier][player.race].push(player)
  }
  return result
})

const selectedTier = ref<string | null>(null)

const availableTiers = computed(() =>
  TIER_ORDER.filter(tier => playersByTierRace.value[tier]),
)

function tierCount(tier: string) {
  return RACE_ORDER.reduce((sum, r) => sum + (playersByTierRace.value[tier]?.[r]?.length ?? 0), 0)
}

function teamTierCount(captainId: number, tier: string) {
  const captain = allPlayers.value.find(p => p.id === captainId)
  const captainMatch = captain?.tier === tier ? 1 : 0
  return captainMatch + (teams.value[captainId] ?? []).filter(m => m.tier === tier).length
}

function teamRaceCount(captainId: number, race: string) {
  const captain = allPlayers.value.find(p => p.id === captainId)
  const captainMatch = captain?.race === race ? 1 : 0
  return captainMatch + (teams.value[captainId] ?? []).filter(m => m.race === race).length
}

const totalPicks = computed(() =>
  Object.values(teams.value).reduce((sum, m) => sum + m.length, 0),
)

const draftDone = computed(() => availablePlayers.value.length === 0)

const currentCaptainId = computed((): number | null => {
  const n = captainIds.value.length
  if (n === 0 || draftDone.value) return null
  const round = Math.floor(totalPicks.value / n)
  const pos = totalPicks.value % n
  const idx = round % 2 === 0 ? pos : n - 1 - pos
  return captainIds.value[idx] ?? null
})

const isMyTurn = computed(() =>
  !draftDone.value && currentCaptainId.value === myCaptainId.value,
)

const turnRound = computed(() => {
  const n = captainIds.value.length
  return n === 0 ? 1 : Math.floor(totalPicks.value / n) + 1
})

const turnPositionLabel = computed(() => {
  const n = captainIds.value.length
  if (n === 0) return ''
  const round = Math.floor(totalPicks.value / n)
  return round % 2 === 0 ? '↓' : '↑'
})

function playerById(id: number) {
  return allPlayers.value.find(p => p.id === id) ?? null
}

const {
  dragOverTeam, dragOverPool, draggingId,
  onPointerDown,
} = useDraftDnD(
  allPlayers, teams, currentCaptainId,
  (captainId, player, pickOrder) => {
    addSinglePick(leagueId, captainId, player.id, pickOrder).catch(e => console.error('픽 저장 실패:', e))
  },
  (memberId) => {
    deleteSinglePick(leagueId, memberId).catch(e => console.error('회수 저장 실패:', e))
    channel?.send({ type: 'broadcast', event: 'pick_removed', payload: { memberId } })
  },
)

function applyNewPick(captainPlayerId: number, memberPlayerId: number) {
  const player = allPlayers.value.find(p => p.id === memberPlayerId)
  if (!player) return
  const updated = { ...teams.value }
  if (!updated[captainPlayerId]) updated[captainPlayerId] = []
  if (updated[captainPlayerId].some(m => m.id === player.id)) return
  updated[captainPlayerId] = [...updated[captainPlayerId], player]
  teams.value = updated
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    const [leagueData, playersData, captainsData, picksData, seedHoldersData, me] = await Promise.all([
      getLeague(leagueId),
      getPlayers(),
      getCaptains(leagueId),
      getDraftPicks(leagueId),
      getSeedHolders(leagueId),
      discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    ])

    league.value = leagueData
    draftStarted.value = leagueData.draft_started
    allPlayers.value = playersData
    seedHolderIds.value = new Set(seedHoldersData.map(h => h.player_id))

    const sortedCaptains = [...captainsData].sort((a, b) => a.order_num - b.order_num)
    captainIds.value = sortedCaptains.map(c => c.player_id)

    if (me) {
      const isCap = captainIds.value.includes(me.id)
      if (isCap) myCaptainId.value = me.id
    }

    const teamsMap: Record<number, PlayerRow[]> = {}
    for (const cid of captainIds.value) teamsMap[cid] = []
    const sorted = [...picksData].sort((a, b) => a.pick_order - b.pick_order)
    for (const pick of sorted) {
      if (!teamsMap[pick.captain_player_id]) teamsMap[pick.captain_player_id] = []
      const player = playersData.find(p => p.id === pick.member_player_id)
      if (player) teamsMap[pick.captain_player_id].push(player)
    }
    teams.value = teamsMap

    channel = supabase.channel(`draft-room:${leagueId}`)

    channel.on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'league_draft_picks' },
      (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new
          if (row.league_id !== leagueId) return
          applyNewPick(row.captain_player_id, row.member_player_id)
        } else if (payload.eventType === 'DELETE') {
          const row = payload.old
          if (row?.league_id !== leagueId) return
          const memberId = row.member_player_id
          if (!memberId) return
          const updated = { ...teams.value }
          for (const cid of Object.keys(updated)) {
            updated[Number(cid)] = updated[Number(cid)].filter(p => p.id !== memberId)
          }
          teams.value = updated
        }
      },
    )

    channel.on('broadcast', { event: 'pick_removed' }, (msg: any) => {
      const memberId = msg.payload?.memberId
      if (!memberId) return
      const updated = { ...teams.value }
      for (const cid of Object.keys(updated)) {
        updated[Number(cid)] = updated[Number(cid)].filter(p => p.id !== memberId)
      }
      teams.value = updated
    })

    channel.on(
      'postgres_changes' as any,
      { event: 'UPDATE', schema: 'public', table: 'leagues', filter: `id=eq.${leagueId}` },
      (payload: any) => {
        draftStarted.value = payload.new.draft_started ?? false
      },
    )

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel!.presenceState()
      const ids = new Set<string>()
      for (const presences of Object.values(state)) {
        for (const p of presences as any[]) {
          if (p.captain_id) ids.add(String(p.captain_id))
        }
      }
      presentIds.value = ids
    })

    channel.subscribe()

    if (myCaptainId.value) {
      await channel.track({ captain_id: myCaptainId.value })
    }

  } catch (e: any) {
    loadError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

const prevDraftDone = ref(false)
watch(draftDone, async (done) => {
  if (done && !prevDraftDone.value && myCaptainId.value && league.value && !league.value.picks_completed) {
    prevDraftDone.value = true
    try { await setPicksCompleted(leagueId) } catch {}
  }
})

onUnmounted(() => {
  if (channel) {
    supabase.removeChannel(channel)
    channel = null
  }
})
</script>

<style lang="scss" scoped>
@use './CaptainDraftView.scss';
</style>
