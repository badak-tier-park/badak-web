<template>
  <div class="draft-page">
    <AppHeader />

    <!-- 토스트 -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast" class="toast">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4 7l2.5 2.5 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ toast }}
        </div>
      </Transition>
    </Teleport>

    <!-- 시드권 순서 설정 모달 -->
    <Teleport to="body">
      <div v-if="seedOrderSetupMode" class="modal-backdrop">
        <div class="seed-order-modal">
          <div class="seed-order-header">
            <span class="seed-order-title">시드권 적용 순서 설정</span>
            <p class="seed-order-desc">
              <strong>{{ playerById(seedOrderIds[0])?.nickname }}</strong>님이 시드권 적용 순서를 결정합니다.<br>
              ▲▼로 순서를 조정한 후 확정하세요.
            </p>
          </div>
          <div class="seed-order-list">
            <div v-for="(pid, i) in seedOrderDraft" :key="pid" class="seed-order-item">
              <span class="seed-order-num">{{ i + 1 }}</span>
              <span class="seed-order-tier" :class="`tier--${playerById(pid)?.tier.toLowerCase()}`">
                {{ playerById(pid)?.tier }}
              </span>
              <span class="seed-order-race" :class="`race--${playerById(pid)?.race.toLowerCase()}`">
                {{ playerById(pid)?.race }}
              </span>
              <span class="seed-order-name">{{ playerById(pid)?.nickname }}</span>
              <div class="seed-order-btns">
                <button :disabled="i === 0" @click="moveSeedOrder(i, -1)">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 7l3-4 3 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
                <button :disabled="i === seedOrderDraft.length - 1" @click="moveSeedOrder(i, 1)">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 3l3 4 3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <div class="seed-order-footer">
            <button class="btn-seed-order-cancel" @click="seedOrderSetupMode = false">취소</button>
            <button class="btn-seed-order-confirm" @click="confirmSeedOrder">순서 확정 후 시작</button>
          </div>
        </div>
      </div>
    </Teleport>

    <div v-if="loading" class="state-msg">불러오는 중...</div>
    <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

    <template v-else>
      <!-- ── 뒤로가기 네비 ────────────────────────────────── -->
      <div class="draft-nav">
        <div class="draft-nav-inner">
          <button class="btn-back" @click="$router.push({ name: 'leagues' })">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            정규리그 목록
          </button>
        </div>
      </div>

      <!-- ── 상단 바 ──────────────────────────────────────── -->
      <div class="draft-topbar">
        <div class="draft-topbar-inner">
          <span class="topbar-league">{{ league?.name }}</span>
          <span class="topbar-sep" />
          <span v-if="!draftDone" class="topbar-turn">
            현재 순번
            <span class="topbar-turn-name" :class="`tier--${playerById(currentCaptainId!)?.tier.toLowerCase()}`">
              {{ playerById(currentCaptainId!)?.nickname }}
            </span>
            <span class="topbar-round">{{ turnRound }}R {{ turnPositionLabel }}</span>
          </span>
          <span v-else-if="!seedSwapMode" class="topbar-done">
            {{ seedSwapDone ? '지목식 완료' : '선수배정완료' }}
          </span>
          <span v-else class="topbar-seed-mode">
            시드권 적용
            <span class="topbar-seed-holder">
              {{ playerById(currentSeedHolderId!)?.nickname }}의 시드권 ({{ currentSeedIdx + 1 }}/{{ seedOrderIds.length }})
            </span>
          </span>

          <div class="topbar-actions">
            <template v-if="draftDone && !seedSwapMode && !seedSwapDone && seedOrderIds.length > 0">
              <button class="btn-seed" @click="openSeedOrderSetup">시드권 적용</button>
            </template>
            <template v-if="seedSwapMode">
              <button class="btn-seed-pass" @click="passSeed">패스</button>
            </template>
            <template v-if="seedSwapMode || seedSwapDone">
              <button class="btn-seed-cancel" :disabled="isFinalSave" @click="resetSeedSwap">시드권 초기화</button>
            </template>
            <button class="btn-save" :disabled="saving || isFinalSave" @click="saveDraft">
              {{ saving ? '저장 중...' : isFinalSave ? '최종 저장됨' : seedSwapDone ? '최종 저장' : '임시 저장' }}
            </button>
          </div>
        </div>
      </div>

      <!-- ── 메인 레이아웃 ─────────────────────────────────── -->
      <div class="draft-layout">
        <!-- 좌측: 선수 풀 -->
        <aside
          v-if="!seedSwapMode && !isSaved"
          class="pool-panel"
          :class="{ 'drop-target': dragOverPool }"
          data-drop-pool
        >
          <div class="pool-header">
            <div class="pool-title-row">
              <h2 class="pool-title">참여 선수</h2>
              <span class="pool-count">{{ availablePlayers.length }}명</span>
            </div>
          </div>

          <div class="pool-body">
            <template v-for="tier in TIER_ORDER" :key="tier">
              <div v-if="playersByTierRace[tier]" class="tier-section">
                <div class="tier-section-label" :class="`tier--${tier.toLowerCase()}`">
                  <span class="tier-letter">{{ tier }}</span>
                  <span class="tier-count">{{ tierCount(tier) }}명</span>
                </div>
                <template v-for="race in RACE_ORDER" :key="race">
                  <div
                    v-for="player in (playersByTierRace[tier]?.[race] ?? [])"
                    :key="player.id"
                    class="player-card"
                    :class="[`tier-bg--${player.tier.toLowerCase()}`, { 'is-dragging': draggingId === player.id }]"
                    @pointerdown="onPointerDown($event, player.id, 'pool')"
                  >
                    <span class="card-name">{{ player.nickname }}
                      <span class="card-race" :class="`race--${player.race.toLowerCase()}`">{{ player.race }}</span>
                    </span>
                    <span v-if="seedHolderIds.has(player.id)" class="card-seed">SEED</span>
                  </div>
                </template>
              </div>
            </template>
            <div v-if="availablePlayers.length === 0" class="pool-empty">
              배치할 선수가 없습니다
            </div>
          </div>
        </aside>

        <!-- 우측: 팀 구성 -->
        <main class="teams-panel" :class="{ 'teams-panel--full': seedSwapMode || isSaved }">
          <!-- 시드권 적용 안내/오류 -->
          <div v-if="seedSwapMode" class="swap-bar" :class="{ 'swap-bar--error': !!swapError }">
            <div v-if="swapError" class="swap-bar-inner" @click="swapError = null">
              <span :key="swapErrorKey" class="swap-bar-error-content">
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/>
                  <path d="M6.5 4.5v3M6.5 9h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                </svg>
                {{ swapError }}
                <span class="swap-error-dismiss">×</span>
              </span>
            </div>
            <div v-else class="swap-bar-inner">
              <span v-if="!swapSel">
                <strong>{{ playerById(currentSeedHolderId!)?.nickname }}</strong>의 팀원을 먼저 선택하세요
              </span>
              <span v-else>
                <strong>{{ swapSel.member.nickname }}</strong> 선택됨 — 교체할 상대 팀원을 클릭하세요
              </span>
            </div>
          </div>

          <div class="teams-content-row">
          <div class="teams-body">
            <div
              v-for="captainId in captainIds"
              :key="captainId"
              class="team-column"
              :data-captain-id="captainId"
              :class="{
                'drag-over': !seedSwapMode && dragOverTeam === captainId && captainId === currentCaptainId,
                'is-active': !seedSwapMode && captainId === currentCaptainId,
                'is-inactive': !seedSwapMode && currentCaptainId !== null && captainId !== currentCaptainId,
                'seed-my-team': seedSwapMode && captainId === currentSeedHolderCaptainId,
                'seed-other-team': seedSwapMode && captainId !== currentSeedHolderCaptainId,
              }"
            >
              <!-- 팀장 헤더 -->
              <div class="team-captain">
                <div class="captain-crown-row">
                  <div class="captain-crown">
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                      <path d="M1 11h12M2 11L1 4l3.5 3 2.5-5 2.5 5L13 4l-1 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    {{ captainIds.indexOf(captainId) + 1 }}번 팀장
                  </div>
                  <span class="member-count">{{ (teams[captainId] ?? []).length }}명</span>
                </div>
                <div class="captain-info">
                  <span class="captain-tier" :class="`tier--${playerById(captainId)?.tier.toLowerCase()}`">
                    {{ playerById(captainId)?.tier }}
                  </span>
                  <span class="captain-race" :class="`race--${playerById(captainId)?.race.toLowerCase()}`">
                    {{ playerById(captainId)?.race }}
                  </span>
                  <span class="captain-name">{{ playerById(captainId)?.nickname }}</span>
                  <span v-if="seedHolderIds.has(captainId)" class="card-seed">SEED</span>
                </div>
                <!-- 팀 통계 -->
                <div class="team-stats">
                  <div class="team-stats-row">
                    <template v-for="tier in TIER_ORDER" :key="tier">
                      <span
                        v-if="teamTierCount(captainId, tier) > 0"
                        class="stat-chip"
                        :class="`tier--${tier.toLowerCase()}`"
                      >{{ tier }}{{ teamTierCount(captainId, tier) }}</span>
                    </template>
                  </div>
                  <div class="team-stats-row">
                    <template v-for="race in RACE_ORDER" :key="race">
                      <span
                        v-if="teamRaceCount(captainId, race) > 0"
                        class="stat-chip stat-chip--race"
                        :class="`race--${race.toLowerCase()}`"
                      >{{ race }}{{ teamRaceCount(captainId, race) }}</span>
                    </template>
                  </div>
                </div>
              </div>

              <!-- 팀원 목록 -->
              <div class="team-members">
                <div
                  v-for="(member, idx) in (teams[captainId] ?? [])"
                  :key="member.id"
                  class="player-card player-card--member"
                  :class="{
                    [`tier-bg--${member.tier.toLowerCase()}`]: true,
                    'is-dragging': !seedSwapMode && !isSaved && draggingId === member.id,
                    'swap-selected': seedSwapMode && swapSel?.member.id === member.id,
                    'swap-locked': seedSwapMode && lockedIds.has(member.id),
                    'swap-clickable': seedSwapMode && !lockedIds.has(member.id),
                  }"
                  @pointerdown="!seedSwapMode && !isSaved && onPointerDown($event, member.id, captainId)"
                  @click="seedSwapMode && onMemberClick(captainId, member, idx)"
                >
                  <span class="card-pick-num">{{ idx + 1 }}</span>
                  <span class="card-race" :class="`race--${member.race.toLowerCase()}`">{{ member.race }}</span>
                  <span class="card-name">{{ member.nickname }}</span>
                  <span v-if="seedHolderIds.has(member.id)" class="card-seed">SEED</span>
                  <span v-if="swappedIds.has(member.id)" class="card-locked">교체됨</span>
                  <button v-if="!seedSwapMode && !isSaved" class="card-remove" @click.stop="removeFromTeam(captainId, member.id)">×</button>
                </div>

                <!-- 드롭 힌트 -->
                <div
                  v-if="!seedSwapMode && !isSaved && captainId === currentCaptainId"
                  class="team-drop-hint"
                  :class="{ active: dragOverTeam === captainId }"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                  여기에 드롭
                </div>
              </div>
            </div>
          </div>

          <!-- 시드권 적용 기록 -->
          <aside v-show="swapLog.length > 0" class="log-panel">
            <div class="log-panel-header">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 4h10M8 2l3 2-3 2M11 8H1M4 6l-3 2 3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              시드권 적용 기록
            </div>
            <div class="log-panel-body">
              <div v-for="(log, i) in swapLog" :key="i" class="log-entry">
                <div class="log-entry-num">{{ i + 1 }}</div>
                <div class="log-entry-content">
                  <div class="log-entry-holder">
                    <span class="log-seed-badge">SEED</span>
                    {{ log.seedHolderName }}
                  </div>
                  <div class="log-entry-swap">
                    <span class="log-swap-from">
                      <span class="log-team-label">{{ log.myTeamCaptainName }}팀</span>
                      <span class="log-player-name">{{ log.myName }}</span>
                    </span>
                    <svg width="14" height="10" viewBox="0 0 14 10" fill="none" class="log-swap-arrows">
                      <path d="M1 3h12M10 1l3 2-3 2M13 7H1M4 5l-3 2 3 2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    <span class="log-swap-to">
                      <span class="log-team-label">{{ log.theirTeamCaptainName }}팀</span>
                      <span class="log-player-name">{{ log.theirName }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </aside>
          </div><!-- teams-content-row -->

        </main>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getLeague, setPicksCompleted, setDraftCompleted, type LeagueRow } from '@/lib/leagues'
import { getPlayers, type PlayerRow } from '@/lib/players'
import { getCaptains, getSeedHolders } from '@/lib/leagueDetail'
import { getDraftPicks, saveDraftPicks, getSwapLog, saveSwapLog } from '@/lib/draft'
import { TIER_ORDER, RACE_ORDER } from '@/lib/constants'
import { useToast } from '@/composables/useToast'
import { useDraftDnD } from '@/composables/useDraftDnD'
import { useSeedSwap } from '@/composables/useSeedSwap'

const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

// ── 데이터 ────────────────────────────────────────────────
const loading = ref(true)
const loadError = ref<string | null>(null)
const league = ref<LeagueRow | null>(null)
const allPlayers = ref<PlayerRow[]>([])
const captainIds = ref<number[]>([])
const seedHolderIds = ref(new Set<number>())
const seedOrderIds = ref<number[]>([])
const teams = ref<Record<number, PlayerRow[]>>({})

onMounted(async () => {
  try {
    const [leagueData, playersData, captainsData, draftPicksData, seedHoldersData, swapLogData] = await Promise.all([
      getLeague(leagueId),
      getPlayers(),
      getCaptains(leagueId),
      getDraftPicks(leagueId),
      getSeedHolders(leagueId),
      getSwapLog(leagueId),
    ])
    if (!leagueData.is_ready || captainsData.length === 0) {
      router.replace({ name: 'league-detail', params: { id: leagueId } })
      return
    }

    league.value = leagueData
    allPlayers.value = playersData
    seedHolderIds.value = new Set(seedHoldersData.map(h => h.player_id))
    seedOrderIds.value = [...seedHoldersData]
      .sort((a, b) => a.order_num - b.order_num)
      .map(h => h.player_id)

    captainIds.value = captainsData
      .sort((a, b) => a.order_num - b.order_num)
      .map(c => c.player_id)

    const teamsMap: Record<number, PlayerRow[]> = {}
    for (const cid of captainIds.value) teamsMap[cid] = []
    const sorted = [...draftPicksData].sort((a, b) => a.pick_order - b.pick_order)
    for (const pick of sorted) {
      if (!teamsMap[pick.captain_player_id]) teamsMap[pick.captain_player_id] = []
      const player = playersData.find(p => p.id === pick.member_player_id)
      if (player) teamsMap[pick.captain_player_id].push(player)
    }
    teams.value = teamsMap

    // swap log 복원
    if (swapLogData.length > 0) {
      const resolved = swapLogData.map(row => ({
        seedHolderName: playersData.find(p => p.id === row.seed_holder_player_id)?.nickname ?? '',
        myName: playersData.find(p => p.id === row.from_player_id)?.nickname ?? '',
        theirName: playersData.find(p => p.id === row.to_player_id)?.nickname ?? '',
        myTeamCaptainName: (() => {
          for (const [cIdStr, members] of Object.entries(teamsMap)) {
            if (members.find(m => m.id === row.to_player_id)) return playersData.find(p => p.id === Number(cIdStr))?.nickname ?? ''
          }
          return ''
        })(),
        theirTeamCaptainName: (() => {
          for (const [cIdStr, members] of Object.entries(teamsMap)) {
            if (members.find(m => m.id === row.from_player_id)) return playersData.find(p => p.id === Number(cIdStr))?.nickname ?? ''
          }
          return ''
        })(),
        seedHolderPlayerId: row.seed_holder_player_id,
        fromPlayerId: row.from_player_id,
        toPlayerId: row.to_player_id,
      }))
      swapLog.value = resolved
      swappedIds.value = new Set(swapLogData.flatMap(r => [r.from_player_id, r.to_player_id]))
      seedSwapDone.value = true
    }

    // 지목식 완료 → 읽기 전용
    if (leagueData.draft_completed) {
      isSaved.value = true
    }
  } catch (e: any) {
    loadError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 헬퍼 ─────────────────────────────────────────────────
function playerById(id: number) {
  return allPlayers.value.find(p => p.id === id) ?? null
}

// ── 토스트 ───────────────────────────────────────────────
const { toast, showToast } = useToast()

// ── 풀 계산 ────────────────────────────────────────────────
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

function tierCount(tier: string) {
  return RACE_ORDER.reduce((sum, r) => sum + (playersByTierRace.value[tier]?.[r]?.length ?? 0), 0)
}

// ── 팀 통계 ───────────────────────────────────────────────
function teamTierCount(captainId: number, tier: string) {
  return (teams.value[captainId] ?? []).filter(m => m.tier === tier).length
}

function teamRaceCount(captainId: number, race: string) {
  return (teams.value[captainId] ?? []).filter(m => m.race === race).length
}

// ── 스네이크 드래프트 순번 ────────────────────────────────
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

// ── 드래그 앤 드롭 ───────────────────────────────────────
const {
  dragOverTeam, dragOverPool, draggingId,
  onPointerDown, removeFromTeam,
} = useDraftDnD(allPlayers, teams, currentCaptainId)

// ── 시드권 교체 ──────────────────────────────────────────
const {
  seedSwapMode, seedSwapDone, currentSeedIdx, swapSel, lockedIds, swappedIds,
  swapError, swapErrorKey, swapLog,
  currentSeedHolderId, currentSeedHolderCaptainId,
  seedOrderSetupMode, seedOrderDraft,
  openSeedOrderSetup, moveSeedOrder, confirmSeedOrder,
  resetSeedSwap: _resetSeedSwap,
  onMemberClick, passSeed,
} = useSeedSwap(teams, captainIds, seedHolderIds, seedOrderIds, playerById, showToast)

// ── 저장 ──────────────────────────────────────────────────
const isSaved = ref(false)
const saving = ref(false)

function resetSeedSwap() {
  _resetSeedSwap()
  isSaved.value = false
}

// 시드권 교체까지 완료된 최종 저장 여부
const isFinalSave = computed(() => seedSwapDone.value && isSaved.value)

async function saveDraft() {
  saving.value = true
  const isFinal = seedSwapDone.value
  try {
    const allPicks: Array<{ captain_player_id: number; member_player_id: number; pick_order: number }> = []
    for (const [cIdStr, members] of Object.entries(teams.value)) {
      const cId = Number(cIdStr)
      members.forEach((m, i) => allPicks.push({ captain_player_id: cId, member_player_id: m.id, pick_order: i + 1 }))
    }

    if (isFinal) {
      const logEntries = swapLog.value.map((e, i) => ({
        order_num: i + 1,
        seed_holder_player_id: e.seedHolderPlayerId,
        from_player_id: e.fromPlayerId,
        to_player_id: e.toPlayerId,
      }))
      await Promise.all([
        saveDraftPicks(leagueId, allPicks),
        saveSwapLog(leagueId, logEntries),
        setDraftCompleted(leagueId),
      ])
      isSaved.value = true
      showToast('최종 저장 완료. 지목식이 종료되었습니다.')
    } else {
      const tasks: Promise<unknown>[] = [saveDraftPicks(leagueId, allPicks)]
      if (draftDone.value) tasks.push(setPicksCompleted(leagueId))
      await Promise.all(tasks)
      showToast('임시 저장되었습니다.')
    }
  } catch {
    showToast('저장 중 오류가 발생했습니다.')
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './DraftView.scss';
</style>
