<template>
  <div class="detail-page">
    <AppHeader />

    <!-- 토스트 알림 -->
    <Teleport to="body">
      <Transition name="toast">
        <div v-if="toast" class="toast">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.4"/>
            <path d="M4 7l2.5 2.5 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          {{ toast }}
        </div>
      </Transition>
    </Teleport>

    <div v-if="pageLoading" class="state-msg">불러오는 중...</div>
    <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

    <div v-else class="detail-content">
      <!-- 뒤로가기 -->
      <button class="btn-back" @click="$router.push({ name: 'leagues' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        정규리그 목록
      </button>

      <!-- 리그 헤더 -->
      <div class="league-header">
        
        <h1 class="league-title">{{ league!.name }}</h1>
        <span class="league-period">{{ league!.start_date }} ~ {{ league!.end_date }}</span>
        
      </div>

      <!-- 지목식 완료 후 잠금 안내 -->
      <div v-if="draftLocked" class="draft-locked-notice">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <rect x="2" y="6" width="9" height="6.5" rx="1.5" stroke="currentColor" stroke-width="1.3"/>
          <path d="M4.5 6V4a2 2 0 014 0v2" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
        </svg>
        지목식이 완료된 리그입니다. 설정을 변경할 수 없습니다.
      </div>

      <!-- 스텝 탭 -->
      <div class="step-tabs">
        <template v-for="(tab, i) in tabs" :key="tab.key">
          <button
            class="step-tab"
            :class="{ active: activeTab === tab.key, done: isTabDone(tab.key) && activeTab !== tab.key }"
            @click="activeTab = tab.key"
          >
            <span class="step-num">
              <svg v-if="isTabDone(tab.key) && activeTab !== tab.key" width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span v-else>{{ i + 1 }}</span>
            </span>
            <span class="step-label">{{ tab.label }}</span>
          </button>
          <div v-if="i < tabs.length - 1" class="step-sep" />
        </template>
      </div>

      <!-- ── 탭 1: 리그 설명 ────────────────────────────── -->
      <section v-if="activeTab === 'description'" class="detail-section">
        <div v-if="!draftLocked" class="editor-toolbar">
          <!-- 서식 -->
          <div class="toolbar-group">
            <button
              v-for="btn in formatButtons"
              :key="btn.label"
              class="toolbar-btn"
              :class="{ active: btn.isActive() }"
              type="button"
              @click="btn.action"
            >{{ btn.label }}</button>
          </div>
          <div class="toolbar-sep" />
          <!-- 정렬 -->
          <div class="toolbar-group">
            <button
              v-for="btn in alignButtons"
              :key="btn.align"
              class="toolbar-btn align-btn"
              :class="{ active: btn.isActive() }"
              type="button"
              :title="btn.title"
              @click="btn.action"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path :d="btn.icon" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="toolbar-sep" />
          <!-- 크기 -->
          <div class="toolbar-group">
            <button
              v-for="size in fontSizes"
              :key="size.value"
              class="toolbar-btn size-btn"
              :class="{ active: activeSize === size.value }"
              type="button"
              @click="applySize(size.value)"
            >{{ size.label }}</button>
          </div>
          <div class="toolbar-sep" />
          <!-- 색상 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn color-reset"
              :class="{ active: !activeColor }"
              type="button"
              @click="editor?.chain().focus().unsetColor().run()"
            >기본</button>
            <button
              v-for="color in colorPresets"
              :key="color.value"
              class="color-swatch"
              :class="{ active: activeColor === color.value }"
              :style="{ background: color.value }"
              :title="color.label"
              type="button"
              @click="applyColor(color.value)"
            />
          </div>
        </div>

        <div class="editor-wrap">
          <EditorContent :editor="editor" class="editor-content" />
        </div>

        <div v-if="!draftLocked" class="section-footer">
          <p v-if="descError" class="save-error">{{ descError }}</p>
          <button class="btn-save" :disabled="descSaving" @click="saveDescription">
            {{ descSaving ? '저장 중...' : '저장 후 다음 단계' }}
          </button>
        </div>
      </section>

      <!-- ── 탭 2: 팀장 선출 ───────────────────────────── -->
      <section v-if="activeTab === 'captains'" class="detail-section">
        <div v-if="!draftLocked" class="section-header">
          <p class="section-desc">
            {{ captainCount }}명의 팀장을 선출합니다. 선택 시 티어 순으로 자동 정렬되며, ▲▼로 수동 조정할 수 있습니다.
          </p>
        </div>

        <div class="captain-list">
          <div v-for="(playerId, i) in captains" :key="playerId" class="captain-row">
            <span class="captain-order-badge">{{ i + 1 }}</span>
            <span class="captain-tier" :class="`tier--${playerById(playerId)?.tier.toLowerCase()}`">
              {{ playerById(playerId)?.tier }}
            </span>
            <span class="captain-race" :class="`race--${playerById(playerId)?.race.toLowerCase()}`">
              {{ playerById(playerId)?.race }}
            </span>
            <span class="captain-name">{{ playerById(playerId)?.nickname }}</span>
            <div v-if="!draftLocked" class="captain-reorder">
              <button class="reorder-btn" :disabled="i === 0" @click="moveCaptain(i, -1)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 7l3-4 3 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="reorder-btn" :disabled="i === captains.length - 1" @click="moveCaptain(i, 1)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3l3 4 3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button v-if="!draftLocked" class="captain-remove" @click="removeCaptain(i)">×</button>
          </div>
          <div v-for="n in (captainCount - captains.length)" :key="`empty-${n}`" class="captain-row captain-row--empty">
            <span class="captain-order-badge empty">{{ captains.length + n }}</span>
            <span class="slot-empty">미선택</span>
          </div>
        </div>

        <div v-if="!draftLocked" class="captain-actions-row">
          <button v-if="captains.length < captainCount" class="btn-add-captain" @click="openPlayerPicker">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            팀장 추가
          </button>
          <button v-if="captains.length > 1" class="btn-tier-sort" @click="autoSortCaptains">
            티어 순 정렬
          </button>
        </div>

        <div v-if="!draftLocked" class="section-footer">
          <p v-if="captainError" class="save-error">{{ captainError }}</p>
          <button class="btn-save" :disabled="captainSaving || captains.length !== captainCount" @click="saveCaptainsData">
            {{ captainSaving ? '저장 중...' : `저장 후 다음 단계 (${captains.length}/${captainCount}명)` }}
          </button>
        </div>
      </section>

      <!-- ── 탭 3: 시드권자 ────────────────────────────── -->
      <section v-if="activeTab === 'seed_holders'" class="detail-section">
        <div class="captain-list">
          <div v-for="(playerId, i) in seedHolders" :key="playerId" class="captain-row">
            <span class="captain-order-badge">{{ i + 1 }}</span>
            <span class="captain-tier" :class="`tier--${playerById(playerId)?.tier.toLowerCase()}`">
              {{ playerById(playerId)?.tier }}
            </span>
            <span class="captain-race" :class="`race--${playerById(playerId)?.race.toLowerCase()}`">
              {{ playerById(playerId)?.race }}
            </span>
            <span class="captain-name">{{ playerById(playerId)?.nickname }}</span>
            <div v-if="!draftLocked" class="captain-reorder">
              <button class="reorder-btn" :disabled="i === 0" @click="moveSeedHolder(i, -1)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 7l3-4 3 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
              <button class="reorder-btn" :disabled="i === seedHolders.length - 1" @click="moveSeedHolder(i, 1)">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 3l3 4 3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </button>
            </div>
            <button v-if="!draftLocked" class="captain-remove" @click="removeSeedHolder(i)">×</button>
          </div>
          <div v-if="seedHolders.length === 0" class="captain-row captain-row--empty">
            <span class="slot-empty">시드권자를 추가하세요</span>
          </div>
        </div>

        <div v-if="!draftLocked" class="captain-actions-row">
          <button class="btn-add-captain" @click="openSeedPicker">
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M7 2V12M2 7H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            시드권자 추가
          </button>
        </div>

        <div v-if="!draftLocked" class="section-footer">
          <p v-if="seedError" class="save-error">{{ seedError }}</p>
          <button class="btn-save" :disabled="seedSaving" @click="saveSeedHoldersData">
            {{ seedSaving ? '저장 중...' : `저장 후 다음 단계 (${seedHolders.length}명)` }}
          </button>
        </div>
      </section>

      <!-- ── 탭 4: 경기별 맵 선택 ──────────────────────── -->
      <section v-if="activeTab === 'maps'" class="detail-section">
        <div class="section-header">
          <p class="section-desc">1·4·5·6경기는 맵 1개 고정, 2·3경기는 밴픽 풀 (2~3개) 입니다.<br />각 맵은 한 경기에만 사용할 수 있습니다.<br /></p>
        </div>

        <div class="match-list">
          <div v-for="match in matchConfigs" :key="match.number" class="match-row">
            <div class="match-info">
              <span class="match-num">{{ match.number }}경기</span>
              <span class="match-type" :class="match.isBanPick ? 'type-banpick' : 'type-fixed'">
                {{ match.isBanPick ? '밴픽 풀 (2~3개)' : '고정 맵 (1개)' }}
              </span>
              <span v-if="match.isTeamMatch" class="match-type type-team">팀전</span>
            </div>

            <div class="match-maps">
              <div v-if="matchMaps[match.number]?.length" class="selected-maps">
                <span v-for="mapId in matchMaps[match.number]" :key="mapId" class="map-chip">
                  <img v-if="mapById(mapId)?.thumbnail_url" :src="mapById(mapId)!.thumbnail_url!" class="map-chip-thumb" alt="" />
                  {{ mapById(mapId)?.name ?? mapId }}
                  <button v-if="!draftLocked" class="map-chip-remove" @click="removeMap(match.number, mapId)">×</button>
                </span>
              </div>
              <span v-else class="no-map">맵 미선택</span>
            </div>

            <button v-if="!draftLocked" class="btn-map-pick" @click="openMapPicker(match.number)">맵 선택</button>
          </div>
        </div>

        <!-- 7경기 안내 -->
        <div class="ace-notice">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M6.5 5.5v4M6.5 4h.01" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          7경기(에이스 결정전)는 위 경기에서 사용된 맵 중에서 별도로 선택합니다.
        </div>

        <div v-if="!draftLocked" class="section-footer">
          <p v-if="mapError" class="save-error">{{ mapError }}</p>
          <button class="btn-save" :disabled="mapSaving" @click="saveMapsData">
            {{ mapSaving ? '저장 중...' : '저장' }}
          </button>
        </div>
      </section>
    </div>

    <!-- ── 선수 선택 오버레이 ──────────────────────────── -->
    <Teleport to="body">
      <div v-if="showPlayerPicker" class="overlay-backdrop" @click.self="showPlayerPicker = false">
        <div class="picker-panel">
          <div class="picker-header">
            <span class="picker-title">
              팀장 선택
              <span class="picker-subtitle">{{ captains.length }}/{{ captainCount }}명</span>
            </span>
            <button class="picker-close" @click="showPlayerPicker = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <input v-model="playerSearch" class="picker-search" placeholder="닉네임 검색..." type="text" />
          <div class="picker-list">
            <button
              v-for="player in filteredPlayers"
              :key="player.id"
              class="picker-item"
              :class="{ selected: captains.includes(player.id) }"
              :disabled="captains.includes(player.id)"
              @click="assignCaptain(player.id)"
            >
              <span class="picker-tier" :class="`tier--${player.tier.toLowerCase()}`">{{ player.tier }}</span>
              <span class="picker-race" :class="`race--${player.race.toLowerCase()}`">{{ player.race }}</span>
              <span class="picker-name">{{ player.nickname }}</span>
              <svg v-if="captains.includes(player.id)" class="picker-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3.5 3.5 6-6" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div v-if="filteredPlayers.length === 0" class="picker-empty">검색 결과 없음</div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 시드권자 선택 오버레이 ───────────────────── -->
    <Teleport to="body">
      <div v-if="showSeedPicker" class="overlay-backdrop" @click.self="showSeedPicker = false">
        <div class="picker-panel">
          <div class="picker-header">
            <span class="picker-title">
              시드권자 선택
              <span class="picker-subtitle">{{ seedHolders.length }}명 선택됨</span>
            </span>
            <button class="picker-close" @click="showSeedPicker = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <input v-model="seedSearch" class="picker-search" placeholder="닉네임 검색..." type="text" />
          <div class="picker-list">
            <button
              v-for="player in filteredSeedPlayers"
              :key="player.id"
              class="picker-item"
              :class="{ selected: seedHolders.includes(player.id) }"
              @click="assignSeedHolder(player.id)"
            >
              <span class="picker-tier" :class="`tier--${player.tier.toLowerCase()}`">{{ player.tier }}</span>
              <span class="picker-race" :class="`race--${player.race.toLowerCase()}`">{{ player.race }}</span>
              <span class="picker-name">{{ player.nickname }}</span>
              <svg v-if="seedHolders.includes(player.id)" class="picker-check" width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3.5 3.5 6-6" stroke="#c084fc" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div v-if="filteredSeedPlayers.length === 0" class="picker-empty">검색 결과 없음</div>
          </div>
          <div class="picker-footer">
            <button class="picker-confirm" @click="showSeedPicker = false">확인</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 맵 선택 오버레이 ───────────────────────────── -->
    <Teleport to="body">
      <div v-if="mapPickerTarget !== null" class="overlay-backdrop" @click.self="mapPickerTarget = null">
        <div class="picker-panel">
          <div class="picker-header">
            <span class="picker-title">
              {{ mapPickerTarget }}경기 맵 선택
              <span class="picker-subtitle">
                {{ isBanPickMatch(mapPickerTarget) ? '2~3개 선택 (밴픽 풀)' : '1개 선택 (고정 맵)' }}
              </span>
            </span>
            <button class="picker-close" @click="mapPickerTarget = null">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <input v-model="mapSearch" class="picker-search" placeholder="맵 이름 또는 별칭 검색..." type="text" />
          <div class="picker-list">
            <button
              v-for="map in filteredMaps"
              :key="map.id"
              class="picker-item map-picker-item"
              :class="{
                selected: (matchMaps[mapPickerTarget!] ?? []).includes(map.id),
                'map-used': isMapUsedElsewhere(map.id, mapPickerTarget!),
              }"
              :disabled="isMapUsedElsewhere(map.id, mapPickerTarget!)"
              @click="toggleMap(mapPickerTarget!, map.id)"
            >
              <img v-if="map.thumbnail_url" :src="map.thumbnail_url" class="picker-map-thumb" alt="" />
              <div class="picker-map-info">
                <span class="picker-name">{{ map.name }}</span>
                <span class="picker-map-meta">{{ map.player_count }}인 · {{ map.tileset }}</span>
              </div>
              <span v-if="isMapUsedElsewhere(map.id, mapPickerTarget!)" class="map-used-label">
                {{ usedInMatch(map.id, mapPickerTarget!) }}경기 사용 중
              </span>
              <svg v-else-if="(matchMaps[mapPickerTarget!] ?? []).includes(map.id)" class="picker-check" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8l4 4 6-7" stroke="#c084fc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
            <div v-if="filteredMaps.length === 0" class="picker-empty">검색 결과 없음</div>
          </div>
          <div class="picker-footer">
            <span class="picker-footer-hint">
              {{ (matchMaps[mapPickerTarget!] ?? []).length }}
              / {{ isBanPickMatch(mapPickerTarget!) ? '3' : '1' }}개 선택됨
            </span>
            <button class="picker-confirm" @click="mapPickerTarget = null">선택 완료</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/core'
import AppHeader from '@/components/AppHeader.vue'
import { getLeague, updateLeagueDescription, checkAndUpdateReady, type LeagueRow } from '@/lib/leagues'
import { getPlayers, type PlayerRow } from '@/lib/players'
import { getMaps, type MapRow } from '@/lib/maps'
import { getCaptains, saveCaptains, getMatchMaps, saveMatchMaps, getSeedHolders, saveSeedHolders } from '@/lib/leagueDetail'

// ── FontSize 커스텀 익스텐션 ─────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions: () => ({ types: ['textStyle'] }),
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el: HTMLElement) => el.style.fontSize || null,
          renderHTML: (attrs: Record<string, any>) =>
            attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

// ── 토스트 ────────────────────────────────────────────────
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null

function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 2500)
}

// ── 탭 ───────────────────────────────────────────────────
type TabKey = 'description' | 'captains' | 'seed_holders' | 'maps'

const tabs: { key: TabKey; label: string }[] = [
  { key: 'description',  label: '리그 설명' },
  { key: 'captains',     label: '팀장 선출' },
  { key: 'seed_holders', label: '시드권자' },
  { key: 'maps',         label: '경기별 맵 선택' },
]

const activeTab = ref<TabKey>('description')

// 탭 완료 여부: 실제 데이터 기준
function isTabDone(key: TabKey): boolean {
  if (key === 'description') return !!league.value?.description?.trim()
  if (key === 'captains') return captains.value.length === captainCount.value
  if (key === 'seed_holders') return seedHolders.value.length > 0
  if (key === 'maps') return matchConfigs.every((m) => (matchMaps.value[m.number]?.length ?? 0) > 0)
  return false
}

function goNext() {
  const idx = tabs.findIndex((t) => t.key === activeTab.value)
  if (idx < tabs.length - 1) activeTab.value = tabs[idx + 1].key
}

// ── 페이지 데이터 로딩 ────────────────────────────────────
const route = useRoute()
const router = useRouter()
const leagueId = route.params.id as string

const pageLoading = ref(true)
const pageError = ref<string | null>(null)

const league = ref<LeagueRow | null>(null)
const players = ref<PlayerRow[]>([])
const maps = ref<MapRow[]>([])

const captains = ref<number[]>([])
const seedHolders = ref<number[]>([])
const matchMaps = ref<Record<number, string[]>>({})

const captainCount = computed(() => league.value?.captain_count ?? 4)
const draftLocked = computed(() => league.value?.draft_completed === true)

onMounted(async () => {
  try {
    const [leagueData, playersData, mapsData, captainsData, matchMapsData, seedHoldersData] = await Promise.all([
      getLeague(leagueId),
      getPlayers(),
      getMaps(),
      getCaptains(leagueId),
      getMatchMaps(leagueId),
      getSeedHolders(leagueId),
    ])

    league.value = leagueData
    players.value = playersData
    maps.value = mapsData

    captains.value = captainsData
      .sort((a, b) => a.order_num - b.order_num)
      .map((c) => c.player_id)

    seedHolders.value = seedHoldersData
      .sort((a, b) => a.order_num - b.order_num)
      .map((h) => h.player_id)

    const mm: Record<number, string[]> = {}
    for (const m of matchMapsData) mm[m.match_number] = m.map_ids
    matchMaps.value = mm

    editor.value?.commands.setContent(leagueData.description ?? '')
    if (leagueData.draft_completed) editor.value?.setEditable(false)
  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    pageLoading.value = false
  }
})

// ── 헬퍼 ─────────────────────────────────────────────────
function playerById(id: number) {
  return players.value.find((p) => p.id === id) ?? null
}

function mapById(id: string) {
  return maps.value.find((m) => m.id === id) ?? null
}

// 1~6경기만 (7경기 에이스는 별도 선택 불필요)
const matchConfigs = [1, 2, 3, 4, 5, 6].map((n) => ({
  number: n,
  isBanPick: n === 2 || n === 3,
  isTeamMatch: n === 4,
}))

function isBanPickMatch(n: number) { return n === 2 || n === 3 }

// ── 에디터 ────────────────────────────────────────────────
const editor = useEditor({
  content: '',
  extensions: [
    StarterKit,
    TextStyle,
    Color,
    FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  editorProps: { attributes: { class: 'tiptap-editor' } },
})

const formatButtons = computed(() => [
  { label: 'B',        isActive: () => editor.value?.isActive('bold') ?? false,      action: () => editor.value?.chain().focus().toggleBold().run() },
  { label: 'I',        isActive: () => editor.value?.isActive('italic') ?? false,    action: () => editor.value?.chain().focus().toggleItalic().run() },
  { label: '</> 코드', isActive: () => editor.value?.isActive('code') ?? false,      action: () => editor.value?.chain().focus().toggleCode().run() },
  { label: '코드블록', isActive: () => editor.value?.isActive('codeBlock') ?? false, action: () => editor.value?.chain().focus().toggleCodeBlock().run() },
])

const alignButtons = computed(() => [
  {
    align: 'left', title: '왼쪽 정렬',
    icon: 'M1 2.5h11M1 5.5h7M1 8.5h11M1 11.5h7',
    isActive: () => editor.value?.isActive({ textAlign: 'left' }) ?? false,
    action: () => editor.value?.chain().focus().setTextAlign('left').run(),
  },
  {
    align: 'center', title: '가운데 정렬',
    icon: 'M1 2.5h11M3 5.5h7M1 8.5h11M3 11.5h7',
    isActive: () => editor.value?.isActive({ textAlign: 'center' }) ?? false,
    action: () => editor.value?.chain().focus().setTextAlign('center').run(),
  },
  {
    align: 'right', title: '오른쪽 정렬',
    icon: 'M1 2.5h11M5 5.5h7M1 8.5h11M5 11.5h7',
    isActive: () => editor.value?.isActive({ textAlign: 'right' }) ?? false,
    action: () => editor.value?.chain().focus().setTextAlign('right').run(),
  },
])

const fontSizes = [
  { label: '소', value: '12px' },
  { label: '중', value: '14px' },
  { label: '대', value: '18px' },
  { label: '특대', value: '24px' },
]

const colorPresets = [
  { label: '흰색', value: '#ffffff' },
  { label: '빨강', value: '#f87171' },
  { label: '주황', value: '#fb923c' },
  { label: '노랑', value: '#facc15' },
  { label: '초록', value: '#4ade80' },
  { label: '민트', value: '#34d399' },
  { label: '하늘', value: '#38bdf8' },
  { label: '파랑', value: '#60a5fa' },
  { label: '보라', value: '#c084fc' },
  { label: '분홍', value: '#f472b6' },
]

const activeColor = computed(() => editor.value?.getAttributes('textStyle').color ?? null)
const activeSize = computed(() => editor.value?.getAttributes('textStyle').fontSize ?? null)

function applyColor(color: string) { editor.value?.chain().focus().setColor(color).run() }
function applySize(size: string) {
  if (activeSize.value === size) {
    ;(editor.value?.chain().focus() as any).unsetFontSize().run()
  } else {
    ;(editor.value?.chain().focus() as any).setFontSize(size).run()
  }
}

const descSaving = ref(false)
const descError = ref<string | null>(null)

async function saveDescription() {
  if (!editor.value) return
  descSaving.value = true
  descError.value = null
  try {
    const html = editor.value.getHTML()
    await updateLeagueDescription(leagueId, html)
    if (league.value) league.value.description = html
    await checkAndUpdateReady(leagueId)
    showToast('리그 설명이 저장되었습니다.')
    goNext()
  } catch (e: any) {
    descError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    descSaving.value = false
  }
}

onBeforeUnmount(() => {
  editor.value?.destroy()
  if (toastTimer) clearTimeout(toastTimer)
})

// ── 팀장 선출 ─────────────────────────────────────────────
// 티어 순위: 낮은 티어(E)가 앞 순번
const TIER_RANK: Record<string, number> = { E: 1, D: 2, C: 3, B: 4, A: 5 }

function autoSortCaptains() {
  captains.value = [...captains.value].sort((a, b) => {
    const ta = playerById(a)?.tier ?? 'A'
    const tb = playerById(b)?.tier ?? 'A'
    return (TIER_RANK[ta] ?? 0) - (TIER_RANK[tb] ?? 0)
  })
}

function moveCaptain(index: number, direction: -1 | 1) {
  const newIdx = index + direction
  if (newIdx < 0 || newIdx >= captains.value.length) return
  const arr = [...captains.value]
  ;[arr[index], arr[newIdx]] = [arr[newIdx], arr[index]]
  captains.value = arr
}

function removeCaptain(index: number) {
  captains.value = captains.value.filter((_, i) => i !== index)
}

const showPlayerPicker = ref(false)
const playerSearch = ref('')

function sortPlayers(list: PlayerRow[]) {
  return [...list].sort((a, b) => {
    const tierDiff = (TIER_RANK[a.tier] ?? 0) - (TIER_RANK[b.tier] ?? 0)
    if (tierDiff !== 0) return tierDiff
    const raceDiff = a.race.localeCompare(b.race)
    if (raceDiff !== 0) return raceDiff
    return a.nickname.localeCompare(b.nickname)
  })
}

const filteredPlayers = computed(() => {
  const q = playerSearch.value.trim().toLowerCase()
  const list = players.value.filter((p) => !q || p.nickname.toLowerCase().includes(q))
  return sortPlayers(list)
})

function openPlayerPicker() {
  playerSearch.value = ''
  showPlayerPicker.value = true
}

function assignCaptain(playerId: number) {
  if (captains.value.includes(playerId) || captains.value.length >= captainCount.value) return
  captains.value = [...captains.value, playerId]
  autoSortCaptains()
  if (captains.value.length === captainCount.value) showPlayerPicker.value = false
}

const captainSaving = ref(false)
const captainError = ref<string | null>(null)

async function saveCaptainsData() {
  captainSaving.value = true
  captainError.value = null
  try {
    const payload = captains.value.map((pid, i) => ({ player_id: pid, order_num: i + 1 }))
    await saveCaptains(leagueId, payload)
    await checkAndUpdateReady(leagueId)
    showToast('팀장 정보가 저장되었습니다.')
    goNext()
  } catch (e: any) {
    captainError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    captainSaving.value = false
  }
}

// ── 경기별 맵 선택 ────────────────────────────────────────
const mapPickerTarget = ref<number | null>(null)
const mapSearch = ref('')

const filteredMaps = computed(() => {
  const q = mapSearch.value.trim().toLowerCase()
  if (!q) return maps.value
  return maps.value.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      m.aliases.some((a) => a.toLowerCase().includes(q)),
  )
})

function isMapUsedElsewhere(mapId: string, currentMatch: number): boolean {
  return Object.entries(matchMaps.value).some(
    ([n, ids]) => Number(n) !== currentMatch && ids.includes(mapId),
  )
}

function usedInMatch(mapId: string, currentMatch: number): number {
  const entry = Object.entries(matchMaps.value).find(
    ([n, ids]) => Number(n) !== currentMatch && ids.includes(mapId),
  )
  return entry ? Number(entry[0]) : 0
}

function openMapPicker(matchNumber: number) {
  mapSearch.value = ''
  mapPickerTarget.value = matchNumber
}

function toggleMap(matchNumber: number, mapId: string) {
  if (isMapUsedElsewhere(mapId, matchNumber)) return
  const current = matchMaps.value[matchNumber] ?? []
  const maxCount = isBanPickMatch(matchNumber) ? 3 : 1

  if (current.includes(mapId)) {
    matchMaps.value[matchNumber] = current.filter((id) => id !== mapId)
  } else if (current.length < maxCount) {
    matchMaps.value[matchNumber] = [...current, mapId]
  }
}

function removeMap(matchNumber: number, mapId: string) {
  matchMaps.value[matchNumber] = (matchMaps.value[matchNumber] ?? []).filter((id) => id !== mapId)
}

// ── 시드권자 ──────────────────────────────────────────────
const showSeedPicker = ref(false)
const seedSearch = ref('')
const seedSaving = ref(false)
const seedError = ref<string | null>(null)

const filteredSeedPlayers = computed(() => {
  const q = seedSearch.value.trim().toLowerCase()
  const list = players.value.filter((p) => !q || p.nickname.toLowerCase().includes(q))
  return sortPlayers(list)
})

function openSeedPicker() {
  seedSearch.value = ''
  showSeedPicker.value = true
}

function assignSeedHolder(playerId: number) {
  if (seedHolders.value.includes(playerId)) {
    seedHolders.value = seedHolders.value.filter((id) => id !== playerId)
  } else {
    seedHolders.value = [...seedHolders.value, playerId]
  }
}

function removeSeedHolder(index: number) {
  seedHolders.value = seedHolders.value.filter((_, i) => i !== index)
}

function moveSeedHolder(index: number, direction: -1 | 1) {
  const newIdx = index + direction
  if (newIdx < 0 || newIdx >= seedHolders.value.length) return
  const arr = [...seedHolders.value]
  ;[arr[index], arr[newIdx]] = [arr[newIdx], arr[index]]
  seedHolders.value = arr
}

async function saveSeedHoldersData() {
  seedSaving.value = true
  seedError.value = null
  try {
    const payload = seedHolders.value.map((pid, i) => ({ player_id: pid, order_num: i + 1 }))
    await saveSeedHolders(leagueId, payload)
    showToast('시드권자 정보가 저장되었습니다.')
    goNext()
  } catch (e: any) {
    seedError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    seedSaving.value = false
  }
}

const mapSaving = ref(false)
const mapError = ref<string | null>(null)

async function saveMapsData() {
  mapError.value = null
  for (const n of [2, 3]) {
    if ((matchMaps.value[n]?.length ?? 0) < 2) {
      mapError.value = `${n}경기는 밴픽 풀 맵을 최소 2개 선택해야 합니다.`
      return
    }
  }
  mapSaving.value = true
  try {
    const entries = Object.entries(matchMaps.value)
      .filter(([, ids]) => ids.length > 0)
      .map(([n, ids]) => ({ match_number: Number(n), map_ids: ids }))
    await saveMatchMaps(leagueId, entries)
    await checkAndUpdateReady(leagueId)

    // 이전 탭 중 미완료 탭이 있으면 해당 탭으로 이동
    const incompleteTabs: TabKey[] = ['description', 'captains', 'seed_holders']
    const firstIncomplete = incompleteTabs.find((k) => !isTabDone(k))
    if (firstIncomplete) {
      showToast('저장되었습니다. 미완료 항목을 확인해주세요.')
      activeTab.value = firstIncomplete
    } else {
      showToast('모든 항목이 저장되었습니다.')
      await new Promise((r) => setTimeout(r, 800))
      router.push({ name: 'leagues' })
    }
  } catch (e: any) {
    mapError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    mapSaving.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './LeagueDetailView.scss';
</style>
