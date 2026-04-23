<template>
  <div class="dashboard-page">
    <AppHeader />

    <div class="dashboard-content">

      <!-- ── 플레이어 검색 + 시즌 필터 ── -->
      <div class="dashboard-topbar">
        <div class="player-search-wrap">
          <svg class="player-search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M9.5 9.5L13 13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <input
            v-model="searchInput"
            class="player-search-input"
            placeholder="선수 검색..."
            @focus="showDropdown = true"
            @blur="hideDropdown"
          />
          <ul v-if="showDropdown && filteredPlayers.length" class="player-dropdown">
            <li
              v-for="p in filteredPlayers"
              :key="p.id"
              class="player-dropdown-item"
              @mousedown.prevent="selectPlayer(p.nickname)"
            >
              <span class="pd-race" :class="`race--${p.race.toLowerCase()}`">{{ p.race }}</span>
              <span class="pd-name">{{ p.nickname }}</span>
            </li>
          </ul>
        </div>

        <div class="season-filters">
          <button
            class="season-btn"
            :class="{ 'season-btn--active': selectedSeasonId === null }"
            @click="selectedSeasonId = null"
          >전체</button>
          <button
            v-for="s in seasons"
            :key="s.id"
            class="season-btn"
            :class="{ 'season-btn--active': selectedSeasonId === s.id }"
            @click="selectedSeasonId = s.id"
          >{{ s.name }}</button>
        </div>

        <button v-if="auth.isAdmin" class="btn-season-mgmt" @click="showSeasonModal = true">
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
            <path d="M7 4v3l2 1.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          </svg>
          시즌 관리
        </button>
      </div>

      <!-- 플레이어 없음 -->
      <div v-if="!selectedPlayer" class="state-msg">
        검색창에서 선수를 선택하세요.
      </div>

      <template v-else>
        <!-- ── 선수 헤더 ── -->
        <div class="player-header">
          <div class="player-header-left">
            <span class="player-main-race" :class="`race--${playerInfo?.race.toLowerCase() ?? 'T'}`">
              {{ playerInfo?.race }}
            </span>
            <h2 class="player-name">{{ selectedPlayer }}</h2>
            <span v-if="playerInfo?.tier" class="player-tier" :class="`tier-badge--${playerInfo.tier.toLowerCase()}`">
              {{ playerInfo.tier }}
            </span>
          </div>
          <div class="player-summary">
            <div class="summary-item">
              <span class="summary-val">{{ totalGames }}</span>
              <span class="summary-lbl">게임</span>
            </div>
            <div class="summary-divider" />
            <div class="summary-item">
              <span class="summary-val summary-val--win">{{ totalWins }}</span>
              <span class="summary-lbl">승</span>
            </div>
            <div class="summary-divider" />
            <div class="summary-item">
              <span class="summary-val summary-val--loss">{{ totalLosses }}</span>
              <span class="summary-lbl">패</span>
            </div>
            <div class="summary-divider" />
            <div class="summary-item">
              <span class="summary-val" :class="winrateColorClass(overallWinRate)">
                {{ totalGames > 0 ? overallWinRate.toFixed(1) + '%' : '—' }}
              </span>
              <span class="summary-lbl">승률</span>
            </div>
          </div>
        </div>

        <!-- ── Section 1: 종족별 통계 ── -->
        <section class="dash-section">
          <h3 class="dash-section-title">종족별 통계</h3>
          <div class="race-stats-grid">
            <div
              v-for="race in ['T', 'Z', 'P']"
              :key="race"
              class="race-stat-card"
              :class="`race-stat-card--${race.toLowerCase()}`"
            >
              <div class="race-stat-top">
                <span class="race-label" :class="`race--${race.toLowerCase()}`">{{ race }}</span>
                <DonutChart
                  :wins="raceStats[race]?.wins ?? 0"
                  :losses="raceStats[race]?.losses ?? 0"
                  :color-class="`donut-${race.toLowerCase()}`"
                />
              </div>
              <div class="race-stat-nums">
                <div class="race-stat-row">
                  <span class="rsr-label">승</span>
                  <span class="rsr-val rsr-val--win">{{ raceStats[race]?.wins ?? 0 }}</span>
                </div>
                <div class="race-stat-row">
                  <span class="rsr-label">패</span>
                  <span class="rsr-val rsr-val--loss">{{ raceStats[race]?.losses ?? 0 }}</span>
                </div>
                <div class="race-stat-row">
                  <span class="rsr-label">APM</span>
                  <span class="rsr-val">{{ raceStats[race]?.avgApm > 0 ? raceStats[race].avgApm : '—' }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Section 2: 맵별 승률 ── -->
        <section class="dash-section">
          <h3 class="dash-section-title">맵별 승률</h3>
          <div v-if="mapStats.length === 0" class="dash-empty">데이터 없음</div>
          <div v-else class="map-stats-list" :key="chartKey">
            <div v-for="(m, i) in mapStats" :key="m.map" class="map-stat-row" :style="{ '--bar-delay': `${i * 60}ms` }">
              <div class="map-name-cell">
                <img
                  v-if="mapThumbMap[m.map]"
                  :src="mapThumbMap[m.map]"
                  :alt="m.map"
                  class="map-thumb"
                />
                <div v-else class="map-thumb map-thumb--empty" />
                <span class="map-name">{{ m.map }}</span>
              </div>
              <div class="map-bar-wrap">
                <div class="map-bar-bg">
                  <div
                    class="map-bar-fill"
                    :class="winrateColorClass(m.winRate)"
                    :style="{ '--bar-w': m.winRate + '%' }"
                  />
                </div>
                <span class="map-rate" :class="winrateColorClass(m.winRate)">
                  {{ m.winRate.toFixed(1) }}%
                </span>
              </div>
              <span class="map-record">{{ m.wins }}W {{ m.losses }}L</span>
            </div>
          </div>
        </section>

        <!-- ── Section 3 & 4: 그래프 ── -->
        <div class="charts-row">
          <!-- APM 변화 -->
          <section class="dash-section dash-section--chart">
            <h3 class="dash-section-title">APM 변화</h3>
            <div v-if="apmChartPoints.length < 2" class="dash-empty">데이터 부족</div>
            <div v-else class="chart-wrap">
              <svg
                :key="chartKey"
                :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                class="chart-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="apmGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--race-t)" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="var(--race-t)" stop-opacity="0"/>
                  </linearGradient>
                  <clipPath id="apmClip">
                    <rect class="chart-clip-rect" x="0" y="0" :width="CHART_W" :height="CHART_H" />
                  </clipPath>
                </defs>
                <!-- 그리드 라인 -->
                <line
                  v-for="y in apmYGridLines"
                  :key="y.val"
                  :x1="CHART_PAD" :y1="y.y"
                  :x2="CHART_W - CHART_PAD" :y2="y.y"
                  class="chart-grid"
                />
                <!-- Y 라벨 -->
                <text
                  v-for="y in apmYGridLines"
                  :key="'l' + y.val"
                  :x="CHART_PAD - 4" :y="y.y + 4"
                  class="chart-label"
                  text-anchor="end"
                >{{ y.val }}</text>
                <!-- 애니메이션 영역 -->
                <g clip-path="url(#apmClip)">
                  <path :d="apmAreaPath" fill="url(#apmGrad)" />
                  <path :d="apmLinePath" class="chart-line chart-line--apm" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5 4"/>
                  <circle
                    v-for="(pt, i) in apmChartPoints"
                    :key="i"
                    :cx="pt.x" :cy="pt.y" r="3"
                    class="chart-dot chart-dot--apm"
                  >
                    <title>{{ pt.date }}: {{ pt.val }}</title>
                  </circle>
                </g>
                <!-- X 날짜 라벨 -->
                <text
                  v-for="pt in apmXLabels"
                  :key="pt.date"
                  :x="pt.x" :y="CHART_H - 2"
                  class="chart-label"
                  text-anchor="middle"
                >{{ pt.date }}</text>
              </svg>
            </div>
          </section>

          <!-- 일자별 게임 수 -->
          <section class="dash-section dash-section--chart">
            <h3 class="dash-section-title">일자별 게임 수</h3>
            <div v-if="gameCountPoints.length === 0" class="dash-empty">데이터 없음</div>
            <div v-else class="chart-wrap">
              <svg
                :key="chartKey"
                :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
                class="chart-svg"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="gameGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#a855f7" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
                  </linearGradient>
                  <clipPath id="gameClip">
                    <rect class="chart-clip-rect" x="0" y="0" :width="CHART_W" :height="CHART_H" />
                  </clipPath>
                </defs>
                <!-- 그리드 -->
                <line
                  v-for="y in gameYGridLines"
                  :key="y.val"
                  :x1="CHART_PAD" :y1="y.y"
                  :x2="CHART_W - CHART_PAD" :y2="y.y"
                  class="chart-grid"
                />
                <text
                  v-for="y in gameYGridLines"
                  :key="'l' + y.val"
                  :x="CHART_PAD - 4" :y="y.y + 4"
                  class="chart-label"
                  text-anchor="end"
                >{{ y.val }}</text>
                <!-- 애니메이션 영역 -->
                <g clip-path="url(#gameClip)">
                  <path :d="gameAreaPath" fill="url(#gameGrad)" />
                  <path
                    v-if="gameLinePath"
                    :d="gameLinePath"
                    class="chart-line chart-line--game"
                    fill="none"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-dasharray="5 4"
                  />
                  <circle
                    v-for="(pt, i) in gameCountPoints"
                    :key="i"
                    :cx="pt.x" :cy="pt.y" r="3"
                    class="chart-dot chart-dot--game"
                  >
                    <title>{{ pt.date }}: {{ pt.val }}게임</title>
                  </circle>
                </g>
                <!-- X 날짜 라벨 -->
                <text
                  v-for="pt in gameXLabels"
                  :key="pt.date"
                  :x="pt.x" :y="CHART_H - 2"
                  class="chart-label"
                  text-anchor="middle"
                >{{ pt.date }}</text>
              </svg>
            </div>
          </section>
        </div>
      </template>
    </div>

    <!-- ── 시즌 관리 모달 ── -->
    <Teleport to="body">
      <div v-if="showSeasonModal" class="modal-backdrop" @click.self="showSeasonModal = false">
        <div class="season-modal">
          <div class="season-modal-header">
            <span class="season-modal-title">시즌 관리</span>
            <button class="season-modal-close" @click="showSeasonModal = false">×</button>
          </div>

          <!-- 시즌 목록 -->
          <div class="season-list">
            <div v-if="seasons.length === 0" class="season-list-empty">등록된 시즌이 없습니다.</div>
            <div v-for="s in seasons" :key="s.id" class="season-item">
              <template v-if="editingSeasonId === s.id">
                <input v-model="editForm.name" class="season-input" placeholder="시즌 이름" />
                <input v-model="editForm.start_date" class="season-input season-input--date" type="date" />
                <input v-model="editForm.end_date" class="season-input season-input--date" type="date" />
                <button class="btn-pill btn-pill--green btn-pill--md" @click="saveEdit(s.id)">저장</button>
                <button class="btn-pill btn-pill--ghost btn-pill--md" @click="editingSeasonId = null">취소</button>
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
                  <button class="btn-pill btn-pill--red btn-pill--md" @click="removeSeason(s.id)">삭제</button>
                </div>
              </template>
            </div>
          </div>

          <!-- 새 시즌 추가 -->
          <div class="season-add">
            <span class="season-add-title">새 시즌 추가</span>
            <input v-model="newSeason.name" class="season-input" placeholder="시즌 이름 (예: 2025 썸머)" />
            <div class="season-add-dates">
              <input v-model="newSeason.start_date" class="season-input season-input--date" type="date" placeholder="시작일" />
              <span class="season-date-sep">~</span>
              <input v-model="newSeason.end_date" class="season-input season-input--date" type="date" placeholder="종료일" />
            </div>
            <button class="btn-pill btn-pill--purple btn-pill--md btn-pill--filled" :disabled="!newSeason.name.trim()" @click="addSeason">
              추가
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import DonutChart from '@/components/charts/DonutChart.vue'
import { useAuthStore } from '@/stores/auth'
import { getGames, type GameRow } from '@/lib/games'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getSeasons, createSeason, updateSeason, deleteSeason, type SeasonRow } from '@/lib/seasons'
import { getMaps, type MapRow } from '@/lib/maps'

const auth = useAuthStore()

// ── 데이터 ────────────────────────────────────────────────
const loading = ref(true)
const games = ref<GameRow[]>([])
const allPlayers = ref<PlayerRow[]>([])
const seasons = ref<SeasonRow[]>([])
const allMaps = ref<MapRow[]>([])

const mapThumbMap = computed(() => {
  const m: Record<string, string> = {}
  for (const map of allMaps.value) {
    if (!map.thumbnail_url) continue
    m[map.name] = map.thumbnail_url
    for (const alias of (map.aliases ?? [])) m[alias] = map.thumbnail_url
  }
  return m
})

// ── 선수 선택 ─────────────────────────────────────────────
const selectedPlayer = ref<string | null>(null)
const searchInput = ref('')
const showDropdown = ref(false)

const filteredPlayers = computed(() => {
  const q = searchInput.value.trim().toLowerCase()
  if (!q) return allPlayers.value.slice(0, 10)
  return allPlayers.value.filter(p =>
    p.nickname.toLowerCase().includes(q) ||
    (p.aliases ?? []).some(a => a.toLowerCase().includes(q)),
  ).slice(0, 10)
})

const playerInfo = computed(() =>
  allPlayers.value.find(p => p.nickname === selectedPlayer.value) ?? null,
)

function selectPlayer(name: string) {
  selectedPlayer.value = name
  searchInput.value = name
  showDropdown.value = false
}

function hideDropdown() {
  setTimeout(() => { showDropdown.value = false }, 150)
}

// ── 시즌 필터 ─────────────────────────────────────────────
const selectedSeasonId = ref<number | null>(null)

// ── 필터링된 게임 ─────────────────────────────────────────
const playerGames = computed(() => {
  if (!selectedPlayer.value) return []
  const name = selectedPlayer.value
  return games.value.filter(g =>
    g.winner_name?.trim() === name || g.loser_name?.trim() === name,
  )
})

const filteredGames = computed(() => {
  if (selectedSeasonId.value === null) return playerGames.value
  return playerGames.value.filter(g => g.season_id === selectedSeasonId.value)
})

// ── 전체 통계 ─────────────────────────────────────────────
const totalGames = computed(() => filteredGames.value.length)
const totalWins = computed(() => filteredGames.value.filter(g => g.winner_name?.trim() === selectedPlayer.value).length)
const totalLosses = computed(() => totalGames.value - totalWins.value)
const overallWinRate = computed(() => totalGames.value > 0 ? (totalWins.value / totalGames.value) * 100 : 0)

// ── 종족별 통계 ───────────────────────────────────────────
interface RaceStat { wins: number; losses: number; avgApm: number }

const raceStats = computed((): Record<string, RaceStat> => {
  const map: Record<string, { wins: number; losses: number; apmSum: number; apmCount: number }> = {}
  const ensure = (r: string) => { if (!map[r]) map[r] = { wins: 0, losses: 0, apmSum: 0, apmCount: 0 } }
  const name = selectedPlayer.value
  for (const g of filteredGames.value) {
    const isWinner = g.winner_name?.trim() === name
    const race = (isWinner ? g.winner_race : g.loser_race)?.toUpperCase()
    if (!race) continue
    ensure(race)
    if (isWinner) {
      map[race].wins++
      if (g.winner_apm) { map[race].apmSum += g.winner_apm; map[race].apmCount++ }
    } else {
      map[race].losses++
      if (g.loser_apm) { map[race].apmSum += g.loser_apm; map[race].apmCount++ }
    }
  }
  const result: Record<string, RaceStat> = {}
  for (const [r, d] of Object.entries(map)) {
    result[r] = {
      wins: d.wins,
      losses: d.losses,
      avgApm: d.apmCount > 0 ? Math.round(d.apmSum / d.apmCount) : 0,
    }
  }
  return result
})

// ── 맵별 통계 ─────────────────────────────────────────────
const mapStats = computed(() => {
  const map: Record<string, { wins: number; losses: number }> = {}
  const name = selectedPlayer.value
  for (const g of filteredGames.value) {
    const m = g.map_name
    if (!m) continue
    if (!map[m]) map[m] = { wins: 0, losses: 0 }
    if (g.winner_name?.trim() === name) map[m].wins++
    else map[m].losses++
  }
  return Object.entries(map)
    .map(([m, d]) => ({
      map: m,
      wins: d.wins,
      losses: d.losses,
      total: d.wins + d.losses,
      winRate: d.wins + d.losses > 0 ? (d.wins / (d.wins + d.losses)) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)
})

// ── 차트 공통 설정 ────────────────────────────────────────
function smoothLinePath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return ''
  if (pts.length === 2) return `M ${pts[0].x},${pts[0].y} L ${pts[1].x},${pts[1].y}`
  let d = `M ${pts[0].x},${pts[0].y}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? pts[i + 1]
    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`
  }
  return d
}

function smoothAreaPath(pts: { x: number; y: number }[], bot: number): string {
  if (pts.length < 2) return ''
  return `M ${pts[0].x},${bot} L ${pts[0].x},${pts[0].y}` +
    smoothLinePath(pts).replace(/^M [^ ]+ /, ' ') +
    ` L ${pts[pts.length - 1].x},${bot} Z`
}

const CHART_W = 400
const CHART_H = 140
const CHART_PAD = 30

function makeGridLines(max: number, h: number): { val: number; y: number }[] {
  if (max === 0) return []
  const step = max <= 4 ? 1 : max <= 10 ? 2 : Math.ceil(max / 4 / 10) * 10
  const lines: { val: number; y: number }[] = []
  for (let v = 0; v <= max; v += step) {
    const y = CHART_PAD + (1 - v / max) * (h - CHART_PAD * 1.5)
    lines.push({ val: v, y })
  }
  return lines
}

// ── APM 차트 ──────────────────────────────────────────────
const apmByDate = computed(() => {
  const map: Record<string, number[]> = {}
  const name = selectedPlayer.value
  for (const g of filteredGames.value) {
    const date = g.played_at?.slice(0, 10)
    if (!date) continue
    const apm = g.winner_name?.trim() === name ? g.winner_apm : g.loser_apm
    if (!apm) continue
    if (!map[date]) map[date] = []
    map[date].push(apm)
  }
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, vals]) => ({ date, val: Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) }))
})

const apmChartPoints = computed(() => {
  const data = apmByDate.value
  if (data.length < 2) return []
  const maxVal = Math.max(...data.map(d => d.val))
  const minVal = Math.min(...data.map(d => d.val))
  const range = maxVal - minVal || 1
  const xPad = CHART_PAD + 5
  const yTop = CHART_PAD
  const yBot = CHART_H - CHART_PAD
  return data.map((d, i) => ({
    x: xPad + (i / (data.length - 1)) * (CHART_W - xPad - 10),
    y: yTop + (1 - (d.val - minVal) / range) * (yBot - yTop),
    date: d.date.slice(5),
    val: d.val,
  }))
})

const apmLinePath = computed(() => smoothLinePath(apmChartPoints.value))
const apmAreaPath = computed(() => smoothAreaPath(apmChartPoints.value, CHART_H - CHART_PAD))

const apmYGridLines = computed(() => {
  const data = apmByDate.value
  if (!data.length) return []
  const max = Math.max(...data.map(d => d.val))
  const min = Math.min(...data.map(d => d.val))
  const range = max - min || 1
  const steps = [0, 0.25, 0.5, 0.75, 1]
  return steps.map(s => {
    const val = Math.round(min + s * range)
    const y = CHART_PAD + (1 - s) * (CHART_H - CHART_PAD * 1.5)
    return { val, y }
  })
})

const apmXLabels = computed(() => {
  const pts = apmChartPoints.value
  if (!pts.length) return []
  const step = Math.max(1, Math.floor(pts.length / 5))
  return pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
})

// ── 게임 수 차트 ──────────────────────────────────────────
const gameCountByDate = computed(() => {
  const map: Record<string, number> = {}
  for (const g of filteredGames.value) {
    const date = g.played_at?.slice(0, 10)
    if (!date) continue
    map[date] = (map[date] ?? 0) + 1
  }
  return Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, val: count }))
})

const gameCountPoints = computed(() => {
  const data = gameCountByDate.value
  if (!data.length) return []
  const maxVal = Math.max(...data.map(d => d.val))
  const xPad = CHART_PAD + 5
  const yBot = CHART_H - CHART_PAD
  const yTop = CHART_PAD
  return data.map((d, i) => {
    const x = xPad + (data.length === 1 ? (CHART_W - xPad - 10) / 2 : (i / (data.length - 1)) * (CHART_W - xPad - 10))
    const h = maxVal > 0 ? ((d.val / maxVal) * (yBot - yTop)) : 0
    return { x, y: yBot - h, date: d.date.slice(5), val: d.val }
  })
})

const gameLinePath = computed(() => smoothLinePath(gameCountPoints.value))
const gameAreaPath = computed(() => smoothAreaPath(gameCountPoints.value, CHART_H - CHART_PAD))

const gameYGridLines = computed(() => {
  const data = gameCountByDate.value
  if (!data.length) return []
  const max = Math.max(...data.map(d => d.val))
  return makeGridLines(max, CHART_H)
})

const gameXLabels = computed(() => {
  const pts = gameCountPoints.value
  if (!pts.length) return []
  const step = Math.max(1, Math.floor(pts.length / 5))
  return pts.filter((_, i) => i % step === 0 || i === pts.length - 1)
})

// ── 시즌 모달 ─────────────────────────────────────────────
const showSeasonModal = ref(false)
const editingSeasonId = ref<number | null>(null)
const editForm = ref({ name: '', start_date: '', end_date: '' })
const newSeason = ref({ name: '', start_date: '', end_date: '' })

function startEdit(s: SeasonRow) {
  editingSeasonId.value = s.id
  editForm.value = { name: s.name, start_date: s.start_date ?? '', end_date: s.end_date ?? '' }
}

async function saveEdit(id: number) {
  await updateSeason(id, {
    name: editForm.value.name,
    start_date: editForm.value.start_date || null,
    end_date: editForm.value.end_date || null,
  })
  editingSeasonId.value = null
  seasons.value = await getSeasons()
}

async function addSeason() {
  if (!newSeason.value.name.trim()) return
  await createSeason({
    name: newSeason.value.name.trim(),
    start_date: newSeason.value.start_date || null,
    end_date: newSeason.value.end_date || null,
  })
  newSeason.value = { name: '', start_date: '', end_date: '' }
  seasons.value = await getSeasons()
}

async function removeSeason(id: number) {
  if (!confirm('시즌을 삭제하시겠습니까?')) return
  await deleteSeason(id)
  if (selectedSeasonId.value === id) selectedSeasonId.value = null
  seasons.value = await getSeasons()
}

// ── 차트 키 (선수/시즌 변경 시 애니메이션 재생) ───────────
const chartKey = computed(() => `${selectedPlayer.value}-${selectedSeasonId.value}`)

// ── 유틸 ─────────────────────────────────────────────────
function winrateColorClass(rate: number) {
  if (rate >= 60) return 'wr--high'
  if (rate >= 40) return 'wr--mid'
  return 'wr--low'
}

// ── 초기 로딩 ─────────────────────────────────────────────
onMounted(async () => {
  const [gamesData, playersData, seasonsData, mapsData] = await Promise.all([
    getGames(),
    getPlayers(),
    getSeasons(),
    getMaps(),
  ])
  games.value = gamesData
  allPlayers.value = playersData
  seasons.value = seasonsData
  allMaps.value = mapsData

  // 로그인한 유저의 닉네임으로 기본 선택
  const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
  if (discordId) {
    const me = await getPlayerByDiscordId(discordId)
    if (me) selectPlayer(me.nickname)
  }

  loading.value = false
})
</script>

<style lang="scss" scoped>
@use './DashboardView.scss';
</style>
