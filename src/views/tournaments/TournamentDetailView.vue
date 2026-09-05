<template>
  <div class="tournament-detail-page">
    <AppHeader />

    <div class="tournament-detail-content">
      <button class="btn-back" @click="$router.push({ name: 'tournaments' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        토너먼트 목록
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

      <template v-else-if="tournament">
        <div class="tournament-header">
          <span class="tournament-status" :class="`status--${tournament.status.toLowerCase()}`">
            {{ TOURNAMENT_STATUS_LABEL[tournament.status] }}
          </span>
          <h1 class="tournament-title">{{ tournament.name }}</h1>
        </div>
        <p class="tournament-meta">
          시작 {{ formatDateTime(tournament.start_at) }} · 주최자 {{ hostName }} · 참가 {{ players.length }}명
        </p>

        <p v-if="tournament.status === 'FINISHED' && tournament.winner_user_id" class="winner-banner">
          {{ nicknameOf(tournament.winner_user_id) }} 우승
        </p>

        <p v-if="actionError" class="save-error">{{ actionError }}</p>

        <!-- ── RECRUITING ─────────────────────────────────── -->
        <template v-if="tournament.status === 'RECRUITING'">
          <section v-if="!myEntry && myPlayer" class="join-section">
            <template v-if="!myPlayer.is_active">
              <p class="state-msg state-msg--error">정지된 계정은 토너먼트에 참가할 수 없습니다.</p>
            </template>
            <template v-else-if="!isMyTierEligible">
              <p class="state-msg state-msg--error">참여 가능한 티어가 아닙니다. (허용 티어: {{ allowedTiersLabel }})</p>
            </template>
            <template v-else-if="recruitmentClosed">
              <p class="state-msg">모집이 마감되었습니다.</p>
            </template>
            <template v-else>
              <p class="section-label">참가 종족 선택</p>
              <div class="race-select-group">
                <button
                  v-for="r in races"
                  :key="r.value"
                  type="button"
                  class="race-select-btn"
                  :class="[`race-select-btn--${r.value.toLowerCase()}`, { active: selectedRace === r.value }]"
                  @click="selectedRace = r.value"
                >{{ r.label }}</button>
              </div>
              <p v-if="selectedRace !== myPlayer.race" class="field-hint">
                주종족({{ raceLabel(myPlayer.race) }})과 달라 부종족 참가로 처리됩니다.
                티어는 주종족 티어({{ myPlayer.tier }})가 그대로 적용되고, 이 토너먼트의 전적은 반영되지 않습니다.
              </p>
              <button class="btn-save" :disabled="joining" @click="handleJoin">
                {{ joining ? '참가 중...' : '참가하기' }}
              </button>
            </template>
          </section>

          <section v-else-if="myEntry" class="join-section">
            <p class="state-msg">
              참가 완료 — {{ raceLabel(myEntry.race) }}{{ myEntry.is_offrace ? ' (부종족)' : '' }} / {{ myEntry.tier }}
            </p>
            <button class="btn-cancel" :disabled="joining" @click="handleLeave">
              {{ joining ? '처리 중...' : '참가 취소' }}
            </button>
          </section>
        </template>

        <!-- ── 참여 가능 티어 ─────────────────────────────── -->
        <section class="tier-restriction-section">
          <p class="section-label">참여 가능 티어</p>
          <p class="tier-restriction-value">{{ allowedTiersLabel }}</p>

          <template v-if="canEditTiers">
            <div class="tier-select-grid">
              <button
                v-for="t in TIER_ORDER"
                :key="t"
                type="button"
                class="tier-toggle-btn"
                :class="[`tier-badge--${$tierClass(t)}`, { 'tier-toggle-btn--off': !draftTiers.has(t) }]"
                @click="toggleDraftTier(t)"
              >{{ t }}</button>
            </div>
            <p v-if="tiersError" class="save-error">{{ tiersError }}</p>
            <button v-if="tiersDirty" class="btn-save" :disabled="savingTiers" @click="handleSaveTiers">
              {{ savingTiers ? '저장 중...' : '티어 설정 저장' }}
            </button>
          </template>
        </section>

        <!-- 참가자 목록 -->
        <section class="players-section">
          <p class="section-label">참가자 ({{ players.length }}명)</p>
          <div v-if="players.length === 0" class="state-msg">아직 참가자가 없습니다.</div>
          <div v-else class="player-chip-list">
            <span
              v-for="p in players"
              :key="p.user_id"
              class="player-chip"
              :class="{ 'player-chip--host': p.user_id === tournament.host_user_id }"
            >
              <span class="tier-badge" :class="`tier-badge--${$tierClass(p.tier)}`">{{ p.tier }}</span>
              <span class="race-badge" :class="`race-badge--${p.race.toLowerCase()}`">{{ raceLabel(p.race) }}</span>
              {{ nicknameOf(p.user_id) }}
              <span v-if="p.is_offrace" class="offrace-mark">부종</span>
              <span v-if="p.user_id === tournament.host_user_id" class="host-mark">주최</span>
            </span>
          </div>
        </section>

        <!-- ── 맵 (단일) ──────────────────────────────────── -->
        <section class="map-section">
          <p class="section-label">경기 맵</p>
          <div v-if="!selectedMap" class="state-msg">아직 맵이 선택되지 않았습니다.</div>
          <div v-else class="map-selected-row">
            <img v-if="selectedMap.thumbnail_url" :src="selectedMap.thumbnail_url" class="map-selected-thumb" alt="" />
            <span class="map-selected-name">{{ selectedMap.name }}</span>
          </div>
          <button v-if="canEditMap" class="btn-pill btn-pill--md btn-pill--ghost" @click="openMapPicker">
            {{ selectedMap ? '맵 변경' : '맵 선택' }}
          </button>
        </section>

        <!-- ── 대진 생성 ──────────────────────────────────── -->
        <section v-if="isHost && tournament.status === 'RECRUITING'" class="bracket-generate-section">
          <p class="section-label">대진 생성</p>
          <button
            class="btn-pill btn-pill--md btn-pill--purple"
            :disabled="players.length < 4 || !tournament.map_id || generating"
            @click="handleGenerateBracket"
          >
            {{ generating ? '생성 중...' : '대진 생성 (모집 마감)' }}
          </button>
          <p v-if="players.length < 4" class="field-hint">
            최소 4명이 모여야 대진을 생성할 수 있습니다. (현재 {{ players.length }}명)
          </p>
          <p v-else-if="!tournament.map_id" class="field-hint">맵을 먼저 지정해주세요.</p>
        </section>

        <!-- ── 대진표 (좌→우 트리) ────────────────────────── -->
        <section v-if="matches.length > 0" class="bracket-section">
          <p class="section-label">대진표</p>
          <p v-if="matchError" class="save-error">{{ matchError }}</p>

          <TournamentBracket
            :matches="matches"
            :nickname-of="nicknameOf"
            interactive
            :can-pick="canPickWinner"
            :reporting-key="reportingMatch"
            @pick="handleSetWinner"
          />

          <div v-if="isHost && tournament.status === 'PLAYING' && finalMatch?.winner_user_id" class="finish-row">
            <button class="btn-pill btn-pill--md btn-pill--purple" :disabled="finishing" @click="handleFinish">
              {{ finishing ? '처리 중...' : '우승 확정' }}
            </button>
          </div>
        </section>
      </template>
    </div>

    <!-- ── 맵 선택 오버레이 ───────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showMapPicker" class="overlay-backdrop">
        <div class="picker-panel">
          <div class="picker-header">
            <span class="picker-title">맵 선택</span>
            <button class="picker-close" @click="showMapPicker = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <input v-model="mapSearch" class="picker-search" placeholder="맵 이름 또는 별칭 검색..." type="text" />
          <div class="picker-list">
            <button
              v-for="map in filteredMaps"
              :key="map.id"
              class="picker-item map-picker-item"
              :class="{ selected: map.id === tournament?.map_id }"
              @click="handleSelectMap(map.id)"
            >
              <img v-if="map.thumbnail_url" :src="map.thumbnail_url" class="picker-map-thumb" alt="" />
              <div class="picker-map-info">
                <span class="picker-name">{{ map.name }}</span>
                <span class="picker-map-meta">{{ map.player_count }}인 · {{ map.tileset }}</span>
              </div>
            </button>
            <div v-if="filteredMaps.length === 0" class="picker-empty">검색 결과 없음</div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import TournamentBracket from './TournamentBracket.vue'
import { useAuthStore } from '@/stores/auth'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getMaps, type MapRow } from '@/lib/maps'
import { normalizeTier, TIER_ORDER } from '@/lib/constants'
import {
  getTournament, getTournamentPlayers, joinTournament, leaveTournament, setTournamentMap,
  generateBracket, getTournamentMatches, setTournamentMatchWinner, finishTournament,
  setTournamentAllowedTiers,
  TOURNAMENT_STATUS_LABEL, type TournamentRow, type TournamentPlayerRow, type TournamentMatchRow,
} from '@/lib/tournaments'

const route = useRoute()
const auth = useAuthStore()

const tournament = ref<TournamentRow | null>(null)
const players = ref<TournamentPlayerRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const myPlayer = ref<PlayerRow | null>(null)
const allMaps = ref<MapRow[]>([])
const matches = ref<TournamentMatchRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)

const races = [
  { value: 'T' as const, label: '테란' },
  { value: 'Z' as const, label: '저그' },
  { value: 'P' as const, label: '프로토스' },
]
const raceLabel = (r: string) => races.find(x => x.value === r)?.label ?? r
const nicknameOf = (userId: number | null) =>
  userId === null ? '-' : (allPlayers.value.find(p => p.id === userId)?.nickname ?? `선수 ${userId}`)

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

const hostName = computed(() => tournament.value ? nicknameOf(tournament.value.host_user_id) : '')
const myEntry = computed(() => players.value.find(p => p.user_id === myPlayer.value?.id) ?? null)
const recruitmentClosed = computed(() => !!tournament.value && new Date() >= new Date(tournament.value.start_at))
const isHost = computed(() => !!myPlayer.value && !!tournament.value && myPlayer.value.id === tournament.value.host_user_id)
const canEditMap = computed(() => isHost.value && !!tournament.value && tournament.value.status === 'RECRUITING')
const selectedMap = computed(() => allMaps.value.find(m => m.id === tournament.value?.map_id) ?? null)

// ── 참여 가능 티어 ─────────────────────────────────────────
const draftTiers = ref<Set<string>>(new Set(TIER_ORDER))
const savingTiers = ref(false)
const tiersError = ref<string | null>(null)

const allowedTiersLabel = computed(() =>
  tournament.value?.allowed_tiers ? tournament.value.allowed_tiers.join(', ') : '전체 티어 참여 가능',
)
const isMyTierEligible = computed(() => {
  if (!tournament.value?.allowed_tiers || !myPlayer.value) return true
  return tournament.value.allowed_tiers.includes(normalizeTier(myPlayer.value.tier))
})
const canEditTiers = computed(() => isHost.value && !!tournament.value && tournament.value.status === 'RECRUITING')
const tiersDirty = computed(() => {
  const saved = [...(tournament.value?.allowed_tiers ?? TIER_ORDER)].sort().join(',')
  const draft = [...draftTiers.value].sort().join(',')
  return saved !== draft
})

function toggleDraftTier(tier: string) {
  const next = new Set(draftTiers.value)
  if (next.has(tier)) next.delete(tier)
  else next.add(tier)
  draftTiers.value = next
}

async function handleSaveTiers() {
  if (!tournament.value) return
  if (draftTiers.value.size === 0) { tiersError.value = '최소 1개 티어는 선택해야 합니다.'; return }
  savingTiers.value = true
  tiersError.value = null
  try {
    const tiers = draftTiers.value.size === TIER_ORDER.length ? null : [...draftTiers.value]
    await setTournamentAllowedTiers(tournament.value.id, tiers)
    tournament.value = await getTournament(tournament.value.id)
  } catch (e: any) {
    tiersError.value = e.message ?? '티어 설정 저장 중 오류가 발생했습니다.'
  } finally {
    savingTiers.value = false
  }
}

async function load() {
  const id = route.params.id as string
  const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
  const [t, p, all, me, maps, m] = await Promise.all([
    getTournament(id),
    getTournamentPlayers(id),
    getPlayers(),
    discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    getMaps(),
    getTournamentMatches(id),
  ])
  tournament.value = t
  players.value = p
  allPlayers.value = all
  myPlayer.value = me
  allMaps.value = maps
  matches.value = m
  draftTiers.value = new Set(t.allowed_tiers ?? TIER_ORDER)
}

onMounted(async () => {
  try {
    await load()
  } catch (e: any) {
    loadError.value = e.message ?? '토너먼트 정보를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 참가/취소 ─────────────────────────────────────────────
const selectedRace = ref<'T' | 'Z' | 'P'>('T')
const joining = ref(false)

function resetSelectedRace() {
  if (myPlayer.value) selectedRace.value = myPlayer.value.race
}

async function handleJoin() {
  if (!tournament.value || !myPlayer.value) return
  joining.value = true
  actionError.value = null
  try {
    await joinTournament(tournament.value.id, myPlayer.value, selectedRace.value)
    players.value = await getTournamentPlayers(tournament.value.id)
  } catch (e: any) {
    actionError.value = e.message ?? '참가 처리 중 오류가 발생했습니다.'
  } finally {
    joining.value = false
  }
}

async function handleLeave() {
  if (!tournament.value || !myPlayer.value) return
  joining.value = true
  actionError.value = null
  try {
    await leaveTournament(tournament.value.id, myPlayer.value.id)
    players.value = await getTournamentPlayers(tournament.value.id)
  } catch (e: any) {
    actionError.value = e.message ?? '참가 취소 중 오류가 발생했습니다.'
  } finally {
    joining.value = false
  }
}

// myPlayer 로딩 완료 시 종족 선택 기본값을 주종족으로
watch(myPlayer, resetSelectedRace)

// ── 맵 선택 ───────────────────────────────────────────────
const showMapPicker = ref(false)
const mapSearch = ref('')

const filteredMaps = computed(() => {
  const q = mapSearch.value.trim().toLowerCase()
  if (!q) return allMaps.value
  return allMaps.value.filter(m => m.name.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q)))
})

function openMapPicker() {
  mapSearch.value = ''
  showMapPicker.value = true
}

async function handleSelectMap(mapId: string) {
  if (!tournament.value) return
  actionError.value = null
  try {
    await setTournamentMap(tournament.value.id, mapId)
    tournament.value = await getTournament(tournament.value.id)
    showMapPicker.value = false
  } catch (e: any) {
    actionError.value = e.message ?? '맵 지정 중 오류가 발생했습니다.'
  }
}

// ── 대진 생성 ─────────────────────────────────────────────
const generating = ref(false)

async function handleGenerateBracket() {
  if (!tournament.value) return
  generating.value = true
  actionError.value = null
  try {
    matches.value = await generateBracket(tournament.value.id)
    tournament.value = await getTournament(tournament.value.id)
  } catch (e: any) {
    actionError.value = e.message ?? '대진 생성 중 오류가 발생했습니다.'
  } finally {
    generating.value = false
  }
}

// ── 대진표 / 경기 결과 ────────────────────────────────────
const reportingMatch = ref<string | null>(null)
const matchError = ref<string | null>(null)
const finishing = ref(false)

const maxRound = computed(() =>
  matches.value.length > 0 ? Math.max(...matches.value.map(m => m.round)) : 0,
)
const finalMatch = computed(() => matches.value.find(m => m.round === maxRound.value) ?? null)

/** 주최자는 모든 경기를, 그 외엔 자기가 뛴 경기 결과만 직접 기록할 수 있다 */
function canPickWinner(m: TournamentMatchRow): boolean {
  if (tournament.value?.status !== 'PLAYING') return false
  if (!m.player1_user_id || !m.player2_user_id) return false
  if (reportingMatch.value !== null) return false
  if (isHost.value) return true
  const myId = myPlayer.value?.id
  return myId === m.player1_user_id || myId === m.player2_user_id
}

async function handleSetWinner(m: TournamentMatchRow, winnerUserId: number) {
  if (!tournament.value) return
  const key = `${m.round}-${m.slot}`
  reportingMatch.value = key
  matchError.value = null
  try {
    await setTournamentMatchWinner(tournament.value.id, m.round, m.slot, winnerUserId)
    matches.value = await getTournamentMatches(tournament.value.id)
  } catch (e: any) {
    matchError.value = e.message ?? '경기 결과 저장 중 오류가 발생했습니다.'
  } finally {
    reportingMatch.value = null
  }
}

async function handleFinish() {
  if (!tournament.value) return
  finishing.value = true
  matchError.value = null
  try {
    await finishTournament(tournament.value.id)
    tournament.value = await getTournament(tournament.value.id)
  } catch (e: any) {
    matchError.value = e.message ?? '우승 확정 중 오류가 발생했습니다.'
  } finally {
    finishing.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TournamentDetailView.scss';
</style>
