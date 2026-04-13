<template>
  <div class="players-page">
    <AppHeader />

    <div class="players-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">선수 관리</h1>
        <span class="player-count" v-if="!loading">{{ players.length }}명</span>
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
          placeholder="닉네임 검색"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

      <table v-else class="player-table">
        <thead>
          <tr>
            <th>닉네임</th>
            <th>종족</th>
            <th>티어</th>
            <th>관리자</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="player in filteredPlayers" :key="player.id">
            <td class="td-nickname">{{ player.nickname }}</td>
            <td>
              <span class="race-badge" :class="`race-badge--${player.race.toLowerCase()}`">
                {{ raceLabel(player.race) }}
              </span>
            </td>
            <td>
              <span class="tier-badge" :class="`tier-badge--${player.tier.toLowerCase()}`">{{ player.tier }}</span>
            </td>
            <td>
              <span v-if="player.is_admin" class="admin-badge">관리자</span>
              <span v-else class="admin-badge admin-badge--no">-</span>
            </td>
            <td class="td-action">
              <button class="edit-btn" @click="openEdit(player)">수정</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 수정 모달 -->
    <Teleport to="body">
      <div v-if="editTarget" class="modal-backdrop" @click.self="closeEdit">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">선수 정보 수정</span>
            <button class="modal-close" @click="closeEdit">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <!-- 닉네임 -->
            <div class="field">
              <label class="field-label">닉네임</label>
              <input
                v-model="form.nickname"
                class="field-input"
                type="text"
                maxlength="50"
                placeholder="닉네임 입력"
              />
            </div>

            <!-- 종족 -->
            <div class="field">
              <label class="field-label">종족</label>
              <div class="race-group">
                <button
                  v-for="r in races"
                  :key="r.value"
                  class="race-btn"
                  :class="[`race-btn--${r.value.toLowerCase()}`, { active: form.race === r.value }]"
                  @click="form.race = r.value"
                  type="button"
                >
                  {{ r.label }}
                </button>
              </div>
            </div>

            <!-- 티어 -->
            <div class="field">
              <label class="field-label">티어</label>
              <div class="tier-group">
                <button
                  v-for="t in tiers"
                  :key="t.value"
                  class="tier-btn"
                  :class="[`tier-btn--${t.value.toLowerCase()}`, { active: form.tier === t.value }]"
                  @click="form.tier = t.value"
                  type="button"
                >
                  {{ t.value }}
                </button>
              </div>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeEdit" :disabled="saving">취소</button>
              <button class="btn-save" @click="handleSave" :disabled="saving">
                {{ saving ? '저장 중...' : '저장' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { getPlayers, updatePlayer, type PlayerRow } from '@/lib/players'

const players = ref<PlayerRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const searchQuery = ref('')

const filteredPlayers = computed(() =>
  players.value.filter(p =>
    p.nickname.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
)

const races = [
  { value: 'T' as const, label: '테란' },
  { value: 'Z' as const, label: '저그' },
  { value: 'P' as const, label: '프로토스' },
]

const tiers = [
  { value: 'A' },
  { value: 'B' },
  { value: 'C' },
  { value: 'D' },
  { value: 'E' },
]

const raceLabel = (r: string) => races.find(x => x.value === r)?.label ?? r

onMounted(async () => {
  try {
    players.value = await getPlayers()
  } catch (e: any) {
    loadError.value = e.message ?? '선수 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 수정 모달 ─────────────────────────────────────────────
const editTarget = ref<PlayerRow | null>(null)
const form = reactive({ nickname: '', race: 'T' as 'T' | 'Z' | 'P', tier: '' })
const saving = ref(false)
const saveError = ref<string | null>(null)

function openEdit(player: PlayerRow) {
  editTarget.value = player
  form.nickname = player.nickname
  form.race = player.race
  form.tier = player.tier
  saveError.value = null
}

function closeEdit() {
  if (saving.value) return
  editTarget.value = null
}

async function handleSave() {
  if (!editTarget.value) return
  if (!form.nickname.trim()) { saveError.value = '닉네임을 입력해주세요.'; return }
  if (!form.tier.trim()) { saveError.value = '티어를 입력해주세요.'; return }

  saving.value = true
  saveError.value = null

  try {
    const updated = await updatePlayer(editTarget.value.id, {
      nickname: form.nickname.trim(),
      race: form.race,
      tier: form.tier.trim(),
    })
    const idx = players.value.findIndex(p => p.id === updated.id)
    if (idx !== -1) players.value[idx] = updated
    editTarget.value = null
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './PlayersView.scss';
</style>
