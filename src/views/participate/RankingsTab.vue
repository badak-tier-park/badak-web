<template>
  <div class="rankings-tab">
    <div v-if="loading" class="state-msg">불러오는 중...</div>
    <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
    <div v-else-if="!rankings.length" class="state-msg">아직 예측 기록이 없습니다.</div>

    <table v-else class="rank-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th class="col-user">사용자</th>
          <th class="col-points">점수</th>
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
            <span class="rank-race" :class="`race--${r.race.toLowerCase()}`">{{ r.race }}</span>
            <span class="rank-nick">{{ r.nickname }}</span>
            <span class="rank-tier" :class="`tier-badge--${r.tier.toLowerCase()}`">{{ r.tier }}</span>
          </td>
          <td class="col-points">{{ r.total_points }}</td>
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
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getRankings, type RankingRow } from '@/lib/predictions'
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId } from '@/lib/players'

const auth = useAuthStore()
const rankings = ref<RankingRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myUserId = ref<number | null>(null)

function rankClass(i: number) {
  if (i === 0) return 'rank-num--1'
  if (i === 1) return 'rank-num--2'
  if (i === 2) return 'rank-num--3'
  return ''
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    if (discordId) {
      const me = await getPlayerByDiscordId(discordId)
      if (me) myUserId.value = me.id
    }
    rankings.value = await getRankings()
  } catch (e: any) {
    loadError.value = e.message ?? '랭킹을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './RankingsTab.scss';
</style>
