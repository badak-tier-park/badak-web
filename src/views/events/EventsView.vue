<template>
  <div class="events-page">
    <AppHeader />

    <div class="events-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">일정 관리</h1>
        <div class="month-nav">
          <button class="month-nav-btn" @click="prevMonth" aria-label="이전 달">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <span class="month-label">{{ viewYear }}년 {{ viewMonth + 1 }}월</span>
          <button class="month-nav-btn" @click="nextMonth" aria-label="다음 달">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2L10 7L5 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <button class="btn-today" @click="goToday">오늘</button>
        </div>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>

      <div v-else class="calendar">
        <div class="weekday-row">
          <div v-for="(w, i) in weekdays" :key="w" class="weekday" :class="{ 'weekday--sun': i === 0, 'weekday--sat': i === 6 }">
            {{ w }}
          </div>
        </div>
        <div class="day-grid" :key="`${viewYear}-${viewMonth}`">
          <div
            v-for="cell in calendarCells"
            :key="cell.key"
            class="day-cell"
            :class="{
              'day-cell--out': !cell.inMonth,
              'day-cell--today': cell.isToday,
              'day-cell--sun': cell.dow === 0,
              'day-cell--sat': cell.dow === 6,
              'day-cell--has-events': cell.events.length > 0,
            }"
            @click="onCellClick(cell)"
          >
            <div class="day-cell-head">
              <span class="day-num">{{ cell.day }}</span>
              <span v-if="cell.inMonth" class="day-add" aria-hidden="true">
                <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2.5V11.5M2.5 7H11.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                </svg>
              </span>
            </div>
            <div class="day-events">
              <div
                v-for="item in cell.events.slice(0, 4)"
                :key="item.id"
                class="event-chip"
                :class="{ 'event-chip--schedule': item.source === 'schedule' }"
                :style="{
                  background: EVENT_TYPE_META[item.event_type].bg,
                  color: EVENT_TYPE_META[item.event_type].text,
                  borderLeftColor: EVENT_TYPE_META[item.event_type].color,
                }"
                @click.stop="onChipClick(item)"
              >
                <span v-if="item.event_time" class="event-chip-time">{{ formatTime(item.event_time) }}</span>
                <span class="event-chip-title">{{ item.title }}</span>
              </div>
              <div v-if="cell.events.length > 4" class="event-more">+{{ cell.events.length - 4 }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="modalOpen" class="modal-backdrop" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <span class="modal-title">{{ editingId ? '일정 수정' : '일정 추가' }}</span>
            <button class="modal-close" @click="closeModal">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <div class="modal-body">
            <div class="field">
              <label class="field-label">종류</label>
              <div class="type-group">
                <button
                  v-for="t in eventTypes"
                  :key="t"
                  type="button"
                  class="type-btn"
                  :class="{ active: form.event_type === t }"
                  :style="form.event_type === t ? { background: EVENT_TYPE_META[t].color, borderColor: EVENT_TYPE_META[t].color } : {}"
                  @click="form.event_type = t"
                >
                  {{ EVENT_TYPE_META[t].label }}
                </button>
              </div>
            </div>

            <div class="field">
              <label class="field-label">제목</label>
              <input v-model="form.title" class="field-input" type="text" maxlength="100" placeholder="제목 입력" />
            </div>

            <div class="field-row">
              <div class="field field--half">
                <label class="field-label">날짜</label>
                <input v-model="form.event_date" class="field-input" type="date" />
              </div>
              <div class="field field--half">
                <label class="field-label">시간 <span class="field-optional">(선택)</span></label>
                <input v-model="form.event_time" class="field-input" type="time" />
              </div>
            </div>

            <div class="field">
              <label class="field-label">설명 <span class="field-optional">(선택)</span></label>
              <textarea v-model="form.description" class="field-textarea" rows="3" placeholder="설명 입력"></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
            <div class="modal-actions">
              <button v-if="editingId" class="btn-delete" @click="handleDelete" :disabled="saving">삭제</button>
              <div class="modal-actions-right">
                <button class="btn-cancel" @click="closeModal" :disabled="saving">취소</button>
                <button class="btn-save" @click="handleSave" :disabled="saving">
                  {{ saving ? '저장 중...' : '저장' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import {
  getCalendarItems, createEvent, updateEvent, deleteEvent,
  EVENT_TYPE_META, type CalendarItem, type EventType,
} from '@/lib/events'

const router = useRouter()
const items = ref<CalendarItem[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const weekdays = ['일', '월', '화', '수', '목', '금', '토']
const eventTypes: EventType[] = ['match', 'event', 'notice', 'other']

interface Cell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  dow: number
  date: string
  events: CalendarItem[]
}

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarItem[]>()
  for (const it of items.value) {
    const arr = map.get(it.event_date) ?? []
    arr.push(it)
    map.set(it.event_date, arr)
  }
  return map
})

const calendarCells = computed((): Cell[] => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m, 1)
  const startDow = first.getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevDays = new Date(y, m, 0).getDate()
  const todayKey = isoDate(today)

  const cells: Cell[] = []
  for (let i = 0; i < 42; i++) {
    const offset = i - startDow
    const date = new Date(y, m, 1 + offset)
    const key = isoDate(date)
    cells.push({
      key,
      day: date.getDate(),
      inMonth: date.getMonth() === m,
      isToday: key === todayKey,
      dow: date.getDay(),
      date: key,
      events: eventsByDate.value.get(key) ?? [],
    })
    if (i >= 34 && cells[i].day === daysInMonth && cells[i].inMonth) {
      // ensure we render at least 6 rows; loop continues to 42
    }
    if (i === 41) break
    void prevDays
  }
  return cells
})

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function prevMonth() {
  if (viewMonth.value === 0) {
    viewMonth.value = 11
    viewYear.value--
  } else {
    viewMonth.value--
  }
}

function nextMonth() {
  if (viewMonth.value === 11) {
    viewMonth.value = 0
    viewYear.value++
  } else {
    viewMonth.value++
  }
}

function goToday() {
  viewYear.value = today.getFullYear()
  viewMonth.value = today.getMonth()
}

// ── 모달 ─────────────────────────────────────────────
const modalOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const saveError = ref<string | null>(null)
const form = reactive({
  title: '',
  description: '',
  event_type: 'other' as EventType,
  event_date: '',
  event_time: '',
})

function onCellClick(cell: Cell) {
  openCreate(cell.date)
}

function openCreate(date: string) {
  editingId.value = null
  form.title = ''
  form.description = ''
  form.event_type = 'other'
  form.event_date = date
  form.event_time = ''
  saveError.value = null
  modalOpen.value = true
}

function onChipClick(item: CalendarItem) {
  if (item.source === 'schedule') {
    router.push({ name: 'league-schedule', params: { id: item.league_id! } })
    return
  }
  const eventId = Number(item.id.replace('event-', ''))
  editingId.value = eventId
  form.title = item.title
  form.description = item.description ?? ''
  form.event_type = item.event_type
  form.event_date = item.event_date
  form.event_time = item.event_time ? item.event_time.slice(0, 5) : ''
  saveError.value = null
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  modalOpen.value = false
}

async function reload() {
  items.value = await getCalendarItems()
}

async function handleSave() {
  if (!form.title.trim()) { saveError.value = '제목을 입력해주세요.'; return }
  if (!form.event_date) { saveError.value = '날짜를 입력해주세요.'; return }

  saving.value = true
  saveError.value = null
  try {
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      event_type: form.event_type,
      event_date: form.event_date,
      event_time: form.event_time || null,
    }
    if (editingId.value) {
      await updateEvent(editingId.value, payload)
    } else {
      await createEvent(payload)
    }
    await reload()
    modalOpen.value = false
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!editingId.value) return
  if (!confirm('일정을 삭제하시겠습니까?')) return
  saving.value = true
  saveError.value = null
  try {
    await deleteEvent(editingId.value)
    await reload()
    modalOpen.value = false
  } catch (e: any) {
    saveError.value = e.message ?? '삭제 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await reload()
  } catch (e: any) {
    loadError.value = e.message ?? '일정을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './EventsView.scss';
</style>
