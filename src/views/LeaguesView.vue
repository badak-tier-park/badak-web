<template>
  <div class="leagues-page">
    <AppHeader>
      <template #actions>
        <RouterLink to="/" class="header-btn">← 홈</RouterLink>
      </template>
    </AppHeader>

    <div class="leagues-content">
      <div class="page-title-row">
        <h1 class="page-title">리그 관리</h1>
        <button class="btn-create" @click="showForm = true">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          리그 생성
        </button>
      </div>

      <!-- 리그 목록 -->
      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="leagues.length === 0" class="state-msg">
        생성된 리그가 없습니다.
      </div>
      <div v-else class="league-list">
        <div v-for="league in leagues" :key="league.id" class="league-card">
          <div class="league-type-badge" :class="`type--${league.type}`">
            {{ leagueTypeLabel(league.type) }}
          </div>
          <div class="league-info">
            <p class="league-name">{{ league.name }}</p>
            <p class="league-period">{{ league.start_date }} ~ {{ league.end_date }}</p>
          </div>
          <div class="league-tiers">
            <span
              v-for="tier in league.eligible_tiers"
              :key="tier"
              class="tier-chip"
              :class="`tier-chip--${tier.toLowerCase()}`"
            >{{ tier }}</span>
          </div>
          <span class="league-status" :class="`status--${getLeagueStatus(league)}`">
            {{ statusLabel(getLeagueStatus(league)) }}
          </span>
          <button class="edit-btn" @click="openEdit(league)">수정</button>
        </div>
      </div>
    </div>

    <!-- 리그 생성 모달 -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editTarget ? '리그 수정' : '리그 생성' }}</span>
            <button class="modal-close" @click="closeForm">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">

            <!-- 리그 종류 -->
            <div class="field">
              <label class="field-label">리그 종류</label>
              <div class="type-group">
                <button
                  v-for="t in leagueTypes"
                  :key="t.value"
                  class="type-btn"
                  :class="{ active: form.type === t.value }"
                  type="button"
                  @click="form.type = t.value"
                >
                  <span class="type-btn-main">{{ t.label }}</span>
                  <span class="type-btn-sub">{{ t.sub }}</span>
                </button>
              </div>
            </div>

            <!-- 리그명 -->
            <div class="field">
              <label class="field-label">리그명</label>
              <input
                v-model="form.name"
                class="field-input"
                type="text"
                maxlength="50"
                placeholder="리그명 입력"
              />
            </div>

            <!-- 기간 -->
            <div class="field">
              <label class="field-label">기간</label>
              <VueDatePicker
                v-model="pickerDates"
                range
                :enable-time-picker="false"
                :locale="ko"
                :dark="true"
                auto-apply
                :teleport="false"
                @update:model-value="onDateSelect"
              >
                <template #trigger>
                  <div class="dp-custom-input">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    <span :class="dateDisplayText ? 'dp-date-text' : 'dp-placeholder'">
                      {{ dateDisplayText || '날짜 범위 선택' }}
                    </span>
                  </div>
                </template>
              </VueDatePicker>
            </div>

            <!-- 참여 가능 티어 -->
            <div class="field">
              <label class="field-label">참여 가능 티어 <span class="field-hint">(복수 선택 가능)</span></label>
              <div class="tier-group">
                <button
                  v-for="t in tiers"
                  :key="t.value"
                  class="tier-btn"
                  :class="[`tier-btn--${t.value.toLowerCase()}`, { active: form.eligible_tiers.includes(t.value) }]"
                  type="button"
                  @click="toggleTier(t.value)"
                >
                  {{ t.value }}
                </button>
              </div>
            </div>

          </div>

          <div class="modal-footer">
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
            <div class="modal-actions">
              <button class="btn-cancel" @click="closeForm" :disabled="saving">취소</button>
              <button class="btn-save" @click="editTarget ? handleUpdate() : handleCreate()" :disabled="saving">
                {{ saving ? (editTarget ? '저장 중...' : '생성 중...') : (editTarget ? '저장' : '생성') }}
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
import { RouterLink } from 'vue-router'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader.vue'
import { getLeagues, createLeague, updateLeague, getLeagueStatus, type LeagueRow, type LeagueType, type LeagueStatus } from '@/lib/leagues'

// ── 목록 ──────────────────────────────────────────────────
const leagues = ref<LeagueRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

onMounted(async () => {
  try {
    leagues.value = await getLeagues()
  } catch (e: any) {
    loadError.value = e.message ?? '리그 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

// ── 메타 ──────────────────────────────────────────────────
const leagueTypes = [
  { value: 'regular_summer' as LeagueType, label: '정규리그', sub: 'Summer', defaultName: 'Summer League' },
  { value: 'regular_winter' as LeagueType, label: '정규리그', sub: 'Winter', defaultName: 'Winter League' },
  { value: 'jongchoe'       as LeagueType, label: '종최리그', sub: '종족최강전', defaultName: '종족최강전' },
  { value: 'individual'     as LeagueType, label: '개인리그', sub: 'Individual', defaultName: '개인리그' },
]

const tiers = ['A', 'B', 'C', 'D', 'E'].map(v => ({ value: v }))

const leagueTypeLabel = (type: LeagueType) => {
  const found = leagueTypes.find(t => t.value === type)
  return found ? `${found.label} ${found.sub}` : type
}

const statusLabel = (s: LeagueStatus) =>
  ({ upcoming: '예정', ongoing: '진행 중', finished: '종료' })[s]

// ── 생성/수정 폼 ──────────────────────────────────────────
const showForm = ref(false)
const editTarget = ref<LeagueRow | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)

const form = reactive({
  type: 'regular_summer' as LeagueType,
  name: '',
  start_date: '',
  end_date: '',
  eligible_tiers: [] as string[],
})

const pickerDates = ref<Date[] | null>(null)
const dateDisplayText = ref('')

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatDateRange(dates: Date | Date[] | null) {
  if (!Array.isArray(dates) || !dates[0] || !dates[1]) return ''
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}/${m}/${day}`
  }
  return `${fmt(dates[0])} ~ ${fmt(dates[1])}`
}

function onDateSelect(val: Date[] | null) {
  if (Array.isArray(val) && val.length === 2 && val[0] && val[1]) {
    form.start_date = toYMD(val[0])
    form.end_date   = toYMD(val[1])
    dateDisplayText.value = `${form.start_date.replaceAll('-', '/')} ~ ${form.end_date.replaceAll('-', '/')}`
  } else {
    form.start_date = ''
    form.end_date   = ''
    dateDisplayText.value = ''
  }
}

function toggleTier(tier: string) {
  const idx = form.eligible_tiers.indexOf(tier)
  if (idx === -1) form.eligible_tiers.push(tier)
  else form.eligible_tiers.splice(idx, 1)
}

function openEdit(league: LeagueRow) {
  editTarget.value = league
  form.type = league.type
  form.name = league.name
  form.start_date = league.start_date
  form.end_date = league.end_date
  form.eligible_tiers = [...league.eligible_tiers]
  form.status = league.status
  pickerDates.value = [new Date(league.start_date), new Date(league.end_date)]
  dateDisplayText.value = `${league.start_date.replaceAll('-', '/')} ~ ${league.end_date.replaceAll('-', '/')}`
  saveError.value = null
  showForm.value = true
}

function closeForm() {
  if (saving.value) return
  showForm.value = false
  editTarget.value = null
}

async function handleCreate() {
  if (!form.name.trim()) { saveError.value = '리그명을 입력해주세요.'; return }
  if (!form.start_date)  { saveError.value = '시작일을 선택해주세요.'; return }
  if (!form.end_date)    { saveError.value = '종료일을 선택해주세요.'; return }
  if (form.end_date < form.start_date) { saveError.value = '종료일이 시작일보다 빠릅니다.'; return }
  if (form.eligible_tiers.length === 0) { saveError.value = '참여 가능 티어를 하나 이상 선택해주세요.'; return }

  saving.value = true
  saveError.value = null

  try {
    const created = await createLeague({
      type: form.type,
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      eligible_tiers: [...form.eligible_tiers].sort(),
    })
    leagues.value.unshift(created)
    resetForm()
  } catch (e: any) {
    saveError.value = e.message ?? '생성 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}

async function handleUpdate() {
  if (!editTarget.value) return
  if (!form.name.trim()) { saveError.value = '리그명을 입력해주세요.'; return }
  if (!form.start_date)  { saveError.value = '시작일을 선택해주세요.'; return }
  if (!form.end_date)    { saveError.value = '종료일을 선택해주세요.'; return }
  if (form.end_date < form.start_date) { saveError.value = '종료일이 시작일보다 빠릅니다.'; return }
  if (form.eligible_tiers.length === 0) { saveError.value = '참여 가능 티어를 하나 이상 선택해주세요.'; return }

  saving.value = true
  saveError.value = null

  try {
    const updated = await updateLeague(editTarget.value.id, {
      type: form.type,
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      eligible_tiers: [...form.eligible_tiers].sort(),
    })
    const idx = leagues.value.findIndex(l => l.id === updated.id)
    if (idx !== -1) leagues.value[idx] = updated
    resetForm()
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}

function resetForm() {
  showForm.value = false
  editTarget.value = null
  form.name = ''
  form.type = 'regular_summer'
  form.start_date = ''
  form.end_date = ''
  form.eligible_tiers = []
  pickerDates.value = null
  dateDisplayText.value = ''
  saveError.value = null
}
</script>

<style lang="scss" scoped>
@use './LeaguesView.scss';
</style>
