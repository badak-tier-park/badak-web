<template>
  <div class="games-page">
    <AppHeader />

    <div class="games-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">경기 관리</h1>
        <span class="game-count" v-if="!loading">{{ games.length }}경기</span>
      </div>

      <!-- ── 미등록 닉네임 패널 ──────────────────────────── -->
      <div v-if="!loading && unmatchedNames.length" class="unmatched-panel">
        <div class="unmatched-header">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="#f59e0b" stroke-width="1.4"/>
            <path d="M7 4v3.5M7 9.5v.5" stroke="#f59e0b" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>미등록 닉네임</span>
          <span class="unmatched-count">{{ unmatchedNames.length }}건</span>
        </div>
        <div class="unmatched-list">
          <div v-for="[name, count] in unmatchedNames" :key="name" class="unmatched-row">
            <span class="unmatched-name">{{ name }}</span>
            <span class="unmatched-games">{{ count }}경기</span>
            <button class="btn-link" @click="openLink(name)">선수 연동</button>
          </div>
        </div>
      </div>

      <div class="search-bar">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
          <path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
        </svg>
        <input
          v-model="searchQuery"
          class="search-input"
          type="text"
          placeholder="선수명 또는 맵 검색"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

      <template v-else>
        <div class="result-count">{{ filteredGames.length }}건</div>
        <table class="game-table">
          <thead>
            <tr>
              <th class="th-center">날짜</th>
              <th class="th-center">맵</th>
              <th class="th-center">승자</th>
              <th class="th-center">패자</th>
              <th>시간</th>
              <th>시즌</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="game in filteredGames" :key="game.id">
              <td class="td-date">{{ formatDate(game.played_at) }}</td>

              <td class="td-map">
                <div class="map-cell">
                  <img v-if="game.map_thumbnail_url" :src="game.map_thumbnail_url" class="map-thumb" />
                  <div v-else class="map-thumb-empty" />
                  <span class="map-name">{{ game.map_name ?? '-' }}</span>
                </div>
              </td>

              <td>
                <div class="player-cell">
                  <div class="player-cell-name">
                    <span class="race-badge" :class="raceBadgeClass(game.winner_race)">{{ raceLabel(game.winner_race) }}</span>
                    <span v-if="game.winner_tier" class="tier-badge" :class="`tier-badge--${game.winner_tier.toLowerCase()}`">{{ game.winner_tier }}</span>
                    <span class="player-name" :class="{ 'player-name--unmatched': !game.winner_tier }">{{ game.winner_name ?? '-' }}</span>
                  </div>
                  <div v-if="game.winner_apm != null" class="player-cell-apm">APM {{ game.winner_apm }}</div>
                </div>
              </td>

              <td>
                <div class="player-cell">
                  <div class="player-cell-name">
                    <span class="race-badge" :class="raceBadgeClass(game.loser_race)">{{ raceLabel(game.loser_race) }}</span>
                    <span v-if="game.loser_tier" class="tier-badge" :class="`tier-badge--${game.loser_tier.toLowerCase()}`">{{ game.loser_tier }}</span>
                    <span class="player-name" :class="{ 'player-name--unmatched': !game.loser_tier }">{{ game.loser_name ?? '-' }}</span>
                  </div>
                  <div v-if="game.loser_apm != null" class="player-cell-apm">APM {{ game.loser_apm }}</div>
                </div>
              </td>

              <td class="td-duration">{{ formatDuration(game.game_duration_seconds) }}</td>
              <td class="td-season">{{ game.season_id != null ? `S${game.season_id}` : '-' }}</td>

              <td class="td-action">
                <div class="action-wrap">
                  <template v-if="deleteConfirmId === game.id">
                    <button class="btn-confirm-delete" @click="confirmDelete(game.id)" :disabled="deleting">확인</button>
                    <button class="btn-cancel-delete" @click="deleteConfirmId = null" :disabled="deleting">취소</button>
                  </template>
                  <button v-else class="btn-delete" @click="deleteConfirmId = game.id">삭제</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </template>
    </div>

    <!-- ── 연동 모달 ───────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="linkTarget" class="modal-backdrop" @click.self="linkTarget = null">
        <div class="modal link-modal">
          <div class="modal-header">
            <span class="modal-title">
              <span class="link-target-name">{{ linkTarget }}</span>
              &nbsp;연동할 선수 선택
            </span>
            <button class="modal-close" @click="linkTarget = null">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="link-search-wrap">
              <input
                v-model="playerSearch"
                class="field-input"
                type="text"
                placeholder="닉네임 검색"
                autofocus
              />
            </div>
            <div class="player-option-list">
              <button
                v-for="p in filteredPlayerOptions"
                :key="p.id"
                class="player-option"
                @click="handleLink(p)"
                :disabled="linking"
              >
                <span class="race-badge" :class="raceBadgeClass(p.race)">{{ raceLabel(p.race) }}</span>
                <span class="tier-badge" :class="`tier-badge--${p.tier.toLowerCase()}`">{{ p.tier }}</span>
                <span class="player-option-name">{{ p.nickname }}</span>
                <span v-if="p.star_nicknames.length" class="player-option-sn">
                  {{ p.star_nicknames.slice(0, 2).join(', ') }}{{ p.star_nicknames.length > 2 ? ' ...' : '' }}
                </span>
              </button>
              <div v-if="!filteredPlayerOptions.length" class="player-option-empty">검색 결과 없음</div>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="linkError" class="save-error">{{ linkError }}</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click="linkTarget = null" :disabled="linking">취소</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { getEnrichedGames, deleteGame, type EnrichedGameRow } from '@/lib/games'
import { getPlayers, updatePlayer, type PlayerRow } from '@/lib/players'

const games = ref<EnrichedGameRow[]>([])
const players = ref<PlayerRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const searchQuery = ref('')
const deleteConfirmId = ref<number | null>(null)
const deleting = ref(false)

// ── 미등록 닉네임 ────────────────────────────────────────
const allValidNames = computed(() => {
  const set = new Set<string>()
  for (const p of players.value) {
    set.add(p.nickname.toLowerCase())
    for (const sn of p.star_nicknames) set.add(sn.toLowerCase())
  }
  return set
})

const unmatchedNames = computed((): [string, number][] => {
  const map = new Map<string, number>()
  for (const g of games.value) {
    if (g.winner_name && !allValidNames.value.has(g.winner_name.toLowerCase()))
      map.set(g.winner_name, (map.get(g.winner_name) ?? 0) + 1)
    if (g.loser_name && !allValidNames.value.has(g.loser_name.toLowerCase()))
      map.set(g.loser_name, (map.get(g.loser_name) ?? 0) + 1)
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1])
})

// ── 연동 모달 ────────────────────────────────────────────
const linkTarget = ref<string | null>(null)
const playerSearch = ref('')
const linking = ref(false)
const linkError = ref<string | null>(null)

const filteredPlayerOptions = computed(() => {
  const q = playerSearch.value.toLowerCase()
  if (!q) return players.value
  return players.value.filter(p =>
    p.nickname.toLowerCase().includes(q) ||
    p.aliases.some(a => a.toLowerCase().includes(q))
  )
})

function openLink(name: string) {
  linkTarget.value = name
  playerSearch.value = ''
  linkError.value = null
}

async function handleLink(player: PlayerRow) {
  if (!linkTarget.value || linking.value) return
  linking.value = true
  linkError.value = null
  try {
    const newStarNicknames = [...player.star_nicknames, linkTarget.value]
    await updatePlayer(player.id, {
      nickname: player.nickname,
      aliases: player.aliases,
      star_nicknames: newStarNicknames,
      race: player.race,
      tier: player.tier,
    })
    // 로컬 players 업데이트
    const idx = players.value.findIndex(p => p.id === player.id)
    if (idx !== -1) players.value[idx] = { ...players.value[idx], star_nicknames: newStarNicknames }
    // 경기 목록 재조회 (티어 정보 갱신)
    games.value = await getEnrichedGames()
    linkTarget.value = null
  } catch (e: any) {
    linkError.value = e.message ?? '연동 중 오류가 발생했습니다.'
  } finally {
    linking.value = false
  }
}

// ── 경기 목록 ────────────────────────────────────────────
const filteredGames = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return games.value
  return games.value.filter(g =>
    g.winner_name?.toLowerCase().includes(q) ||
    g.loser_name?.toLowerCase().includes(q) ||
    g.map_name?.toLowerCase().includes(q)
  )
})

onMounted(async () => {
  try {
    ;[games.value, players.value] = await Promise.all([getEnrichedGames(), getPlayers()])
  } catch (e: any) {
    loadError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

async function confirmDelete(id: number) {
  deleting.value = true
  try {
    await deleteGame(id)
    games.value = games.value.filter(g => g.id !== id)
    deleteConfirmId.value = null
  } catch (e: any) {
    loadError.value = e.message ?? '삭제 중 오류가 발생했습니다.'
  } finally {
    deleting.value = false
  }
}

function formatDate(val: string | null): string {
  if (!val) return '-'
  const d = new Date(val)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '-'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function raceLabel(race: string | null): string {
  if (race === 'T' || race === 'Terran') return 'T'
  if (race === 'Z' || race === 'Zerg') return 'Z'
  if (race === 'P' || race === 'Protoss') return 'P'
  return race?.[0]?.toUpperCase() ?? '?'
}

function raceBadgeClass(race: string | null): string {
  const r = raceLabel(race)
  if (r === 'T') return 'race-badge--t'
  if (r === 'Z') return 'race-badge--z'
  if (r === 'P') return 'race-badge--p'
  return ''
}
</script>

<style lang="scss" scoped>
@use './GamesView.scss';
</style>
