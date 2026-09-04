<template>
  <div class="battle-detail-page">
    <AppHeader />

    <div class="battle-detail-content">
      <button class="btn-back" @click="$router.push({ name: 'team-battles' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        팀배틀 목록
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

      <template v-else-if="battle">
        <div class="battle-header">
          <span class="battle-status" :class="`status--${battle.status.toLowerCase()}`">
            {{ recruitmentClosed && battle.status === 'RECRUITING' ? '모집 마감' : TEAM_BATTLE_STATUS_LABEL[battle.status] }}
          </span>
          <h1 class="battle-title">{{ battle.name }}</h1>
        </div>
        <p class="battle-meta">
          시작 {{ formatDateTime(battle.start_at) }} · 주최자 {{ hostName }} · 참가 {{ players.length }}명
        </p>

        <p v-if="actionError" class="save-error">{{ actionError }}</p>

        <!-- ── RECRUITING ─────────────────────────────────── -->
        <template v-if="battle.status === 'RECRUITING'">
          <section v-if="!myEntry && myPlayer" class="join-section">
            <template v-if="!myPlayer.is_active">
              <p class="state-msg state-msg--error">정지된 계정은 팀배틀에 참가할 수 없습니다.</p>
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
                티어는 주종족 티어({{ myPlayer.tier }})가 그대로 적용되고, 이 팀배틀의 전적은 반영되지 않습니다.
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

        <!-- 참가자 목록 (팀 배정 전) -->
        <section v-if="battle.status === 'RECRUITING'" class="players-section">
          <p class="section-label">참가자 ({{ players.length }}명)</p>
          <div v-if="players.length === 0" class="state-msg">아직 참가자가 없습니다.</div>
          <div v-else class="player-chip-list">
            <span
              v-for="p in players"
              :key="p.user_id"
              class="player-chip"
              :class="{ 'player-chip--host': p.user_id === battle.host_user_id }"
            >
              <span class="tier-badge" :class="`tier-badge--${$tierClass(p.tier)}`">{{ p.tier }}</span>
              <span class="race-badge" :class="`race-badge--${p.race.toLowerCase()}`">{{ raceLabel(p.race) }}</span>
              {{ nicknameOf(p.user_id) }}
              <span v-if="p.is_offrace" class="offrace-mark">부종</span>
              <span v-if="p.user_id === battle.host_user_id" class="host-mark">주최</span>
            </span>
          </div>
        </section>

        <!-- 팀 로스터 (팀 배정 후) -->
        <section v-else class="teams-section">
          <div v-for="teamNo in [1, 2] as const" :key="teamNo" class="team-panel">
            <div class="team-panel-header">
              <span class="team-panel-title">TEAM {{ teamNo }}</span>
              <span class="team-panel-score">{{ teamScore(teamNo) }}점</span>
            </div>
            <div class="team-player-list">
              <div
                v-for="p in teamPlayers(teamNo)"
                :key="p.user_id"
                class="team-player-row"
                :class="{ 'team-player-row--leader': p.is_leader }"
              >
                <span class="tier-badge" :class="`tier-badge--${$tierClass(p.tier)}`">{{ p.tier }}</span>
                <span class="race-badge" :class="`race-badge--${p.race.toLowerCase()}`">{{ raceLabel(p.race) }}</span>
                <span class="team-player-name">{{ nicknameOf(p.user_id) }}</span>
                <span v-if="p.is_offrace" class="offrace-mark">부종</span>
                <span v-if="p.is_leader" class="leader-mark">팀장</span>
                <button
                  v-if="isHost && !p.is_leader && battle.status === 'ASSIGNED'"
                  class="team-player-captain-btn"
                  :disabled="reassigning"
                  @click="handleReassignLeader(teamNo, p.user_id)"
                >팀장 지정</button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── 팀 배정 ────────────────────────────────────── -->
        <section v-if="canAssign" class="assign-section">
          <div class="section-label-row">
            <p class="section-label">팀 배정</p>
            <button
              class="btn-pill btn-pill--md btn-pill--purple"
              :disabled="assigning || players.length < 4"
              @click="handleAssignTeams"
            >
              {{ assigning ? '배정 중...' : (battle.status === 'ASSIGNED' ? '다시 배정' : '팀 배정 (모집 마감)') }}
            </button>
          </div>
          <p v-if="players.length < 4" class="field-hint">
            최소 4명이 모여야 팀을 배정할 수 있습니다. (현재 {{ players.length }}명)
          </p>
          <p v-if="assignError" class="save-error">{{ assignError }}</p>
        </section>

        <!-- ── 맵 ─────────────────────────────────────────── -->
        <section class="maps-section">
          <div class="section-label-row">
            <p class="section-label">경기 맵 ({{ battleMaps.length }}개)</p>
            <button v-if="canEditMaps" class="btn-pill btn-pill--md btn-pill--ghost" @click="openMapPicker">
              맵 추가
            </button>
          </div>

          <div v-if="battleMaps.length === 0" class="state-msg">아직 맵이 선택되지 않았습니다.</div>
          <ol v-else class="map-order-list">
            <li v-for="(m, i) in battleMaps" :key="`${m.order_index}-${i}`" class="map-order-item">
              <span class="map-order-num">{{ i + 1 }}</span>
              <img v-if="mapInfo(m.map_id)?.thumbnail_url" :src="mapInfo(m.map_id)!.thumbnail_url!" class="map-order-thumb" alt="" />
              <span class="map-order-name">{{ mapInfo(m.map_id)?.name ?? '알 수 없는 맵' }}</span>
              <button v-if="canEditMaps" class="map-order-remove" @click="removeMapAt(i)">×</button>
            </li>
          </ol>

          <div v-if="canEditMaps && mapsDirty" class="maps-save-row">
            <p v-if="mapsError" class="save-error">{{ mapsError }}</p>
            <button class="btn-save" :disabled="savingMaps" @click="handleSaveMaps">
              {{ savingMaps ? '저장 중...' : '맵 구성 저장' }}
            </button>
          </div>
        </section>

        <p v-if="battle.status !== 'RECRUITING' && battle.status !== 'ASSIGNED'" class="state-msg">다음 단계에서 이어서 만듭니다.</p>
      </template>
    </div>

    <!-- ── 맵 선택 오버레이 ───────────────────────────────── -->
    <Teleport to="body">
      <div v-if="showMapPicker" class="overlay-backdrop">
        <div class="picker-panel">
          <div class="picker-header">
            <span class="picker-title">
              맵 추가
              <span class="picker-subtitle">최대 10개, 중복 선택 가능</span>
            </span>
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
              :disabled="battleMaps.length >= 10"
              @click="appendMap(map.id)"
            >
              <img v-if="map.thumbnail_url" :src="map.thumbnail_url" class="picker-map-thumb" alt="" />
              <div class="picker-map-info">
                <span class="picker-name">{{ map.name }}</span>
                <span class="picker-map-meta">{{ map.player_count }}인 · {{ map.tileset }}</span>
              </div>
            </button>
            <div v-if="filteredMaps.length === 0" class="picker-empty">검색 결과 없음</div>
          </div>
          <div class="picker-footer">
            <span class="picker-footer-hint">{{ battleMaps.length }} / 10개 선택됨</span>
            <button class="picker-confirm" @click="showMapPicker = false">닫기</button>
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
import { useAuthStore } from '@/stores/auth'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getMaps, type MapRow } from '@/lib/maps'
import { tierPoint } from '@/lib/constants'
import {
  getTeamBattle, getTeamBattlePlayers, joinTeamBattle, leaveTeamBattle,
  getTeamBattleMaps, setTeamBattleMaps, assignTeams, reassignLeader,
  TEAM_BATTLE_STATUS_LABEL, type TeamBattleRow, type TeamBattlePlayerRow,
} from '@/lib/teamBattles'

const route = useRoute()
const auth = useAuthStore()

const battle = ref<TeamBattleRow | null>(null)
const players = ref<TeamBattlePlayerRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const myPlayer = ref<PlayerRow | null>(null)
const allMaps = ref<MapRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const actionError = ref<string | null>(null)

const races = [
  { value: 'T' as const, label: '테란' },
  { value: 'Z' as const, label: '저그' },
  { value: 'P' as const, label: '프로토스' },
]
const raceLabel = (r: string) => races.find(x => x.value === r)?.label ?? r
const nicknameOf = (userId: number) => allPlayers.value.find(p => p.id === userId)?.nickname ?? `선수 ${userId}`

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

const hostName = computed(() => battle.value ? nicknameOf(battle.value.host_user_id) : '')
const myEntry = computed(() => players.value.find(p => p.user_id === myPlayer.value?.id) ?? null)
const recruitmentClosed = computed(() => !!battle.value && new Date() >= new Date(battle.value.start_at))

async function load() {
  const id = route.params.id as string
  const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
  const [b, p, all, me, maps, tbMaps] = await Promise.all([
    getTeamBattle(id),
    getTeamBattlePlayers(id),
    getPlayers(),
    discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    getMaps(),
    getTeamBattleMaps(id),
  ])
  battle.value = b
  players.value = p
  allPlayers.value = all
  myPlayer.value = me
  allMaps.value = maps
  const nonAce = tbMaps.filter(m => !m.is_ace).map(m => ({ order_index: m.order_index, map_id: m.map_id }))
  battleMaps.value = nonAce
  savedMapIds.value = nonAce.map(m => m.map_id)
}

onMounted(async () => {
  try {
    await load()
  } catch (e: any) {
    loadError.value = e.message ?? '팀배틀 정보를 불러올 수 없습니다.'
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
  if (!battle.value || !myPlayer.value) return
  joining.value = true
  actionError.value = null
  try {
    await joinTeamBattle(battle.value.id, myPlayer.value, selectedRace.value)
    players.value = await getTeamBattlePlayers(battle.value.id)
  } catch (e: any) {
    actionError.value = e.message ?? '참가 처리 중 오류가 발생했습니다.'
  } finally {
    joining.value = false
  }
}

async function handleLeave() {
  if (!battle.value || !myPlayer.value) return
  joining.value = true
  actionError.value = null
  try {
    await leaveTeamBattle(battle.value.id, myPlayer.value.id)
    players.value = await getTeamBattlePlayers(battle.value.id)
  } catch (e: any) {
    actionError.value = e.message ?? '참가 취소 중 오류가 발생했습니다.'
  } finally {
    joining.value = false
  }
}

// myPlayer 로딩 완료 시 종족 선택 기본값을 주종족으로
watch(myPlayer, resetSelectedRace)

// ── 팀 배정 ───────────────────────────────────────────────
const assigning = ref(false)
const assignError = ref<string | null>(null)
const reassigning = ref(false)

const canAssign = computed(() =>
  isHost.value && !!battle.value && (battle.value.status === 'RECRUITING' || battle.value.status === 'ASSIGNED'),
)

function teamPlayers(teamNo: 1 | 2): TeamBattlePlayerRow[] {
  return players.value
    .filter(p => p.team_no === teamNo)
    .sort((a, b) => Number(b.is_leader) - Number(a.is_leader) || tierPoint(b.tier) - tierPoint(a.tier))
}

function teamScore(teamNo: 1 | 2): number {
  return teamPlayers(teamNo).reduce((sum, p) => sum + tierPoint(p.tier), 0)
}

async function handleAssignTeams() {
  if (!battle.value) return
  assigning.value = true
  assignError.value = null
  try {
    await assignTeams(battle.value.id)
    const [b, p] = await Promise.all([getTeamBattle(battle.value.id), getTeamBattlePlayers(battle.value.id)])
    battle.value = b
    players.value = p
  } catch (e: any) {
    assignError.value = e.message ?? '팀 배정 중 오류가 발생했습니다.'
  } finally {
    assigning.value = false
  }
}

async function handleReassignLeader(teamNo: 1 | 2, userId: number) {
  if (!battle.value) return
  reassigning.value = true
  try {
    await reassignLeader(battle.value.id, teamNo, userId)
    players.value = await getTeamBattlePlayers(battle.value.id)
  } catch (e: any) {
    assignError.value = e.message ?? '팀장 재지정 중 오류가 발생했습니다.'
  } finally {
    reassigning.value = false
  }
}

// ── 맵 선택 ───────────────────────────────────────────────
const battleMaps = ref<{ order_index: number; map_id: string }[]>([])
const savedMapIds = ref<string[]>([])
const showMapPicker = ref(false)
const mapSearch = ref('')
const savingMaps = ref(false)
const mapsError = ref<string | null>(null)

const isHost = computed(() => !!myPlayer.value && !!battle.value && myPlayer.value.id === battle.value.host_user_id)
const canEditMaps = computed(() =>
  isHost.value && !!battle.value && (battle.value.status === 'RECRUITING' || battle.value.status === 'ASSIGNED'),
)
const mapsDirty = computed(() =>
  JSON.stringify(battleMaps.value.map(m => m.map_id)) !== JSON.stringify(savedMapIds.value),
)

function mapInfo(mapId: string): MapRow | undefined {
  return allMaps.value.find(m => m.id === mapId)
}

const filteredMaps = computed(() => {
  const q = mapSearch.value.trim().toLowerCase()
  if (!q) return allMaps.value
  return allMaps.value.filter(m => m.name.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q)))
})

function openMapPicker() {
  mapSearch.value = ''
  mapsError.value = null
  showMapPicker.value = true
}

function appendMap(mapId: string) {
  if (battleMaps.value.length >= 10) return
  battleMaps.value.push({ order_index: battleMaps.value.length, map_id: mapId })
}

function removeMapAt(index: number) {
  battleMaps.value.splice(index, 1)
  battleMaps.value = battleMaps.value.map((m, i) => ({ ...m, order_index: i }))
}

async function handleSaveMaps() {
  if (!battle.value) return
  savingMaps.value = true
  mapsError.value = null
  try {
    const mapIds = battleMaps.value.map(m => m.map_id)
    await setTeamBattleMaps(battle.value.id, mapIds)
    savedMapIds.value = mapIds
  } catch (e: any) {
    mapsError.value = e.message ?? '맵 저장 중 오류가 발생했습니다.'
  } finally {
    savingMaps.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TeamBattleDetailView.scss';
</style>
