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

        <!-- 참가자 목록 -->
        <section class="players-section">
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

        <p v-if="battle.status !== 'RECRUITING'" class="state-msg">다음 단계에서 이어서 만듭니다.</p>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import {
  getTeamBattle, getTeamBattlePlayers, joinTeamBattle, leaveTeamBattle,
  TEAM_BATTLE_STATUS_LABEL, type TeamBattleRow, type TeamBattlePlayerRow,
} from '@/lib/teamBattles'

const route = useRoute()
const auth = useAuthStore()

const battle = ref<TeamBattleRow | null>(null)
const players = ref<TeamBattlePlayerRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const myPlayer = ref<PlayerRow | null>(null)
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
  const [b, p, all, me] = await Promise.all([
    getTeamBattle(id),
    getTeamBattlePlayers(id),
    getPlayers(),
    discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
  ])
  battle.value = b
  players.value = p
  allPlayers.value = all
  myPlayer.value = me
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
</script>

<style lang="scss" scoped>
@use './TeamBattleDetailView.scss';
</style>
