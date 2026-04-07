<template>
  <div class="leagues-page">
    <AppHeader />

    <div class="leagues-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">정규리그 관리</h1>
        <button class="btn-create" @click="showForm = true">
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          정규리그 생성
        </button>
      </div>

      <!-- 리그 목록 -->
      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="leagues.length === 0" class="state-msg">
        생성된 리그가 없습니다.
      </div>
      <div v-else class="league-list">
        <div v-for="league in leagues" :key="league.id" class="league-card" :class="`league-card--${league.type}`">

          <!-- 헤더: 타입·상태 뱃지 + 수정 버튼 -->
          <div class="league-card-header">
            <div class="league-card-badges">
              <div class="league-type-badge" :class="`type--${league.type}`">
                {{ leagueTypeLabel(league.type) }}
              </div>
              
            </div>
            <button class="btn-card-edit" @click.stop="openEdit(league)">
              <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
                <path d="M8.5 1.5l2 2L3 11H1V9L8.5 1.5z" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              수정
            </button>
          </div>

          <!-- 바디: 리그명 + 메타 -->
          <div class="league-card-body">
            <div class="league-name">{{ league.name }}&nbsp;
              <span class="league-status" :class="`status--${getLeagueStatus(league)}`">
                {{ statusLabel(getLeagueStatus(league)) }}
              </span>
            </div>
            <div class="league-card-meta">
              <span class="league-period">
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                  <rect x="1" y="2" width="9" height="8" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
                  <path d="M3.5 1v2M7.5 1v2M1 5h9" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
                </svg>
                {{ league.start_date.replaceAll('-', '/') }} ~ {{ league.end_date.replaceAll('-', '/') }}
              </span>
              <div class="league-tiers">
                <span
                  v-for="tier in league.eligible_tiers"
                  :key="tier"
                  class="tier-chip"
                  :class="`tier-chip--${tier.toLowerCase()}`"
                >{{ tier }}</span>
              </div>
            </div>
          </div>

          <!-- 액션: 상세 설정 | 지목식 -->
          <div class="league-card-actions">
            <button class="action-btn action-btn--detail" @click="router.push({ name: 'league-detail', params: { id: league.id } })">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M6 4v2.5M6 8h.01" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
              </svg>
              상세 설정
              <span v-if="!league.is_ready" class="action-badge action-badge--warning">미완료</span>
              <span v-else class="action-badge action-badge--done">완료</span>
            </button>
            <button
              v-if="league.has_draft"
              class="action-btn"
              :class="{
                'action-btn--draft': isDraftActive(league),
                'action-btn--picks-done': league.picks_completed && !league.draft_completed,
                'action-btn--draft-done': league.draft_completed,
                'action-btn--draft-disabled': !isDraftActive(league) && !league.picks_completed && !league.draft_completed,
              }"
              :role="isDraftActive(league) || league.picks_completed || league.draft_completed ? 'button' : undefined"
              :tabindex="isDraftActive(league) || league.picks_completed || league.draft_completed ? 0 : undefined"
              @click="(isDraftActive(league) || league.picks_completed || league.draft_completed) && router.push({ name: 'league-draft', params: { id: league.id } })"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 10V5l4-3 4 3v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M4.5 10V7h3v3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <template v-if="league.draft_completed">지목식
                <span class="action-badge action-badge--done">완료</span>
              </template>
              <template v-else-if="league.picks_completed">선수배정
                <span class="action-badge action-badge--picks">완료</span>
              </template>
              <template v-else-if="isDraftActive(league)">팀원 지목식</template>
              <template v-else>지목식 예정 {{ league.draft_date ? league.draft_date.replaceAll('-', '/') : '' }}</template>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 리그 생성 모달 -->
    <Teleport to="body">
      <div v-if="showForm" class="modal-backdrop" @click.self="closeForm">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editTarget ? '정규리그 수정' : '정규리그 생성' }}</span>
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

            <!-- 팀장 인원 -->
            <div class="field">
              <label class="field-label">팀장 인원</label>
              <div class="captain-count-group">
                <button
                  v-for="n in [2, 3, 4, 5, 6]"
                  :key="n"
                  class="count-btn"
                  :class="{ active: form.captain_count === n }"
                  type="button"
                  @click="form.captain_count = n"
                >{{ n }}명</button>
              </div>
            </div>

            <!-- 참가 자격 -->
            <div class="field">
              <label class="field-label">참가 자격</label>
              <div class="eligibility-group">
                <button
                  class="eligibility-btn"
                  :class="{ active: form.eligibility_type === 'open' }"
                  type="button"
                  @click="form.eligibility_type = 'open'"
                >전체 선수</button>
                <button class="eligibility-btn" type="button" disabled>참가 신청</button>
                <button class="eligibility-btn" type="button" disabled>선수 지목</button>
              </div>
            </div>

            <!-- 팀원 지목식 -->
            <div class="field">
              <label class="field-label">팀원 지목식</label>
              <div class="draft-group">
                <button class="draft-btn" type="button" disabled>없음</button>
                <button class="draft-btn active" type="button" disabled>있음</button>
              </div>
            </div>

            <!-- 팀원 지목식 날짜 -->
            <div v-if="form.has_draft" class="field">
              <label class="field-label">지목식 날짜</label>
              <VueDatePicker
                v-model="draftPickerDate"
                :enable-time-picker="false"
                :locale="ko"
                :dark="true"
                auto-apply
                :teleport="false"
                @update:model-value="onDraftDateSelect"
              >
                <template #trigger>
                  <div class="dp-custom-input">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    <span :class="draftDateDisplayText ? 'dp-date-text' : 'dp-placeholder'">
                      {{ draftDateDisplayText || '날짜 선택' }}
                    </span>
                  </div>
                </template>
              </VueDatePicker>
            </div>

            <!-- 참여 가능 티어 -->
            <div class="field">
              <label class="field-label">참여 가능 티어</label>
              <div class="tier-group">
                <button
                  v-for="t in tiers"
                  :key="t.value"
                  class="tier-btn active"
                  :class="`tier-btn--${t.value.toLowerCase()}`"
                  type="button"
                  disabled
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
import { useRouter } from 'vue-router'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader.vue'
import { getLeagues, createLeague, updateLeague, getLeagueStatus, type LeagueRow, type LeagueType, type LeagueStatus, type EligibilityType } from '@/lib/leagues'

const router = useRouter()

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
  { value: 'regular_summer' as LeagueType, label: '정규리그', sub: 'Summer' },
  { value: 'regular_winter' as LeagueType, label: '정규리그', sub: 'Winter' },
]

const tiers = ['A', 'B', 'C', 'D', 'E'].map(v => ({ value: v }))

const leagueTypeLabel = (type: LeagueType) => {
  const found = leagueTypes.find(t => t.value === type)
  return found ? `${found.label} ${found.sub}` : type
}

const statusLabel = (s: LeagueStatus) =>
  ({ preparing: '준비 중', upcoming: '예정', ongoing: '진행 중', finished: '종료' })[s]

function isDraftActive(league: LeagueRow): boolean {
  if (!league.has_draft || !league.draft_date || !league.is_ready) return false
  const today = new Date().toISOString().slice(0, 10)
  return league.draft_date <= today
}

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
  eligible_tiers: ['A', 'B', 'C', 'D', 'E'] as string[],
  eligibility_type: 'open' as EligibilityType,
  has_draft: true,
  draft_date: '' as string,
  captain_count: 4,
})

const pickerDates = ref<Date[] | null>(null)
const dateDisplayText = ref('')
const draftPickerDate = ref<Date | null>(null)
const draftDateDisplayText = ref('')

function toYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function onDraftDateSelect(val: Date | null) {
  if (val) {
    form.draft_date = toYMD(val)
    draftDateDisplayText.value = form.draft_date.replaceAll('-', '/')
  } else {
    form.draft_date = ''
    draftDateDisplayText.value = ''
  }
}


function openEdit(league: LeagueRow) {
  editTarget.value = league
  form.type = league.type
  form.name = league.name
  form.start_date = league.start_date
  form.end_date = league.end_date
  form.eligible_tiers = [...league.eligible_tiers]
  form.eligibility_type = league.eligibility_type
  form.has_draft = league.has_draft
  form.draft_date = league.draft_date ?? ''
  form.captain_count = league.captain_count ?? 4
  pickerDates.value = [new Date(league.start_date), new Date(league.end_date)]
  dateDisplayText.value = `${league.start_date.replaceAll('-', '/')} ~ ${league.end_date.replaceAll('-', '/')}`
  draftPickerDate.value = league.draft_date ? new Date(league.draft_date) : null
  draftDateDisplayText.value = league.draft_date ? league.draft_date.replaceAll('-', '/') : ''
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
  if (form.has_draft && !form.draft_date) { saveError.value = '팀원 지목식 날짜를 선택해주세요.'; return }

  saving.value = true
  saveError.value = null

  try {
    const created = await createLeague({
      type: form.type,
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      eligible_tiers: [...form.eligible_tiers].sort(),
      eligibility_type: form.eligibility_type,
      has_draft: form.has_draft,
      draft_date: form.has_draft ? form.draft_date : null,
      captain_count: form.captain_count,
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
  if (form.has_draft && !form.draft_date) { saveError.value = '팀원 지목식 날짜를 선택해주세요.'; return }

  saving.value = true
  saveError.value = null

  try {
    const updated = await updateLeague(editTarget.value.id, {
      type: form.type,
      name: form.name.trim(),
      start_date: form.start_date,
      end_date: form.end_date,
      eligible_tiers: [...form.eligible_tiers].sort(),
      eligibility_type: form.eligibility_type,
      has_draft: form.has_draft,
      draft_date: form.has_draft ? form.draft_date : null,
      captain_count: form.captain_count,
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
  form.eligibility_type = 'open'
  form.has_draft = true
  form.draft_date = ''
  form.captain_count = 4
  form.eligible_tiers = ['A', 'B', 'C', 'D', 'E']
  pickerDates.value = null
  dateDisplayText.value = ''
  draftPickerDate.value = null
  draftDateDisplayText.value = ''
  saveError.value = null
}
</script>

<style lang="scss" scoped>
@use './LeaguesView.scss';
</style>
