<template>
  <div class="rankings-tab">
    <!-- 승부예측 포인트는 리그마다 따로라 랭킹도 리그별로 본다 -->
    <div v-if="leagues.length" class="rank-toolbar">
      <select v-model="leagueId" class="league-select" :disabled="loading" @change="load">
        <option v-for="l in leagues" :key="l.id" :value="l.id">{{ l.name }}</option>
      </select>
      <span class="rank-hint">리그 포인트 잔액 순 · 출석 보상 포함</span>
    </div>

    <div v-if="loading" class="state-msg">불러오는 중...</div>
    <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
    <div v-else-if="!rankings.length" class="state-msg">이 리그의 예측 기록이 없습니다.</div>

    <div v-else class="table-scroll">
      <table class="rank-table">
        <thead>
          <tr>
            <th class="col-rank">#</th>
            <th class="col-user">사용자</th>
            <th class="col-points">포인트</th>
            <th class="col-correct">맞힘</th>
            <th class="col-acc">정확도</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in rankings"
            :key="r.user_id"
            :class="{ 'rank-row--me': r.user_id === myUserId }"
          >
            <td class="col-rank">
              <span class="rank-num" :class="rankClass(i)">{{ i + 1 }}</span>
            </td>
            <td class="col-user">
              <span class="rank-nick">{{ r.nickname }}</span>
              <RaceBadge :race="r.race" size="sm" />
              <TierBadge :tier="r.tier" size="sm" />
            </td>
            <td class="col-points">{{ r.points.toLocaleString() }}</td>
            <td class="col-correct">{{ r.correct_count }} / {{ r.resolved_count }}</td>
            <td class="col-acc">
              <div class="acc-bar">
                <div class="acc-bar-fill" :style="{ width: r.accuracy + '%' }" />
              </div>
              <span class="acc-val">{{ r.accuracy.toFixed(1) }}%</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getRankings, getPredictionLeagues, type RankingRow, type PredictionLeague } from '@/lib/predictions'
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId } from '@/lib/players'
import RaceBadge from '@/components/RaceBadge.vue'
import TierBadge from '@/components/TierBadge.vue'

const auth = useAuthStore()
const rankings = ref<RankingRow[]>([])
const leagues = ref<PredictionLeague[]>([])
const leagueId = ref<string | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
const myUserId = ref<number | null>(null)

function rankClass(i: number) {
  if (i === 0) return 'rank-num--1'
  if (i === 1) return 'rank-num--2'
  if (i === 2) return 'rank-num--3'
  return ''
}

async function load() {
  if (!leagueId.value) { rankings.value = []; loading.value = false; return }
  loading.value = true
  loadError.value = null
  try {
    rankings.value = await getRankings(leagueId.value)
  } catch (e: any) {
    loadError.value = e.message ?? '랭킹을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    if (discordId) {
      const me = await getPlayerByDiscordId(discordId)
      if (me) myUserId.value = me.id
    }
    const res = await getPredictionLeagues()
    leagues.value = res.leagues
    leagueId.value = res.defaultId
  } catch (e: any) {
    loadError.value = e.message ?? '랭킹을 불러올 수 없습니다.'
  }
  await load()
})
</script>

<style lang="scss" scoped>
@use './RankingsTab.scss';
</style>
