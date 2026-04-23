<template>
  <div class="seasons-page">
    <AppHeader />

    <div class="seasons-content">
      <button class="btn-back" @click="$router.back()">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        뒤로
      </button>

      <div class="page-title-row">
        <h2 class="page-title page-title--sm">시즌 관리</h2>
      </div>

      <!-- 시즌 목록 -->
      <div class="season-list">
        <div v-if="seasons.length === 0 && !loading" class="state-msg">
          등록된 시즌이 없습니다.
        </div>
        <div v-for="s in seasons" :key="s.id" class="season-item">
          <template v-if="editingId === s.id">
            <div class="season-edit-row">
              <input v-model="editForm.name" class="season-input season-input--wide" placeholder="시즌 이름" />
              <VueDatePicker
                v-model="editDateRange"
                range
                :enable-time-picker="false"
                :locale="ko"
                :dark="true"
                auto-apply
                :teleport="false"
              >
                <template #trigger>
                  <div class="dp-custom-input">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                      <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                      <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                    </svg>
                    <span :class="editDateRange ? 'dp-date-text' : 'dp-placeholder'">
                      {{ editDateRangeText || '기간 선택' }}
                    </span>
                  </div>
                </template>
              </VueDatePicker>
              <div class="season-edit-actions">
                <button class="btn-pill btn-pill--ghost btn-pill--md" @click="editingId = null">취소</button>
                <button class="btn-save" @click="saveEdit(s.id)">저장</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="season-item-info">
              <span class="season-item-name">{{ s.name }}</span>
              <span v-if="s.start_date || s.end_date" class="season-item-dates">
                {{ s.start_date ?? '?' }} ~ {{ s.end_date ?? '?' }}
              </span>
            </div>
            <div class="season-item-actions">
              <button class="btn-pill btn-pill--ghost btn-pill--md" @click="startEdit(s)">수정</button>
              <button class="btn-pill btn-pill--red btn-pill--md" @click="remove(s.id)">삭제</button>
            </div>
          </template>
        </div>
      </div>

      <!-- 새 시즌 추가 -->
      <div class="season-add-card">
        <h3 class="season-add-title">새 시즌 추가</h3>
        <div class="season-add-body">
          <input v-model="newForm.name" class="season-input season-input--wide" placeholder="시즌 이름 (예: S2026 S1)" />
          <VueDatePicker
            v-model="newDateRange"
            range
            :enable-time-picker="false"
            :locale="ko"
            :dark="true"
            auto-apply
            :teleport="false"
            format="yyyy-MM-dd"
          >
            <template #trigger>
              <div class="dp-custom-input">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" class="dp-custom-icon">
                  <rect x="1" y="2" width="12" height="11" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
                  <path d="M4 1v2M10 1v2M1 5h12" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
                </svg>
                <span :class="newDateRange ? 'dp-date-text' : 'dp-placeholder'">
                  {{ newDateRangeText || '기간 선택 (선택)' }}
                </span>
              </div>
            </template>
          </VueDatePicker>
          <div class="season-add-footer">
            <button
              class="btn-submit"
              :disabled="!newForm.name.trim()"
              @click="add"
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { VueDatePicker } from '@vuepic/vue-datepicker'
import '@vuepic/vue-datepicker/dist/main.css'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/AppHeader.vue'
import { getSeasons, createSeason, updateSeason, deleteSeason, type SeasonRow } from '@/lib/seasons'

const loading = ref(true)
const seasons = ref<SeasonRow[]>([])
const editingId = ref<number | null>(null)
const editForm = ref({ name: '' })
const editDateRange = ref<[Date, Date] | null>(null)
const newForm = ref({ name: '' })
const newDateRange = ref<[Date, Date] | null>(null)

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const editDateRangeText = computed(() => {
  const [s, e] = editDateRange.value ?? []
  if (!s || !e) return ''
  return `${toYMD(s)} ~ ${toYMD(e)}`
})

const newDateRangeText = computed(() => {
  const [s, e] = newDateRange.value ?? []
  if (!s || !e) return ''
  return `${toYMD(s)} ~ ${toYMD(e)}`
})

onMounted(async () => {
  seasons.value = await getSeasons()
  loading.value = false
})

function startEdit(s: SeasonRow) {
  editingId.value = s.id
  editForm.value = { name: s.name }
  editDateRange.value = s.start_date && s.end_date
    ? [new Date(s.start_date), new Date(s.end_date)]
    : null
}

async function saveEdit(id: number) {
  await updateSeason(id, {
    name: editForm.value.name,
    start_date: editDateRange.value ? toYMD(editDateRange.value[0]) : null,
    end_date: editDateRange.value ? toYMD(editDateRange.value[1]) : null,
  })
  editingId.value = null
  seasons.value = await getSeasons()
}

async function add() {
  if (!newForm.value.name.trim()) return
  await createSeason({
    name: newForm.value.name.trim(),
    start_date: newDateRange.value ? toYMD(newDateRange.value[0]) : null,
    end_date: newDateRange.value ? toYMD(newDateRange.value[1]) : null,
  })
  newForm.value = { name: '' }
  newDateRange.value = null
  seasons.value = await getSeasons()
}

async function remove(id: number) {
  if (!confirm('시즌을 삭제하시겠습니까?')) return
  await deleteSeason(id)
  seasons.value = await getSeasons()
}
</script>

<style lang="scss" scoped>
@use './SeasonsView.scss';
</style>
