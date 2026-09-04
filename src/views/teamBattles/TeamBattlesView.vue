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
        <RouterLink
          v-for="b in battles"
          :key="b.id"
          :to="{ name: 'team-battle-detail', params: { id: b.id } }"
          class="battle-card"
        >
          <div class="battle-card-header">
            <span class="battle-status" :class="`status--${b.status.toLowerCase()}`">
              {{ TEAM_BATTLE_STATUS_LABEL[b.status] }}
            </span>
            <span class="battle-start">{{ formatDateTime(b.start_at) }}</span>
          </div>
          <p class="battle-name">{{ b.name }}</p>
        </RouterLink>
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
              <label class="field-label">시작 시간</label>
              <VueDatePicker
                v-model="form.startAt"
                :enable-time-picker="true"
                :locale="ko"
                :dark="true"
                auto-apply
                :teleport="false"
                :min-date="new Date()"
              >
                <template #trigger>
                  <div class="dp-custom-input">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    <span :class="form.startAt ? 'dp-date-text' : 'dp-placeholder'">
                      {{ form.startAt ? formatDateTime(form.startAt.toISOString()) : '시작 시간 선택' }}
                    </span>
                  </div>
                </template>
              </VueDatePicker>
              <p class="field-hint">이 시간이 되면 모집이 자동으로 마감됩니다.</p>
            </div>

            <div class="field">
              <label class="field-label">에이스 결정전 방식</label>
              <div class="ace-mode-group">
                <button
                  type="button"
                  class="ace-mode-btn"
                  :class="{ active: form.aceMode === 'RANDOM' }"
                  @click="form.aceMode = 'RANDOM'"
                >랜덤 추첨</button>
                <button
                  type="button"
                  class="ace-mode-btn"
                  :class="{ active: form.aceMode === 'CAPTAIN' }"
                  @click="form.aceMode = 'CAPTAIN'"
                >팀장 지정</button>
              </div>
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
import { ref, reactive, onMounted } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import {
  getTeamBattles, createTeamBattle, TEAM_BATTLE_STATUS_LABEL,
  type TeamBattleRow, type AceMode,
} from '@/lib/teamBattles'

const router = useRouter()
const auth = useAuthStore()

const battles = ref<TeamBattleRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const myPlayer = ref<PlayerRow | null>(null)

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const date = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${date} ${time}`
}

onMounted(async () => {
  try {
    const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
    const [battlesData, me] = await Promise.all([
      getTeamBattles(),
      discordId ? getPlayerByDiscordId(discordId) : Promise.resolve(null),
    ])
    battles.value = battlesData
    myPlayer.value = me
  } catch (e: any) {
    loadError.value = e.message ?? '팀배틀 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 생성 모달 ─────────────────────────────────────────────
const showForm = ref(false)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({
  name: '',
  startAt: null as Date | null,
  aceMode: 'RANDOM' as AceMode,
})

function openCreate() {
  form.name = ''
  form.startAt = null
  form.aceMode = 'RANDOM'
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
  if (!form.startAt) { saveError.value = '시작 시간을 선택해주세요.'; return }

  saving.value = true
  saveError.value = null
  try {
    const created = await createTeamBattle(
      { name: form.name.trim(), start_at: form.startAt.toISOString(), ace_mode: form.aceMode },
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
