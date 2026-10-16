<template>
  <div class="maps-page">
    <AppHeader />

    <div class="maps-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <div class="page-title-left">
          <h1 class="page-title">맵 관리</h1>
          <span v-if="!loading" class="map-count">{{ maps.length }}개</span>
        </div>
        <div class="title-actions">
          <button type="button" class="btn-pill btn-pill--md btn-pill--purple" :disabled="loading" @click="showSync = true">
            래더 맵 동기화
          </button>
          <RouterLink to="/maps/register" class="btn-create">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            맵 등록
          </RouterLink>
        </div>
      </div>

      <div v-if="!loading && maps.length > 0" class="filter-row">
        <button
          v-for="f in filters"
          :key="f.key"
          type="button"
          class="filter-chip"
          :class="{ active: filter === f.key }"
          @click="filter = f.key"
        >
          {{ f.label }} <span class="filter-count">{{ f.count }}</span>
        </button>
        <span v-if="lastSyncedLabel" class="sync-stamp">마지막 래더 동기화 {{ lastSyncedLabel }}</span>
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
          placeholder="맵 이름 검색"
        />
        <button v-if="searchQuery" class="search-clear" @click="searchQuery = ''">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
      <div v-else-if="maps.length === 0" class="state-msg">
        등록된 맵이 없습니다.
        <RouterLink to="/maps/register" class="empty-link">첫 번째 맵 등록하기 →</RouterLink>
      </div>
      <div v-else-if="filteredMaps.length === 0" class="state-msg">검색 결과가 없습니다.</div>
      <div v-else class="map-grid">
        <RouterLink
          v-for="map in filteredMaps"
          :key="map.id"
          :to="`/maps/${map.id}/edit`"
          class="map-card"
        >
          <div class="map-thumb">
            <img
              v-if="map.thumbnail_url"
              :src="map.thumbnail_url"
              :alt="map.name"
            />
            <div v-else class="map-thumb-empty">
              <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                <path d="M4 24L12 12L18 18L22 14L28 24H4Z" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
          <div class="map-info">
            <div class="map-name-row">
              <span class="map-name">{{ map.name }}</span>
              <span v-if="map.is_ladder" class="map-badge map-badge--ladder">래더</span>
              <span v-if="map.version" class="map-version">v{{ map.version }}</span>
              <span v-if="!map.thumbnail_url" class="map-badge map-badge--noimage">이미지 필요</span>
            </div>
            <div class="map-meta">
              <span>{{ map.width }}×{{ map.height }}</span>
              <span>{{ map.player_count }}인</span>
              <span class="map-tileset" :style="{ color: tilesetColor(map.tileset) }">{{ tilesetLabel(map.tileset) }}</span>
            </div>
          </div>
          <div class="map-edit-icon">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </div>
        </RouterLink>
      </div>
    </div>

    <LadderSyncModal v-if="showSync" :maps="maps" @close="showSync = false" @applied="reloadMaps" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import LadderSyncModal from './LadderSyncModal.vue'
import { getMaps, type MapRow } from '@/lib/maps'

const maps = ref<MapRow[]>([])
const loading = ref(true)
const loadError = ref<string | null>(null)
const searchQuery = ref('')
const showSync = ref(false)

type FilterKey = 'all' | 'ladder' | 'noimage'
const filter = ref<FilterKey>('all')

const filters = computed(() => [
  { key: 'all' as const, label: '전체', count: maps.value.length },
  { key: 'ladder' as const, label: '래더', count: maps.value.filter(m => m.is_ladder).length },
  { key: 'noimage' as const, label: '이미지 필요', count: maps.value.filter(m => !m.thumbnail_url).length },
])

const filteredMaps = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return maps.value.filter(m => {
    if (filter.value === 'ladder' && !m.is_ladder) return false
    if (filter.value === 'noimage' && m.thumbnail_url) return false
    if (!q) return true
    return m.name.toLowerCase().includes(q) || m.aliases.some(a => a.toLowerCase().includes(q))
  })
})

const lastSyncedLabel = computed(() => {
  const stamps = maps.value.map(m => m.ladder_synced_at).filter((s): s is string => !!s)
  if (stamps.length === 0) return null
  const d = new Date(stamps.reduce((a, b) => (a > b ? a : b)))
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
})

async function reloadMaps() {
  try {
    maps.value = await getMaps()
  } catch (e: any) {
    loadError.value = e.message ?? '맵 목록을 불러올 수 없습니다.'
  }
}

const tilesets: Record<string, { label: string; color: string }> = {
  badlands: { label: '황무지',     color: '#c97d3a' },
  space:    { label: '우주 정거장', color: '#4a8fcc' },
  install:  { label: '설치물',     color: '#7a8a9a' },
  ashworld: { label: '화산 지대',  color: '#cc4a2f' },
  jungle:   { label: '정글',       color: '#3a9a4a' },
  desert:   { label: '사막',       color: '#c9a83a' },
  ice:      { label: '얼음',       color: '#7aaed4' },
  twilight: { label: '황혼',       color: '#9a4acc' },
}

const tilesetLabel = (id: string) => tilesets[id]?.label ?? id
const tilesetColor = (id: string) => tilesets[id]?.color ?? '#fff'

onMounted(async () => {
  try {
    maps.value = await getMaps()
  } catch (e: any) {
    loadError.value = e.message ?? '맵 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './MapsView.scss';
</style>
