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
                    <span class="player-name">{{ game.winner_name ?? '-' }}</span>
                  </div>
                  <div v-if="game.winner_apm != null" class="player-cell-apm">APM {{ game.winner_apm }}</div>
                </div>
              </td>

              <td>
                <div class="player-cell">
                  <div class="player-cell-name">
                    <span class="race-badge" :class="raceBadgeClass(game.loser_race)">{{ raceLabel(game.loser_race) }}</span>
                    <span v-if="game.loser_tier" class="tier-badge" :class="`tier-badge--${game.loser_tier.toLowerCase()}`">{{ game.loser_tier }}</span>
                    <span class="player-name">{{ game.loser_name ?? '-' }}</span>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { getEnrichedGames, deleteGame, type EnrichedGameRow } from '@/lib/games'

const games = ref<EnrichedGameRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const searchQuery = ref('')
const deleteConfirmId = ref<number | null>(null)
const deleting = ref(false)

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
    games.value = await getEnrichedGames()
  } catch (e: any) {
    loadError.value = e.message ?? '경기 목록을 불러올 수 없습니다.'
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
