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

        <p class="state-msg">다음 단계에서 이어서 만듭니다. (참가/맵/대진 생성 등)</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getPlayers, type PlayerRow } from '@/lib/players'
import {
  getTournament, getTournamentPlayers, TOURNAMENT_STATUS_LABEL,
  type TournamentRow, type TournamentPlayerRow,
} from '@/lib/tournaments'

const route = useRoute()

const tournament = ref<TournamentRow | null>(null)
const players = ref<TournamentPlayerRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const nicknameOf = (userId: number) => allPlayers.value.find(p => p.id === userId)?.nickname ?? `선수 ${userId}`
const hostName = computed(() => tournament.value ? nicknameOf(tournament.value.host_user_id) : '')

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

onMounted(async () => {
  try {
    const id = route.params.id as string
    const [t, p, all] = await Promise.all([
      getTournament(id),
      getTournamentPlayers(id),
      getPlayers(),
    ])
    tournament.value = t
    players.value = p
    allPlayers.value = all
  } catch (e: any) {
    loadError.value = e.message ?? '토너먼트 정보를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './TournamentDetailView.scss';
</style>
