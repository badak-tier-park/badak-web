<template>
  <section class="home-cal">
    <div class="home-cal-header">
      <h3 class="home-cal-title">일정</h3>
      <div class="home-cal-nav">
        <button class="cal-nav-btn" @click="prevMonth" aria-label="이전 달">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <span class="cal-month-label">{{ viewYear }}.{{ String(viewMonth + 1).padStart(2, '0') }}</span>
        <button class="cal-nav-btn" @click="nextMonth" aria-label="다음 달">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M5 2L10 7L5 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="cal-state">불러오는 중...</div>
    <div v-else-if="loadError" class="cal-state cal-state--error">{{ loadError }}</div>

    <div v-else class="cal-body">
      <div class="cal-weekdays">
        <div v-for="(w, i) in weekdays" :key="w" class="cal-weekday" :class="{ 'sun': i === 0, 'sat': i === 6 }">
          {{ w }}
        </div>
      </div>
      <div class="cal-grid" :key="`${viewYear}-${viewMonth}`">
        <div
          v-for="cell in calendarCells"
          :key="cell.key"
          class="cal-cell"
          :class="{
            'out': !cell.inMonth,
            'today': cell.isToday,
            'sun': cell.dow === 0,
            'sat': cell.dow === 6,
            'has-events': cell.events.length > 0,
          }"
        >
          <span class="cal-day">{{ cell.day }}</span>
          <div class="cal-events">
            <div
              v-for="ev in cell.events.slice(0, 2)"
              :key="ev.id"
              class="cal-chip"
              :style="{
                background: EVENT_TYPE_META[ev.event_type].bg,
                color: EVENT_TYPE_META[ev.event_type].text,
                borderLeftColor: EVENT_TYPE_META[ev.event_type].color,
              }"
              @click="openDetail(ev)"
            >
              <span v-if="ev.event_time" class="cal-chip-time">{{ formatTime(ev.event_time) }}</span>
              <span class="cal-chip-title">{{ ev.title }}</span>
            </div>
            <div v-if="cell.events.length > 2" class="cal-more" @click="openMore(cell)">
              +{{ cell.events.length - 2 }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="detailOpen" class="cal-modal-backdrop" @click.self="closeDetail">
        <div class="cal-modal">
          <div class="cal-modal-header">
            <span class="cal-modal-title">{{ moreCell ? `${moreCell.key} 일정` : '일정 상세' }}</span>
            <button class="cal-modal-close" @click="closeDetail">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="cal-modal-body">
            <template v-if="moreCell">
              <div v-for="ev in moreCell.events" :key="ev.id" class="cal-detail-item" @click="detailEvent = ev; moreCell = null">
                <span class="cal-detail-tag" :style="{ background: EVENT_TYPE_META[ev.event_type].color }">
                  {{ EVENT_TYPE_META[ev.event_type].label }}
                </span>
                <span v-if="ev.event_time" class="cal-detail-time">{{ formatTime(ev.event_time) }}</span>
                <span class="cal-detail-title">{{ ev.title }}</span>
              </div>
            </template>
            <template v-else-if="detailEvent">
              <div class="cal-detail-row">
                <span class="cal-detail-tag" :style="{ background: EVENT_TYPE_META[detailEvent.event_type].color }">
                  {{ EVENT_TYPE_META[detailEvent.event_type].label }}
                </span>
                <h4 class="cal-detail-heading">{{ detailEvent.title }}</h4>
              </div>
              <div class="cal-detail-meta">
                <span>{{ detailEvent.event_date }}</span>
                <span v-if="detailEvent.event_time">{{ formatTime(detailEvent.event_time) }}</span>
              </div>
              <p v-if="detailEvent.description" class="cal-detail-desc">{{ detailEvent.description }}</p>
            </template>
          </div>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { getCalendarItems, EVENT_TYPE_META, type CalendarItem } from '@/lib/events'

const events = ref<CalendarItem[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)

const today = new Date()
const viewYear = ref(today.getFullYear())
const viewMonth = ref(today.getMonth())

const weekdays = ['일', '월', '화', '수', '목', '금', '토']

interface Cell {
  key: string
  day: number
  inMonth: boolean
  isToday: boolean
  dow: number
  events: CalendarItem[]
}

const eventsByDate = computed(() => {
  const map = new Map<string, CalendarItem[]>()
  for (const ev of events.value) {
    const arr = map.get(ev.event_date) ?? []
    arr.push(ev)
    map.set(ev.event_date, arr)
  }
  return map
})

const calendarCells = computed((): Cell[] => {
  const y = viewYear.value
  const m = viewMonth.value
  const first = new Date(y, m, 1)
  const startDow = first.getDay()
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
      events: eventsByDate.value.get(key) ?? [],
    })
  }
  return cells
})

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

function formatTime(t: string): string {
  return t.slice(0, 5)
}

function prevMonth() {
  if (viewMonth.value === 0) { viewMonth.value = 11; viewYear.value-- }
  else viewMonth.value--
}
function nextMonth() {
  if (viewMonth.value === 11) { viewMonth.value = 0; viewYear.value++ }
  else viewMonth.value++
}

const detailOpen = ref(false)
const detailEvent = ref<CalendarItem | null>(null)
const moreCell = ref<Cell | null>(null)

function openDetail(ev: CalendarItem) {
  detailEvent.value = ev
  moreCell.value = null
  detailOpen.value = true
}

function openMore(cell: Cell) {
  moreCell.value = cell
  detailEvent.value = null
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailEvent.value = null
  moreCell.value = null
}

onMounted(async () => {
  try {
    events.value = await getCalendarItems()
  } catch (e: any) {
    loadError.value = e.message ?? '일정을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './HomeCalendar.scss';
</style>
