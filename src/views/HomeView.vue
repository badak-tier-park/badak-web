<template>
  <div class="home">
    <AppHeader />

    <div class="dashboard">

      <!-- ── 맵 관리 ───────────────────────────────────────── -->
      <section class="dash-section">
        <div class="section-header">
          <div class="section-title">
            <span class="section-icon">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.4"/>
                <path d="M1 10l4-4 3 3 3-4 4 5" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
              </svg>
            </span>
            맵 관리
          </div>
          <RouterLink to="/maps/register" class="section-action">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            맵 등록
          </RouterLink>
        </div>

        <div v-if="mapsLoading" class="state-msg">불러오는 중...</div>
        <div v-else-if="mapsError" class="state-msg state-msg--error">{{ mapsError }}</div>
        <div v-else-if="maps.length === 0" class="state-msg">
          등록된 맵이 없습니다.
          <RouterLink to="/maps/register" class="empty-link">첫 번째 맵 등록하기 →</RouterLink>
        </div>
        <div v-else class="map-grid">
          <RouterLink
            v-for="map in maps"
            :key="map.id"
            :to="`/maps/${map.id}/edit`"
            class="map-card"
          >
            <div class="map-thumb">
              <img
                v-if="map.thumbnail_url ?? map.image_url"
                :src="(map.thumbnail_url ?? map.image_url)!"
                :alt="map.name"
              />
              <div v-else class="map-thumb-empty">
                <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
                  <path d="M4 24L12 12L18 18L22 14L28 24H4Z" stroke="rgba(255,255,255,0.2)" stroke-width="1.5" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
            <div class="map-info">
              <span class="map-name">{{ map.name }}</span>
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
      </section>

      <!-- ── 나머지 섹션 카드 그리드 ─────────────────────────── -->
      <div class="nav-grid">

        <div class="nav-card nav-card--disabled">
          <div class="nav-card-icon nav-card-icon--blue">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="7" r="3.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M3 17c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">선수 관리</p>
            <p class="nav-card-desc">닉네임 · 종족 · 티어 변경</p>
          </div>
          <span class="badge-soon">준비 중</span>
        </div>

        <div class="nav-card nav-card--disabled">
          <div class="nav-card-icon nav-card-icon--red">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M5 5V3.5A1.5 1.5 0 016.5 2h7A1.5 1.5 0 0115 3.5V5M8 9v6M12 9v6M4 5l1 12.5A1 1 0 006 18.5h8a1 1 0 001-.5L16 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">경기 관리</p>
            <p class="nav-card-desc">중복 경기 정리 · 기록 삭제</p>
          </div>
          <span class="badge-soon">준비 중</span>
        </div>

        <div class="nav-card nav-card--disabled">
          <div class="nav-card-icon nav-card-icon--green">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 16V8M7 16V4M11 16V10M15 16V6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="17.5" cy="3.5" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">경기 참여 Top 10</p>
            <p class="nav-card-desc">경기 수 기준 선수 랭킹</p>
          </div>
          <span class="badge-soon">준비 중</span>
        </div>

        <div class="nav-card nav-card--disabled">
          <div class="nav-card-icon nav-card-icon--yellow">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M10 2l2.09 4.26L17 7.27l-3.5 3.41.83 4.82L10 13.27l-4.33 2.23.83-4.82L3 7.27l4.91-.71L10 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">승률 Top 10</p>
            <p class="nav-card-desc">승률 기준 랭킹 · 종족별 필터</p>
          </div>
          <span class="badge-soon">준비 중</span>
        </div>

        <div class="nav-card nav-card--disabled">
          <div class="nav-card-icon nav-card-icon--purple">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <rect x="2" y="4" width="16" height="13" rx="2" stroke="currentColor" stroke-width="1.5"/>
              <path d="M6 4V2M14 4V2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M5 10h3M9 10h3M5 13h3M9 13h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
          </div>
          <div class="nav-card-body">
            <p class="nav-card-title">조 지명식</p>
            <p class="nav-card-desc">리그 선수 조 편성 관리</p>
          </div>
          <span class="badge-soon">준비 중</span>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getMaps, type MapRow } from '@/lib/maps'

// ── 맵 목록 ──────────────────────────────────────────────
const maps = ref<MapRow[]>([])
const mapsLoading = ref(true)
const mapsError = ref<string | null>(null)

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
    mapsError.value = e.message ?? '맵 목록을 불러올 수 없습니다.'
  } finally {
    mapsLoading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './HomeView.scss';
</style>
