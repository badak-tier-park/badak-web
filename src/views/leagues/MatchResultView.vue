<template>
  <div class="match-result-page">
    <AppHeader />

    <div class="match-result-content">
      <button class="btn-back" @click="$router.push({ name: 'league-schedule', params: { id: leagueId } })">
        <AppIcon name="chevron-left" :size="13" />
        경기 관리
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <div class="page-title-row">
          <h1 class="page-title page-title--sm">경기 결과 입력</h1>
          <span class="page-subtitle">{{ league?.name }}</span>
        </div>

        <div v-if="!schedules.length" class="state-msg">
          등록된 경기가 없습니다. 먼저 경기를 등록해주세요.
        </div>

        <div v-else class="result-list">
          <div v-for="round in rounds" :key="round" class="round-group">
            <div class="round-header">
              <span class="round-label">{{ round }}라운드</span>
            </div>

            <div class="match-list">
              <div
                v-for="match in matchesByRound(round)"
                :key="match.id"
                class="match-card"
                :class="{ 'match-card--done': match.winner_captain_id != null }"
              >
                <div class="match-date" v-if="match.match_date">
                  {{ match.match_date.replaceAll('-', '/') }}
                </div>
                <div class="match-date match-date--empty" v-else>날짜 미정</div>

                <div class="match-teams">
                  <button
                    class="team-btn"
                    :class="{
                      'team-btn--winner': match.winner_captain_id === match.team_a_captain_id,
                      'team-btn--loser': match.winner_captain_id != null && match.winner_captain_id !== match.team_a_captain_id,
                    }"
                    @click="setWinner(match, match.team_a_captain_id)"
                  >
                    <span class="team-chip" :class="`tier--${teamMap.get(match.team_a_captain_id)?.tier.toLowerCase()}`">
                      {{ teamName(match.team_a_captain_id) }}
                    </span>
                    <span v-if="match.winner_captain_id === match.team_a_captain_id" class="win-badge">WIN</span>
                  </button>

                  <span class="match-vs">VS</span>

                  <button
                    class="team-btn"
                    :class="{
                      'team-btn--winner': match.winner_captain_id === match.team_b_captain_id,
                      'team-btn--loser': match.winner_captain_id != null && match.winner_captain_id !== match.team_b_captain_id,
                    }"
                    @click="setWinner(match, match.team_b_captain_id)"
                  >
                    <span class="team-chip" :class="`tier--${teamMap.get(match.team_b_captain_id)?.tier.toLowerCase()}`">
                      {{ teamName(match.team_b_captain_id) }}
                    </span>
                    <span v-if="match.winner_captain_id === match.team_b_captain_id" class="win-badge">WIN</span>
                  </button>
                </div>

                <button
                  v-if="match.winner_captain_id != null"
                  class="btn-reset"
                  @click="setWinner(match, null)"
                  title="결과 초기화"
                >
                  <AppIcon name="close" :size="10" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="result-summary" v-if="schedules.length">
          <span class="summary-done">{{ doneCount }}경기 완료</span>
          <span class="summary-sep">/</span>
          <span class="summary-total">{{ schedules.length }}경기</span>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import { getLeague, type LeagueRow } from '@/lib/leagues'
import { getCaptains } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import { getSchedules, updateMatchWinner, type ScheduleRow } from '@/lib/schedules'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const leagueId = route.params.id as string

const loading = ref(true)
const pageError = ref<string | null>(null)
const league = ref<LeagueRow | null>(null)
const schedules = ref<ScheduleRow[]>([])

interface TeamInfo { captainId: number; nickname: string; teamName: string; tier: string }
const teamMap = ref(new Map<number, TeamInfo>())

const rounds = computed(() => [...new Set(schedules.value.map(s => s.round))].sort((a, b) => a - b))
function matchesByRound(round: number) { return schedules.value.filter(s => s.round === round) }
function teamName(captainId: number) {
  const t = teamMap.value.get(captainId)
  return t?.teamName || t?.nickname || `선수 ${captainId}`
}
const doneCount = computed(() => schedules.value.filter(s => s.winner_captain_id != null).length)

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames, sched] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
      getSchedules(leagueId),
    ]))
    league.value = leagueData
    schedules.value = sched

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))

    const map = new Map<number, TeamInfo>()
    captains.forEach(c => {
      const p = playerMap.get(c.player_id)
      map.set(c.player_id, {
        captainId: c.player_id,
        nickname: p?.nickname ?? `선수 ${c.player_id}`,
        teamName: nameMap.get(c.player_id) ?? '',
        tier: p?.tier ?? '',
      })
    })
    teamMap.value = map
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

async function setWinner(match: ScheduleRow, captainId: number | null) {
  // 같은 값이면 토글 (취소)
  const next = match.winner_captain_id === captainId ? null : captainId
  try {
    await updateMatchWinner(match.id, next)
    match.winner_captain_id = next
  } catch (e: any) {
    console.error(e)
  }
}
</script>

<style lang="scss" scoped>
@use './MatchResultView.scss';
</style>
