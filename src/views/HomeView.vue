<template>
  <div class="home">
    <AppHeader>
      <template #actions>
        <RouterLink to="/maps/register" class="header-btn header-btn--primary">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
          맵 등록
        </RouterLink>
      </template>
    </AppHeader>

    <div class="home-content">
      <!-- 로딩 -->
      <div v-if="loading" class="state-msg">불러오는 중...</div>

      <!-- 에러 -->
      <div v-else-if="error" class="state-msg state-msg--error">{{ error }}</div>

      <!-- 빈 상태 -->
      <div v-else-if="maps.length === 0" class="state-msg">
        등록된 맵이 없습니다.
        <RouterLink to="/maps/register" class="empty-link">첫 번째 맵 등록하기 →</RouterLink>
      </div>

      <!-- 맵 목록 -->
      <div v-else class="map-grid">
        <RouterLink
          v-for="map in maps"
          :key="map.id"
          :to="`/maps/${map.id}/edit`"
          class="map-card"
        >
          <div class="map-thumb">
            <img v-if="map.thumbnail_url ?? map.image_url" :src="(map.thumbnail_url ?? map.image_url)!" :alt="map.name" />
            <div v-else class="map-thumb-empty">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
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
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9.5 2.5L11.5 4.5L4.5 11.5H2.5V9.5L9.5 2.5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            </svg>
          </div>
        </RouterLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getMaps, type MapRow } from '@/lib/maps'

const maps = ref<MapRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const tilesets: Record<string, { label: string; color: string }> = {
  badlands: { label: '황무지',    color: '#c97d3a' },
  space:    { label: '우주 정거장', color: '#4a8fcc' },
  install:  { label: '설치물',    color: '#7a8a9a' },
  ashworld: { label: '화산 지대', color: '#cc4a2f' },
  jungle:   { label: '정글',     color: '#3a9a4a' },
  desert:   { label: '사막',     color: '#c9a83a' },
  ice:      { label: '얼음',     color: '#7aaed4' },
  twilight: { label: '황혼',     color: '#9a4acc' },
}

const tilesetLabel = (id: string) => tilesets[id]?.label ?? id
const tilesetColor = (id: string) => tilesets[id]?.color ?? '#fff'

onMounted(async () => {
  try {
    maps.value = await getMaps()
  } catch (e: any) {
    error.value = e.message ?? '맵 목록을 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  background: #0a0b10;
  display: flex;
  flex-direction: column;
}

.home-content {
  flex: 1;
  max-width: 1100px;
  width: 100%;
  margin: 0 auto;
  padding: 36px 24px 80px;
  box-sizing: border-box;
}

/* 상태 메시지 */
.state-msg {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding-top: 120px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.25);
  font-family: system-ui, sans-serif;

  &--error { color: #f87171; }
}

.empty-link {
  font-size: 13px;
  color: #c084fc;
  text-decoration: none;

  &:hover { text-decoration: underline; }
}

/* 맵 그리드 */
.map-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.map-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  background: rgba(255, 255, 255, 0.03);
  text-decoration: none;
  transition: all 0.15s;
  cursor: pointer;

  &:hover {
    border-color: rgba(170, 59, 255, 0.35);
    background: rgba(170, 59, 255, 0.05);

    .map-edit-icon { opacity: 1; }
  }
}

.map-thumb {
  width: 64px;
  height: 48px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.05);

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }
}

.map-thumb-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.map-name {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.85);
  font-family: system-ui, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.map-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.35);
  font-family: system-ui, sans-serif;

  span + span::before {
    content: '·';
    margin-right: 8px;
  }
}

.map-tileset {
  font-weight: 500;
}

.map-edit-icon {
  flex-shrink: 0;
  color: rgba(255, 255, 255, 0.3);
  opacity: 0;
  transition: opacity 0.15s;
}

/* 헤더 버튼 */
.header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  border: 1px solid rgba(170, 59, 255, 0.4);
  background: rgba(170, 59, 255, 0.12);
  color: #c084fc;
  font-size: 13px;
  font-weight: 600;
  font-family: system-ui, sans-serif;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &--primary:hover {
    background: rgba(170, 59, 255, 0.22);
    border-color: rgba(170, 59, 255, 0.65);
    color: #d8a4ff;
  }
}
</style>
