<template>
  <div class="team-names-page">
    <AppHeader />

    <div class="team-names-content">
      <button class="btn-back" @click="$router.push({ name: 'leagues' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        리그 목록
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <div class="page-title-row">
          <h1 class="page-title page-title--sm">팀명 지정</h1>
          <span class="page-subtitle">{{ league?.name }}</span>
        </div>

        <div class="team-list">
          <div v-for="row in rows" :key="row.captainId" class="team-row">
            <div class="team-captain-info">
              <span class="team-label">Team</span>
              <span class="captain-chip" :class="`tier--${row.tier.toLowerCase()}`">{{ row.nickname }}</span>
            </div>
            <input
              v-model="row.teamName"
              class="team-name-input"
              type="text"
              maxlength="30"
              placeholder="팀명 입력"
            />
          </div>
        </div>

        <div class="page-footer">
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <button class="btn-save" :disabled="saving" @click="handleSave">
            {{ saving ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getLeague, setTeamNamesCompleted, type LeagueRow } from '@/lib/leagues'
import { getCaptains } from '@/lib/leagueDetail'
import { getPlayers, type PlayerRow } from '@/lib/players'
import { getTeamNames, saveTeamNames } from '@/lib/teamNames'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

const loading = ref(true)
const pageError = ref<string | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

const league = ref<LeagueRow | null>(null)

interface TeamRow {
  captainId: number
  nickname: string
  tier: string
  race: string
  teamName: string
}

const rows = ref<TeamRow[]>([])

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
    ]))
    league.value = leagueData

    const playerMap = new Map<number, PlayerRow>(players.map(p => [p.id, p]))
    const nameMap = new Map<number, string>(teamNames.map(t => [t.captain_player_id, t.team_name]))

    rows.value = captains.map(c => {
      const p = playerMap.get(c.player_id)
      return {
        captainId: c.player_id,
        nickname: p?.nickname ?? `선수 ${c.player_id}`,
        tier: p?.tier ?? '',
        race: p?.race ?? '',
        teamName: nameMap.get(c.player_id) ?? '',
      }
    })
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

async function handleSave() {
  if (rows.value.some(r => !r.teamName.trim())) {
    saveError.value = '모든 팀명을 입력해주세요.'
    return
  }
  saving.value = true
  saveError.value = null
  try {
    await Promise.all([
      saveTeamNames(leagueId, rows.value.map(r => ({
        captain_player_id: r.captainId,
        team_name: r.teamName.trim(),
      }))),
      setTeamNamesCompleted(leagueId),
    ])
    router.push({ name: 'leagues' })
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TeamNamesView.scss';
</style>
