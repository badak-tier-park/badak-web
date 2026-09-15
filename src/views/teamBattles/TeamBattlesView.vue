<template>
  <div class="team-battles-page">
    <AppHeader />

    <div class="team-battles-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">팀배틀</h1>
        <button class="btn-create" @click="openCreate">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          팀배틀 만들기
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="battles.length === 0" class="state-msg">아직 만들어진 팀배틀이 없습니다.</div>

      <div v-else class="battle-list">
        <div v-for="b in sortedBattles" :key="b.id" class="battle-card">
          <div class="battle-card-row">
            <RouterLink
              :to="{ name: 'team-battle-detail', params: { id: b.id } }"
              class="battle-card-main"
            >
              <div class="battle-card-header">
                <span class="battle-status" :class="`status--${b.status.toLowerCase()}`">
                  {{ TEAM_BATTLE_STATUS_LABEL[b.status] }}
                </span>
              </div>
              <p class="battle-name">{{ b.name }}</p>
              <p class="battle-sub">참가 {{ b.player_count }}명 · 주최 {{ nicknameOf(b.host_user_id) }}</p>
            </RouterLink>

            <button
              type="button"
              class="battle-expand-btn"
              :class="{ 'battle-expand-btn--open': expandedId === b.id }"
              :aria-label="expandedId === b.id ? '접기' : '펼치기'"
              @click="toggleExpand(b.id)"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 5l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>

          <div v-if="expandedId === b.id" class="battle-expand-panel">
            <p v-if="summaryLoading" class="state-msg">불러오는 중...</p>
            <p v-else-if="summaryError" class="state-msg state-msg--error">{{ summaryError }}</p>

            <!-- 경기가 있으면 결과 요약 -->
            <template v-else-if="summaryMatches.length > 0">
              <div class="result-score-row">
                <span class="result-team-name">{{ captainLabel(1) }}</span>
                <span class="result-score">{{ teamWins(1) }} : {{ teamWins(2) }}</span>
                <span class="result-team-name">{{ captainLabel(2) }}</span>
              </div>
              <p v-if="b.winner_team" class="result-winner">
                {{ captainLabel(b.winner_team) }} 우승
              </p>

              <div class="result-match-list">
                <div v-for="m in summaryMatches" :key="m.order_index" class="result-match-row">
                  <span class="result-match-no">{{ m.is_ace ? '에결' : `${m.order_index + 1}경기` }}</span>
                  <span class="result-match-map">{{ mapNameOf(m.map_id) }}</span>
                  <span class="result-match-side" :class="{ 'result-match-side--win': m.winner_team === 1 }">
                    {{ nicknameOf(m.team1_user_id) }}
                  </span>
                  <span class="result-match-vs">vs</span>
                  <span class="result-match-side" :class="{ 'result-match-side--win': m.winner_team === 2 }">
                    {{ nicknameOf(m.team2_user_id) }}
                  </span>
                </div>
              </div>
            </template>

            <!-- 아직 경기 전이면 참가자 목록 -->
            <template v-else-if="summaryPlayers.length > 0">
              <p class="result-label">참가자 {{ summaryPlayers.length }}명</p>
              <div class="result-player-chips">
                <span v-for="p in summaryPlayers" :key="p.user_id" class="result-player-chip">
                  <span class="tier-badge" :class="`tier-badge--${$tierClass(p.tier)}`">{{ p.tier }}</span>
                  {{ nicknameOf(p.user_id) }}
                </span>
              </div>
            </template>

            <p v-else class="state-msg">아직 참가자가 없습니다.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 생성 모달 -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop">
        <div class="modal edit-modal">
          <div class="modal-header">
            <span class="modal-title">팀배틀 만들기</span>
            <button class="modal-close" @click="closeCreate">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label">팀배틀 이름</label>
              <input
                v-model="form.name"
                class="field-input"
                type="text"
                maxlength="50"
                placeholder="이름 입력"
              />
            </div>


            <div class="field">
              <label class="field-label">참여 가능 티어</label>
              <div class="tier-select-grid">
                <button
                  v-for="t in TIER_ORDER"
                  :key="t"
                  type="button"
                  class="tier-toggle-btn"
                  :class="[`tier-badge--${$tierClass(t)}`, { 'tier-toggle-btn--off': !selectedTiers.has(t) }]"
                  @click="toggleTier(t)"
                >{{ t }}</button>
              </div>
              <p class="field-hint">기본은 전체 참여 가능. 특정 티어 위주로 진행하려면 해제하세요.</p>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeCreate" :disabled="saving">취소</button>
              <button class="btn-save" :disabled="saving" @click="handleCreate">
                {{ saving ? '생성 중...' : '생성' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getMaps, type MapRow } from '@/lib/maps'
import {
  getTeamBattles, createTeamBattle, getTeamBattleSummary, TEAM_BATTLE_STATUS_LABEL,
  type TeamBattleListRow, type TeamBattlePlayerRow, type TeamBattleMatchRow, type AceMode,
} from '@/lib/teamBattles'
import { TIER_ORDER } from '@/lib/constants'

const router = useRouter()
const auth = useAuthStore()

const battles = ref<TeamBattleListRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myPlayer = ref<PlayerRow | null>(null)

const nicknameOf = (userId: number | null) =>
  userId === null ? '-' : (allPlayers.value.find(p => p.id === userId)?.nickname ?? `선수 ${userId}`)

/** 종료/취소된 배틀은 아래로, 그 안에서는 최신순 */
const sortedBattles = computed(() => {
  const isDone = (s: string) => s === 'FINISHED' || s === 'CANCELLED'
  return [...battles.value].sort((a, b) => {
    const da = isDone(a.status) ? 1 : 0
    const db = isDone(b.status) ? 1 : 0
    if (da !== db) return da - db
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
})

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    const [battlesData, players, me] = await Promise.all([
      getTeamBattles(),
      getPlayers(),
      discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    ])
    battles.value = battlesData
    allPlayers.value = players
    myPlayer.value = me
  } catch (e: any) {
    loadError.value = e.message ?? '팀배틀 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 카드 펼치기 (펼칠 때만 해당 배틀 상세를 조회) ──────────────
const expandedId = ref<string | null>(null)
const summaryLoading = ref(false)
const summaryError = ref<string | null>(null)
const summaryPlayers = ref<TeamBattlePlayerRow[]>([])
const summaryMatches = ref<TeamBattleMatchRow[]>([])
const allMaps = ref<MapRow[] | null>(null)

const mapNameOf = (mapId: string) =>
  allMaps.value?.find(m => m.id === mapId)?.name ?? '알 수 없는 맵'

const teamWins = (teamNo: 1 | 2) => summaryMatches.value.filter(m => m.winner_team === teamNo).length

/** 팀배틀엔 팀 이름이 없어서 팀장 닉네임으로 팀을 식별한다 */
function captainLabel(teamNo: 1 | 2): string {
  const captain = summaryPlayers.value.find(p => p.team_no === teamNo && p.is_leader)
  return captain ? `${nicknameOf(captain.user_id)} 팀` : `TEAM ${teamNo}`
}

async function toggleExpand(battleId: string) {
  if (expandedId.value === battleId) {
    expandedId.value = null
    return
  }
  expandedId.value = battleId
  summaryLoading.value = true
  summaryError.value = null
  summaryPlayers.value = []
  summaryMatches.value = []
  try {
    const [summary] = await Promise.all([
      getTeamBattleSummary(battleId),
      allMaps.value ? Promise.resolve(null) : getMaps().then(m => (allMaps.value = m)),
    ])
    summaryPlayers.value = summary.players
    summaryMatches.value = summary.matches
  } catch (e: any) {
    summaryError.value = e.message ?? '내용을 불러올 수 없습니다.'
  } finally {
    summaryLoading.value = false
  }
}

// ── 생성 모달 ─────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({
  name: '',
  aceMode: 'RANDOM' as AceMode,
})

// ── 참여 가능 티어 (디폴트 전체 선택) ─────────────────────
const selectedTiers = ref<Set<string>>(new Set(TIER_ORDER))

function toggleTier(tier: string) {
  const next = new Set(selectedTiers.value)
  if (next.has(tier)) next.delete(tier)
  else next.add(tier)
  selectedTiers.value = next
}

function openCreate() {
  form.name = ''
  form.aceMode = 'RANDOM'
  selectedTiers.value = new Set(TIER_ORDER)
  saveError.value = null
  showForm.value = true
}

function closeCreate() {
  if (saving.value) return
  showForm.value = false
}

async function handleCreate() {
  if (!myPlayer.value) { saveError.value = '선수 정보를 불러오지 못했습니다.'; return }
  if (!form.name.trim()) { saveError.value = '이름을 입력해주세요.'; return }
  if (selectedTiers.value.size === 0) { saveError.value = '참여 가능 티어를 최소 1개는 선택해주세요.'; return }

  // 전체가 선택된 상태면 "제한 없음"을 뜻하는 null로 저장 (굳이 전체 배열을 저장할 필요 없음)
  const allowedTiers = selectedTiers.value.size === TIER_ORDER.length ? null : [...selectedTiers.value]

  saving.value = true
  saveError.value = null
  try {
    const created = await createTeamBattle(
      { name: form.name.trim(), ace_mode: form.aceMode, allowed_tiers: allowedTiers },
      myPlayer.value,
    )
    showForm.value = false
    router.push({ name: 'team-battle-detail', params: { id: created.id } })
  } catch (e: any) {
    saveError.value = e.message ?? '생성 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './TeamBattlesView.scss';
</style>
