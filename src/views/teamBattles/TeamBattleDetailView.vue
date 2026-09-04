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
            {{ TEAM_BATTLE_STATUS_LABEL[battle.status] }}
          </span>
          <h1 class="battle-title">{{ battle.name }}</h1>
        </div>

        <p class="state-msg">다음 단계에서 이어서 만듭니다.</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getTeamBattle, TEAM_BATTLE_STATUS_LABEL, type TeamBattleRow } from '@/lib/teamBattles'

const route = useRoute()
const battle = ref<TeamBattleRow | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)

onMounted(async () => {
  try {
    battle.value = await getTeamBattle(route.params.id as string)
  } catch (e: any) {
    loadError.value = e.message ?? '팀배틀 정보를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './TeamBattleDetailView.scss';
</style>
