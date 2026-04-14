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
      <div v-if="seedOrderSetupMode" class="modal-backdrop" @click.self="seedOrderSetupMode = false">
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

const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

const TIER_ORDER = ['A', 'B', 'C', 'D', 'E'] as const
const RACE_ORDER = ['T', 'Z', 'P'] as const
const TIER_RANK: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 }

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

// ── 드래그 앤 드롭 (pointer events 기반) ─────────────────
const draggedPlayerId = ref<number | null>(null)
const dragSource = ref<'pool' | number>('pool')
const dragOverTeam = ref<number | null>(null)
const dragOverPool = ref(false)
const draggingId = ref<number | null>(null)

let _dragClone: HTMLElement | null = null
let _dragOffsetX = 0
let _dragOffsetY = 0

function onPointerDown(e: PointerEvent, playerId: number, source: 'pool' | number) {
  if (e.button !== 0) return
  e.preventDefault()

  const el = e.currentTarget as HTMLElement
  const rect = el.getBoundingClientRect()
  _dragOffsetX = e.clientX - rect.left
  _dragOffsetY = e.clientY - rect.top

  // 실제 카드를 그대로 복제해 body에 붙임 — 커서를 따라 움직임
  const clone = el.cloneNode(true) as HTMLElement
  clone.style.cssText = `
    position: fixed;
    left: ${rect.left}px;
    top: ${rect.top}px;
    width: ${rect.width - 25}px;
    height: ${rect.height - 10}px;
    pointer-events: none;
    z-index: 9999;
    margin: 0;
    opacity: 1;
    box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
    transform: scale(1.05);
    transition: none;
    border-radius: 7px;
  `
  document.body.appendChild(clone)
  _dragClone = clone

  draggedPlayerId.value = playerId
  dragSource.value = source
  draggingId.value = playerId

  document.addEventListener('pointermove', _onPointerMove)
  document.addEventListener('pointerup', _onPointerUp)
}

function _onPointerMove(e: PointerEvent) {
  if (!_dragClone) return
  _dragClone.style.left = `${e.clientX - _dragOffsetX}px`
  _dragClone.style.top = `${e.clientY - _dragOffsetY}px`

  // clone은 pointer-events: none이라 elementsFromPoint에서 건너뜀
  const els = document.elementsFromPoint(e.clientX, e.clientY)
  const teamCol = els.find(el => (el as HTMLElement).dataset.captainId) as HTMLElement | undefined
  const pool = els.find(el => el.hasAttribute('data-drop-pool'))

  if (teamCol) {
    const cid = Number(teamCol.dataset.captainId)
    dragOverTeam.value = cid === currentCaptainId.value ? cid : null
    dragOverPool.value = false
  } else if (pool && dragSource.value !== 'pool') {
    dragOverPool.value = true
    dragOverTeam.value = null
  } else {
    dragOverTeam.value = null
    dragOverPool.value = false
  }
}

function _onPointerUp(e: PointerEvent) {
  document.removeEventListener('pointermove', _onPointerMove)
  document.removeEventListener('pointerup', _onPointerUp)

  if (_dragClone) {
    _dragClone.remove()
    _dragClone = null
  }

  const pid = draggedPlayerId.value
  if (pid) {
    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const teamCol = els.find(el => (el as HTMLElement).dataset.captainId) as HTMLElement | undefined
    const pool = els.find(el => el.hasAttribute('data-drop-pool'))

    if (teamCol) {
      const cid = Number(teamCol.dataset.captainId)
      if (cid === currentCaptainId.value && !(teams.value[cid] ?? []).find(p => p.id === pid)) {
        if (dragSource.value !== 'pool') {
          const prev = dragSource.value as number
          teams.value[prev] = (teams.value[prev] ?? []).filter(p => p.id !== pid)
        }
        const player = allPlayers.value.find(p => p.id === pid)
        if (player) {
          if (!teams.value[cid]) teams.value[cid] = []
          teams.value[cid] = [...teams.value[cid], player]
        }
      }
    } else if (pool && dragSource.value !== 'pool') {
      const prev = dragSource.value as number
      teams.value[prev] = (teams.value[prev] ?? []).filter(p => p.id !== pid)
    }
  }

  draggingId.value = null
  draggedPlayerId.value = null
  dragOverTeam.value = null
  dragOverPool.value = false
}

function removeFromTeam(captainId: number, memberId: number) {
  teams.value[captainId] = (teams.value[captainId] ?? []).filter(p => p.id !== memberId)
}

// ── 시드권 순서 설정 ──────────────────────────────────────
const seedOrderSetupMode = ref(false)
const seedOrderDraft = ref<number[]>([])

function openSeedOrderSetup() {
  seedOrderDraft.value = [...seedOrderIds.value]
  seedOrderSetupMode.value = true
}

function moveSeedOrder(i: number, dir: -1 | 1) {
  const arr = [...seedOrderDraft.value]
  const j = i + dir
  ;[arr[i], arr[j]] = [arr[j], arr[i]]
  seedOrderDraft.value = arr
}

function confirmSeedOrder() {
  seedOrderIds.value = [...seedOrderDraft.value]
  seedOrderSetupMode.value = false
  startSeedSwap()
}

// ── 시드권 적용 ───────────────────────────────────────────
const seedSwapMode = ref(false)
const seedSwapDone = ref(false)
const preSeedTeams = ref<Record<number, PlayerRow[]> | null>(null)
const currentSeedIdx = ref(0)
const swapSel = ref<{ captainId: number; member: PlayerRow; pickIdx: number } | null>(null)
const lockedIds = ref(new Set<number>())
const swappedIds = ref(new Set<number>())
const swapError = ref<string | null>(null)
const swapErrorKey = ref(0)

interface SwapLogEntry {
  seedHolderName: string
  myName: string
  theirName: string
  myTeamCaptainName: string
  theirTeamCaptainName: string
  // DB 저장용
  seedHolderPlayerId: number
  fromPlayerId: number
  toPlayerId: number
}
const swapLog = ref<SwapLogEntry[]>([])

const currentSeedHolderId = computed(() => seedOrderIds.value[currentSeedIdx.value] ?? null)

const currentSeedHolderCaptainId = computed((): number | null => {
  const pid = currentSeedHolderId.value
  if (pid === null) return null
  if (captainIds.value.includes(pid)) return pid
  for (const [cIdStr, members] of Object.entries(teams.value)) {
    if (members.find(m => m.id === pid)) return Number(cIdStr)
  }
  return null
})

function startSeedSwap() {
  preSeedTeams.value = Object.fromEntries(
    Object.entries(teams.value).map(([k, v]) => [Number(k), [...v]]),
  )
  seedSwapDone.value = false
  swappedIds.value = new Set()
  swapLog.value = []
  seedSwapMode.value = true
  currentSeedIdx.value = 0
  swapSel.value = null
  lockedIds.value = new Set()
  swapError.value = null
  swapErrorKey.value = 0
}

function resetSeedSwap() {
  if (preSeedTeams.value) {
    teams.value = Object.fromEntries(
      Object.entries(preSeedTeams.value).map(([k, v]) => [Number(k), [...v]]),
    )
  }
  seedSwapMode.value = false
  seedSwapDone.value = false
  currentSeedIdx.value = 0
  swappedIds.value = new Set()
  lockedIds.value = new Set()
  swapLog.value = []
  swapSel.value = null
  swapError.value = null
  swapErrorKey.value = 0
  preSeedTeams.value = null
  isSaved.value = false
  showToast('시드권 적용이 초기화되었습니다')
}

function validateFirstClick(_captainId: number, member: PlayerRow, pickIdx: number): string | null {
  if (lockedIds.value.has(member.id)) return `${member.nickname}은 이미 교체된 멤버입니다`
  if (seedHolderIds.value.has(member.id)) return `${member.nickname}은 시드권 보유자로 교체 불가합니다`
  if (pickIdx === 0) return `1번 픽(${member.nickname})은 시드권 적용 불가합니다`
  return null
}

function validateSwap(
  a: { captainId: number; member: PlayerRow; pickIdx: number },
  b: { captainId: number; member: PlayerRow; pickIdx: number },
): string | null {
  if (lockedIds.value.has(b.member.id)) return `${b.member.nickname}은 이미 교체된 멤버입니다`
  if (seedHolderIds.value.has(b.member.id)) return `${b.member.nickname}은 시드권 보유자로 교체 불가합니다`
  if (b.pickIdx === 0) return `1번 픽(${b.member.nickname})은 시드권 적용 불가합니다`

  const tierDiff = Math.abs((TIER_RANK[a.member.tier] ?? 0) - (TIER_RANK[b.member.tier] ?? 0))
  if (tierDiff >= 2) return '두 티어 이상 차이나는 멤버는 시드권 적용 불가합니다'

  const aNum = a.pickIdx + 1
  const bNum = b.pickIdx + 1
  if (Math.abs(aNum - bNum) >= 3) return '세 픽 이상 차이나는 멤버는 시드권 적용 불가합니다'

  return null
}

function onMemberClick(captainId: number, member: PlayerRow, idx: number) {
  if (!seedSwapMode.value) return

  const setError = (msg: string) => {
    swapError.value = msg
    swapErrorKey.value++
  }

  if (!swapSel.value) {
    // 첫 번째 선택 — 반드시 시드권 보유 팀 멤버여야 함
    if (captainId !== currentSeedHolderCaptainId.value) {
      setError('시드권 보유 팀의 멤버를 먼저 선택하세요')
      return
    }
    const err = validateFirstClick(captainId, member, idx)
    if (err) { setError(err); return }
    swapError.value = null
    swapSel.value = { captainId, member, pickIdx: idx }
    return
  }

  // 같은 멤버 → 선택 해제
  if (swapSel.value.member.id === member.id) {
    swapSel.value = null
    swapError.value = null
    return
  }

  // 같은 팀(시드권 보유 팀) → 선택 변경 (규칙 재검증)
  if (swapSel.value.captainId === captainId) {
    const err = validateFirstClick(captainId, member, idx)
    if (err) { setError(err); return }
    swapError.value = null
    swapSel.value = { captainId, member, pickIdx: idx }
    return
  }

  // 다른 팀 → 교체 시도
  const err = validateSwap(swapSel.value, { captainId, member, pickIdx: idx })
  if (err) { setError(err); return }

  const a = swapSel.value
  const b = { captainId, member, pickIdx: idx }
  const aMembers = [...(teams.value[a.captainId] ?? [])]
  const bMembers = [...(teams.value[b.captainId] ?? [])]
  aMembers[a.pickIdx] = b.member
  bMembers[b.pickIdx] = a.member
  teams.value[a.captainId] = aMembers
  teams.value[b.captainId] = bMembers

  lockedIds.value = new Set([...lockedIds.value, a.member.id, b.member.id])
  swappedIds.value = new Set([...swappedIds.value, a.member.id, b.member.id])
  swapLog.value.push({
    seedHolderName: playerById(currentSeedHolderId.value!)?.nickname ?? '',
    myName: a.member.nickname,
    theirName: b.member.nickname,
    myTeamCaptainName: playerById(a.captainId)?.nickname ?? '',
    theirTeamCaptainName: playerById(b.captainId)?.nickname ?? '',
    seedHolderPlayerId: currentSeedHolderId.value!,
    fromPlayerId: a.member.id,
    toPlayerId: b.member.id,
  })
  swapSel.value = null
  swapError.value = null
  showToast(`${a.member.nickname} ↔ ${b.member.nickname} 교체 완료`)
  advanceSeed()
}

function passSeed() {
  swapSel.value = null
  swapError.value = null
  showToast(`${playerById(currentSeedHolderId.value!)?.nickname} 시드권 패스`)
  advanceSeed()
}

function advanceSeed() {
  currentSeedIdx.value++
  if (currentSeedIdx.value >= seedOrderIds.value.length) {
    seedSwapMode.value = false
    seedSwapDone.value = true
    showToast('모든 시드권 적용이 완료되었습니다')
  }
}

// ── 저장 ──────────────────────────────────────────────────
const isSaved = ref(false)
const saving = ref(false)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
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
