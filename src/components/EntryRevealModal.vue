<template>
  <Teleport to="body">
    <div class="reveal-overlay" @click.self="$emit('close')">
      <div class="reveal-modal">
        <div class="reveal-header">
          <div>
            <p class="reveal-title">엔트리 확인</p>
            <p class="reveal-subtitle">
              {{ round }}라운드
              <template v-if="matchDate"> · {{ matchDate.replaceAll('-', '/') }}</template>
            </p>
          </div>
          <button class="reveal-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="reveal-body">
          <div v-if="loading" class="reveal-state">불러오는 중...</div>
          <div v-else-if="loadError" class="reveal-state reveal-state--error">{{ loadError }}</div>

          <template v-else>
            <!-- 팀 헤더 -->
            <div class="reveal-teams-header">
              <div class="reveal-th">{{ teamAName }}</div>
              <div class="reveal-th-center" />
              <div class="reveal-th reveal-th--right">{{ teamBName }}</div>
            </div>

            <!-- 슬롯별 행 -->
            <div v-for="slot in SLOT_CONFIG" :key="slot.num" class="reveal-slot" :class="{ 'reveal-slot--team': slot.type === 'team' }">
              <!-- 슬롯 라벨 -->
              <div class="reveal-slot-label">
                <span class="rsl-num">경기{{ slot.num }}</span>
                <span class="rsl-type" :class="slot.type === 'team' ? 'rsl-type--team' : 'rsl-type--ind'">
                  {{ slot.type === 'team' ? '팀전' : '개인전' }}
                </span>
              </div>

              <!-- 3컬럼: 팀A | 맵 | 팀B -->
              <div class="reveal-row">
                <!-- 팀A 선수 -->
                <div class="rse-col">
                  <div
                    v-for="pid in getSlotPlayerIds(teamACaptainId, slot.num)"
                    :key="pid"
                    class="rse-player"
                  >
                    <span class="rse-name">{{ playerName(pid) }}</span>
                    <span class="rse-tier" :class="`tier--${playerTier(pid).toLowerCase()}`">{{ playerTier(pid) }}</span>
                    <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                  </div>
                  <div v-if="slot.type === 'team' && getSlotPlayerIds(teamACaptainId, slot.num).length" class="rse-total">
                    합계 {{ slotTotal(teamACaptainId, slot.num) }}pt
                  </div>
                </div>

                <!-- 맵 정보 (센터) -->
                <div class="rse-maps">
                  <template v-if="slotMapRows[slot.num]?.length">
                    <div
                      v-for="m in slotMapRows[slot.num]"
                      :key="m.id"
                      class="rse-map-item"
                      :class="{
                        'rse-map--banned': getBan(teamACaptainId, slot.num) === m.id || getBan(teamBCaptainId, slot.num) === m.id,
                      }"
                    >
                      <div class="rse-map-thumb-wrap">
                        <img v-if="m.thumbnail_url" :src="m.thumbnail_url" class="rse-map-thumb" />
                        <div v-else class="rse-map-thumb-empty" />
                      </div>
                      <span class="rse-map-name">{{ m.name }}</span>
                      <div class="rse-ban-chips">
                        <span v-if="getBan(teamACaptainId, slot.num) === m.id" class="ban-chip ban-chip--a">A밴</span>
                        <span v-if="getBan(teamBCaptainId, slot.num) === m.id" class="ban-chip ban-chip--b">B밴</span>
                      </div>
                    </div>
                  </template>
                  <div v-else class="rse-map-empty" />
                </div>

                <!-- 팀B 선수 -->
                <div class="rse-col rse-col--right">
                  <div
                    v-for="pid in getSlotPlayerIds(teamBCaptainId, slot.num)"
                    :key="pid"
                    class="rse-player rse-player--right"
                  >
                    <span class="rse-pt">{{ playerPt(pid) }}pt</span>
                    <span class="rse-tier" :class="`tier--${playerTier(pid).toLowerCase()}`">{{ playerTier(pid) }}</span>
                    <span class="rse-name">{{ playerName(pid) }}</span>
                  </div>
                  <div v-if="slot.type === 'team' && getSlotPlayerIds(teamBCaptainId, slot.num).length" class="rse-total rse-total--right">
                    합계 {{ slotTotal(teamBCaptainId, slot.num) }}pt
                  </div>
                </div>
              </div>
            </div>

            <!-- 합계 -->
            <div class="reveal-totals">
              <div class="reveal-total-item">
                <span class="reveal-total-name">{{ teamAName }}</span>
                <span class="reveal-total-pt">{{ totalPoints(teamACaptainId) }}pt</span>
              </div>
              <div class="reveal-total-sep" />
              <div class="reveal-total-item reveal-total-item--right">
                <span class="reveal-total-pt">{{ totalPoints(teamBCaptainId) }}pt</span>
                <span class="reveal-total-name">{{ teamBName }}</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getScheduleEntries, TIER_POINTS, type EntryRecord } from '@/lib/entries'
import { getMatchMaps } from '@/lib/leagueDetail'
import { getMaps } from '@/lib/maps'
import { getPlayers, type PlayerRow } from '@/lib/players'
import { withTimeout } from '@/lib/supabase'

const props = defineProps<{
  scheduleId: number
  round: number
  matchDate: string | null
  leagueId: string
  teamACaptainId: number
  teamBCaptainId: number
  teamAName: string
  teamBName: string
}>()

defineEmits<{ close: [] }>()

const SLOT_CONFIG = [
  { num: 1, type: 'individual' },
  { num: 2, type: 'individual' },
  { num: 3, type: 'individual' },
  { num: 4, type: 'team' },
  { num: 5, type: 'individual' },
  { num: 6, type: 'individual' },
] as const

const loading = ref(true)
const loadError = ref<string | null>(null)

interface MapInfo { id: string; name: string; thumbnail_url: string | null }

const entriesMap = ref(new Map<number, Map<number, EntryRecord>>())
const playerMap = ref(new Map<number, PlayerRow>())
const slotMapRows = ref<Record<number, MapInfo[]>>({})

onMounted(async () => {
  try {
    const [entries, players, matchMaps, allMaps] = await withTimeout(Promise.all([
      getScheduleEntries(props.scheduleId),
      getPlayers(),
      getMatchMaps(props.leagueId),
      getMaps(),
    ]))

    playerMap.value = new Map(players.map(p => [p.id, p]))

    const mapInfoMap = new Map(allMaps.map(m => [m.id, m]))
    const smr: Record<number, MapInfo[]> = {}
    for (const mm of matchMaps) {
      smr[mm.match_number] = mm.map_ids.map(id => {
        const m = mapInfoMap.get(id)
        return { id, name: m?.name ?? id, thumbnail_url: m?.thumbnail_url ?? null }
      })
    }
    slotMapRows.value = smr

    const em = new Map<number, Map<number, EntryRecord>>()
    for (const e of entries) {
      if (!em.has(e.captain_player_id)) em.set(e.captain_player_id, new Map())
      em.get(e.captain_player_id)!.set(e.match_slot, e)
    }
    entriesMap.value = em
  } catch (e: any) {
    loadError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

function getEntry(captainId: number, slotNum: number): EntryRecord | undefined {
  return entriesMap.value.get(captainId)?.get(slotNum)
}

function getSlotPlayerIds(captainId: number, slotNum: number): number[] {
  return getEntry(captainId, slotNum)?.player_ids ?? []
}

function getBan(captainId: number, slotNum: number): string | null {
  return getEntry(captainId, slotNum)?.banned_map_id ?? null
}

function playerName(id: number): string {
  return playerMap.value.get(id)?.nickname ?? `선수 ${id}`
}

function playerTier(id: number): string {
  return playerMap.value.get(id)?.tier ?? '?'
}

function playerPt(id: number): number {
  return TIER_POINTS[playerTier(id)] ?? 0
}

function slotTotal(captainId: number, slotNum: number): number {
  return getSlotPlayerIds(captainId, slotNum).reduce((sum, id) => sum + playerPt(id), 0)
}

function totalPoints(captainId: number): number {
  return [...(entriesMap.value.get(captainId)?.values() ?? [])].reduce(
    (sum, e) => sum + e.player_ids.reduce((s, id) => s + playerPt(id), 0),
    0,
  )
}
</script>

<style lang="scss" scoped>
@use './EntryRevealModal.scss';
</style>
