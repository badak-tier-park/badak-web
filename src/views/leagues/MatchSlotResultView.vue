<template>
  <div class="slot-result-page">
    <AppHeader />

    <div class="slot-result-content">
      <button class="btn-back" @click="$router.push({ name: 'league-schedule', params: { id: leagueId } })">
        <AppIcon name="chevron-left" :size="13" />
        경기 관리
      </button>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="pageError" class="state-msg state-msg--error">{{ pageError }}</div>

      <template v-else>
        <!-- 헤더 -->
        <div class="match-info">
          <div class="match-info-title">경기 결과 입력</div>
          <div class="match-info-teams">
            <div class="match-team-col">
              <span class="match-team-badge" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                {{ teamA?.teamName || teamA?.nickname }}
              </span>
              <span v-if="entryPointsA > 0" class="match-team-pts">{{ entryPointsA }}pt</span>
            </div>
            <div class="match-score-col">
              <span class="match-score">{{ scoreA }} : {{ scoreB }}</span>
              <div v-if="schedule?.match_date" class="match-info-date">
                {{ schedule.match_date.replaceAll('-', '/') }}
              </div>
            </div>
            <div class="match-team-col match-team-col--right">
              <span class="match-team-badge" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                {{ teamB?.teamName || teamB?.nickname }}
              </span>
              <span v-if="entryPointsB > 0" class="match-team-pts">{{ entryPointsB }}pt</span>
            </div>
          </div>
        </div>

        <!-- 슬롯별 결과 -->
        <div class="slot-list">
          <div
            v-for="slot in REGULAR_SLOTS"
            :key="slot.num"
            class="slot-row"
            :class="{ 'slot-row--done': slotWinners.get(slot.num) != null }"
          >
            <div class="slot-label">
              <span class="slot-num">경기{{ slot.num }}</span>
              <span class="slot-type" :class="slot.type === 'team' ? 'slot-type--team' : ''">
                {{ slot.type === 'team' ? '팀전' : '개인전' }}
              </span>
            </div>

            <div class="slot-teams">
              <!-- 팀A 변경 버튼 컬럼 (맨 왼쪽 벽) -->
              <div v-if="!isCompleted && slotPlayerMap.get(slot.num)?.teamA?.length" class="sub-col">
                <button
                  v-for="(_, idx) in slotPlayerMap.get(slot.num)!.teamA"
                  :key="idx"
                  class="btn-sub"
                  :class="{ 'btn-sub--reset': isSubstituted(slot.num, true, idx) }"
                  @click.stop="isSubstituted(slot.num, true, idx) ? resetSub(slot.num, true, idx) : openSubModal(slot.num, true, idx)"
                ><template v-if="isSubstituted(slot.num, true, idx)"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 6A4 4 0 1 1 6 2a4 4 0 0 1 3.5 2.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 2v2.5H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></template><template v-else>변경</template></button>
              </div>

              <button
                class="slot-team-btn"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(slot.num) === schedule!.team_a_captain_id,
                  'slot-team-btn--loser': slotWinners.get(slot.num) != null && slotWinners.get(slot.num) !== schedule!.team_a_captain_id,
                  'slot-team-btn--saving': savingSlot === slot.num,
                }"
                :disabled="savingSlot === slot.num || isCompleted"
                @click="toggleWinner(slot.num, schedule!.team_a_captain_id)"
              >
                <div class="slot-players">
                  <template v-if="slotPlayerMap.get(slot.num)?.teamA?.length">
                    <div v-for="(p, idx) in getActivePlayers(slot.num, true)" :key="p.id" class="slot-player-row">
                      <span v-if="p.race" class="slot-race" :class="`race-badge--${p.race.toLowerCase()}`">{{ p.race.toUpperCase() }}</span>
                      <span class="slot-player-name" :class="`tier-badge--${p.tier.toLowerCase()}`">{{ p.nickname }}</span>
                      <span v-if="isSubstituted(slot.num, true, idx)" class="sub-badge">대체</span>
                    </div>
                  </template>
                  <span v-else class="slot-team-name" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                    {{ teamA?.teamName || teamA?.nickname }}
                  </span>
                </div>
                <span v-if="slotWinners.get(slot.num) === schedule!.team_a_captain_id" class="win-badge">WIN</span>
              </button>

              <!-- 중앙: 맵 정보 -->
              <div class="slot-center">
                <template v-if="slotMapStates.get(slot.num)?.type !== 'none'">
                  <div v-if="getResolvedMap(slot.num)" class="slot-map">
                    <div class="slot-map-thumb">
                      <img v-if="getResolvedMap(slot.num)?.thumbnail_url" :src="getResolvedMap(slot.num)!.thumbnail_url!" />
                      <div v-else class="slot-map-thumb-empty" />
                    </div>
                    <span class="slot-map-name">{{ getResolvedMap(slot.num)?.name }}</span>
                  </div>
                  <button
                    v-else-if="BAN_SLOTS.has(slot.num) && !isCompleted"
                    class="slot-ladder-btn"
                    @click="openLadder(slot.num)"
                  >사다리타기</button>
                </template>
              </div>

              <button
                class="slot-team-btn slot-team-btn--right"
                :class="{
                  'slot-team-btn--winner': slotWinners.get(slot.num) === schedule!.team_b_captain_id,
                  'slot-team-btn--loser': slotWinners.get(slot.num) != null && slotWinners.get(slot.num) !== schedule!.team_b_captain_id,
                  'slot-team-btn--saving': savingSlot === slot.num,
                }"
                :disabled="savingSlot === slot.num || isCompleted"
                @click="toggleWinner(slot.num, schedule!.team_b_captain_id)"
              >
                <span v-if="slotWinners.get(slot.num) === schedule!.team_b_captain_id" class="win-badge">WIN</span>
                <div class="slot-players">
                  <template v-if="slotPlayerMap.get(slot.num)?.teamB?.length">
                    <div v-for="(p, idx) in getActivePlayers(slot.num, false)" :key="p.id" class="slot-player-row slot-player-row--right">
                      <span v-if="isSubstituted(slot.num, false, idx)" class="sub-badge">대체</span>
                      <span class="slot-player-name" :class="`tier-badge--${p.tier.toLowerCase()}`">{{ p.nickname }}</span>
                      <span v-if="p.race" class="slot-race" :class="`race-badge--${p.race.toLowerCase()}`">{{ p.race.toUpperCase() }}</span>
                    </div>
                  </template>
                  <span v-else class="slot-team-name" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                    {{ teamB?.teamName || teamB?.nickname }}
                  </span>
                </div>
              </button>

              <!-- 팀B 변경 버튼 컬럼 (맨 오른쪽 벽) -->
              <div v-if="!isCompleted && slotPlayerMap.get(slot.num)?.teamB?.length" class="sub-col sub-col--right">
                <button
                  v-for="(_, idx) in slotPlayerMap.get(slot.num)!.teamB"
                  :key="idx"
                  class="btn-sub"
                  :class="{ 'btn-sub--reset': isSubstituted(slot.num, false, idx) }"
                  @click.stop="isSubstituted(slot.num, false, idx) ? resetSub(slot.num, false, idx) : openSubModal(slot.num, false, idx)"
                ><template v-if="isSubstituted(slot.num, false, idx)"><svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 6A4 4 0 1 1 6 2a4 4 0 0 1 3.5 2.06" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 2v2.5H7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></template><template v-else>변경</template></button>
              </div>
            </div>
          </div>

          <!-- 에이스 결정전 -->
          <div v-if="showAce" class="ace-card">
            <div class="ace-card-title">에이스 결정전</div>

            <!-- 1단계: 티어 밴 결과 표시 + 사다리 -->
            <div class="ace-section">
              <div class="ace-section-label">① 티어 밴</div>
              <div class="ace-tier-row">
                <div class="ace-tier-ban-col">
                  <span class="ace-ban-team">{{ teamA?.teamName || teamA?.nickname }}</span>
                  <div class="ace-tier-btns">
                    <span
                      v-for="tier in ALL_TIERS"
                      :key="'a' + tier"
                      class="ace-tier-chip"
                      :class="{ 'ace-tier-chip--banned': aceTierBanA === tier }"
                    >{{ tier }}</span>
                  </div>
                </div>

                <!-- 중앙: 사다리 버튼 또는 확정 티어 -->
                <div class="ace-tier-center">
                  <template v-if="aceData.aceTier">
                    <span class="ace-confirmed-tier" :class="`tier-badge--${aceData.aceTier.toLowerCase()}`">
                      {{ aceData.aceTier }} 티어
                    </span>
                    <button v-if="!isCompleted" class="ace-reset-btn" @click="resetAceTier">초기화</button>
                  </template>
                  <button
                    v-else
                    class="slot-ladder-btn"
                    :disabled="aceTierCandidates.length === 0 || isCompleted"
                    @click="openTierLadder"
                  >
                    티어 사다리타기
                  </button>
                </div>

                <div class="ace-tier-ban-col ace-tier-ban-col--right">
                  <span class="ace-ban-team">{{ teamB?.teamName || teamB?.nickname }}</span>
                  <div class="ace-tier-btns">
                    <span
                      v-for="tier in ALL_TIERS"
                      :key="'b' + tier"
                      class="ace-tier-chip"
                      :class="{ 'ace-tier-chip--banned': aceTierBanB === tier }"
                    >{{ tier }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2단계: 맵 사다리 -->
            <div class="ace-section" :class="{ 'ace-section--locked': !aceData.aceTier }">
              <div class="ace-section-label">② 맵 선택</div>
              <template v-if="aceData.aceTier">
                <div v-if="getResolvedMap(7)" class="slot-map ace-map">
                  <div class="slot-map-thumb">
                    <img v-if="getResolvedMap(7)?.thumbnail_url" :src="getResolvedMap(7)!.thumbnail_url!" />
                    <div v-else class="slot-map-thumb-empty" />
                  </div>
                  <span class="slot-map-name">{{ getResolvedMap(7)?.name }}</span>
                </div>
                <button
                  v-else-if="!isCompleted"
                  class="slot-ladder-btn"
                  :disabled="aceMapCandidates.length === 0"
                  @click="openLadder(7)"
                >
                  맵 사다리타기
                </button>
              </template>
              <span v-else class="ace-locked-hint">티어 확정 후 진행</span>
            </div>

            <!-- 3단계: 선수 선택 + 승패 -->
            <div class="ace-section" :class="{ 'ace-section--locked': !aceData.aceTier }">
              <div class="ace-section-label">③ 선수 선택 및 결과</div>
              <template v-if="aceData.aceTier">
                <div class="ace-result-row">
                  <div class="ace-player-col">
                    <PlayerSelect
                      v-if="!isCompleted"
                      :model-value="aceData.playerAId ?? 0"
                      :options="eligibleOptionsA"
                      @update:model-value="setAcePlayer('A', $event)"
                    />
                    <button
                      class="slot-team-btn ace-winner-btn"
                      :class="{
                        'slot-team-btn--winner': slotWinners.get(ACE_SLOT.num) === schedule!.team_a_captain_id,
                        'slot-team-btn--loser': slotWinners.get(ACE_SLOT.num) != null && slotWinners.get(ACE_SLOT.num) !== schedule!.team_a_captain_id,
                        'slot-team-btn--saving': savingSlot === ACE_SLOT.num,
                      }"
                      :disabled="savingSlot === ACE_SLOT.num || isCompleted || !aceData.playerAId"
                      @click="toggleWinner(ACE_SLOT.num, schedule!.team_a_captain_id)"
                    >
                      <div class="slot-players">
                        <div v-if="acePlayerA" class="slot-player-row">
                          <span v-if="acePlayerA.race" class="slot-race" :class="`race-badge--${acePlayerA.race.toLowerCase()}`">{{ acePlayerA.race }}</span>
                          <span class="slot-player-name" :class="`tier-badge--${acePlayerA.tier!.toLowerCase()}`">{{ acePlayerA.label }}</span>
                        </div>
                        <span v-else class="slot-team-name" :class="`tier-badge--${teamA?.tier.toLowerCase()}`">
                          {{ teamA?.teamName || teamA?.nickname }}
                        </span>
                      </div>
                      <span v-if="slotWinners.get(ACE_SLOT.num) === schedule!.team_a_captain_id" class="win-badge">WIN</span>
                    </button>
                  </div>
                  <span class="ace-vs">VS</span>
                  <div class="ace-player-col ace-player-col--right">
                    <PlayerSelect
                      v-if="!isCompleted"
                      :model-value="aceData.playerBId ?? 0"
                      :options="eligibleOptionsB"
                      @update:model-value="setAcePlayer('B', $event)"
                    />
                    <button
                      class="slot-team-btn slot-team-btn--right ace-winner-btn"
                      :class="{
                        'slot-team-btn--winner': slotWinners.get(ACE_SLOT.num) === schedule!.team_b_captain_id,
                        'slot-team-btn--loser': slotWinners.get(ACE_SLOT.num) != null && slotWinners.get(ACE_SLOT.num) !== schedule!.team_b_captain_id,
                        'slot-team-btn--saving': savingSlot === ACE_SLOT.num,
                      }"
                      :disabled="savingSlot === ACE_SLOT.num || isCompleted || !aceData.playerBId"
                      @click="toggleWinner(ACE_SLOT.num, schedule!.team_b_captain_id)"
                    >
                      <span v-if="slotWinners.get(ACE_SLOT.num) === schedule!.team_b_captain_id" class="win-badge">WIN</span>
                      <div class="slot-players">
                        <div v-if="acePlayerB" class="slot-player-row slot-player-row--right">
                          <span class="slot-player-name" :class="`tier-badge--${acePlayerB.tier!.toLowerCase()}`">{{ acePlayerB.label }}</span>
                          <span v-if="acePlayerB.race" class="slot-race" :class="`race-badge--${acePlayerB.race.toLowerCase()}`">{{ acePlayerB.race }}</span>
                        </div>
                        <span v-else class="slot-team-name" :class="`tier-badge--${teamB?.tier.toLowerCase()}`">
                          {{ teamB?.teamName || teamB?.nickname }}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </template>
              <span v-else class="ace-locked-hint">티어 확정 후 진행</span>
            </div>
          </div>
        </div>

        <div class="match-result-footer">
          <p v-if="completeError" class="complete-error">{{ completeError }}</p>
          <span v-if="isCompleted" class="badge-completed">
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            경기 종료
          </span>
          <button
            v-else
            class="btn-complete"
            :disabled="completing || savingSlot != null"
            @click="handleComplete"
          >
            {{ completing ? '저장 중...' : '저장' }}
          </button>
        </div>
      </template>
    </div>

    <!-- 맵 사다리타기 모달 -->
    <Teleport to="body">
      <div v-if="ladderSlot != null" class="ladder-overlay" @click.self="ladderSlot = null">
        <div class="ladder-modal">
          <div class="ladder-header">
            <span class="ladder-title">{{ ladderSlot === 7 ? '에이스 맵 선택' : `경기${ladderSlot} 맵 선택` }}</span>
            <button class="ladder-close" @click="ladderSlot = null">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="ladder-maps">
            <button
              v-for="m in currentLadderMaps"
              :key="m.id"
              class="ladder-map-btn"
              :class="{ 'ladder-map-btn--selected': ladderPickResult === m.id }"
              @click="ladderPickResult = m.id"
            >
              <div class="ladder-map-thumb">
                <img v-if="m.thumbnail_url" :src="m.thumbnail_url" />
                <div v-else class="ladder-map-thumb-empty" />
              </div>
              <span class="ladder-map-name">{{ m.name }}</span>
            </button>
          </div>
          <div class="ladder-actions">
            <button class="ladder-random-btn" :disabled="ladderPicking" @click="randomPick">
              {{ ladderPicking ? '선택 중...' : '랜덤 선택' }}
            </button>
            <button class="btn-cancel" @click="ladderSlot = null">취소</button>
            <button
              class="btn-complete ladder-confirm-btn"
              :disabled="!ladderPickResult || savingLadderMap"
              @click="confirmLadder"
            >
              {{ savingLadderMap ? '저장 중...' : '확정' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 티어 사다리타기 모달 -->
    <Teleport to="body">
      <div v-if="tierLadderOpen" class="ladder-overlay" @click.self="tierLadderOpen = false">
        <div class="ladder-modal">
          <div class="ladder-header">
            <span class="ladder-title">에이스 티어 선택</span>
            <button class="ladder-close" @click="tierLadderOpen = false">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="ladder-tier-list">
            <button
              v-for="tier in aceTierCandidates"
              :key="tier"
              class="ladder-tier-btn"
              :class="[`tier-badge--${tier.toLowerCase()}`, { 'ladder-tier-btn--selected': tierPickResult === tier }]"
              @click="tierPickResult = tier"
            >
              {{ tier }} 티어
            </button>
          </div>
          <div class="ladder-actions">
            <button class="ladder-random-btn" :disabled="tierPicking" @click="randomTierPick">
              {{ tierPicking ? '선택 중...' : '랜덤 선택' }}
            </button>
            <button class="btn-cancel" @click="tierLadderOpen = false">취소</button>
            <button
              class="btn-complete ladder-confirm-btn"
              :disabled="!tierPickResult || savingTier"
              @click="confirmTierLadder"
            >
              {{ savingTier ? '저장 중...' : '확정' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
    <!-- 선수 교체 모달 -->
    <Teleport to="body">
      <div v-if="subModal" class="ladder-overlay" @click.self="subModal = null">
        <div class="ladder-modal sub-modal">
          <div class="ladder-header">
            <span class="ladder-title">대체 선수 선택</span>
            <button class="ladder-close" @click="subModal = null">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <p class="sub-modal-hint">원래 선수의 티어 이하 · 이 경기 미출전 선수만 표시됩니다</p>
          <div v-if="subModal.options.length" class="sub-player-list">
            <button
              v-for="opt in subModal.options"
              :key="opt.value"
              class="sub-player-item"
              :disabled="savingSub"
              @click="confirmSub(opt.value)"
            >
              <span class="slot-player-name" :class="`tier-badge--${opt.tier!.toLowerCase()}`">{{ opt.label }}</span>
              <span v-if="opt.race" class="slot-race" :class="`race-badge--${opt.race.toLowerCase()}`">{{ opt.race.toUpperCase() }}</span>
              <span class="sub-player-pts">{{ opt.points }}pt</span>
            </button>
          </div>
          <div v-else class="sub-modal-empty">출전 가능한 대체 선수가 없습니다</div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import AppIcon from '@/components/AppIcon.vue'
import PlayerSelect, { type SelectOption } from '@/components/PlayerSelect.vue'
import { getLeague } from '@/lib/leagues'
import { getCaptains, getMatchMaps } from '@/lib/leagueDetail'
import { getPlayers } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import { getSchedules, getSlotResults, setSlotResult, setSlotMap, setAceSlotData, setSlotSubstitution, completeMatch, type ScheduleRow } from '@/lib/schedules'
import { getScheduleEntries, computeFinalRosters, getAceTierBans } from '@/lib/entries'
import { getDraftPicks, getSwapLog } from '@/lib/draft'
import { getMaps } from '@/lib/maps'
import { withTimeout } from '@/lib/supabase'

const route = useRoute()
const leagueId = route.params.id as string
const matchId = Number(route.params.matchId)

const REGULAR_SLOTS = [
  { num: 1, type: 'individual' },
  { num: 2, type: 'individual' },
  { num: 3, type: 'individual' },
  { num: 4, type: 'team' },
  { num: 5, type: 'individual' },
  { num: 6, type: 'individual' },
] as const

const ACE_SLOT = { num: 7, type: 'ace' } as const
const BAN_SLOTS = new Set([2, 3])
const TIER_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
const TIER_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
const ALL_TIERS = ['A', 'B', 'C', 'D', 'E'] as const

interface TeamInfo {
  captainId: number
  nickname: string
  teamName: string
  tier: string
}

interface SlotPlayerInfo { id: number; nickname: string; tier: string; race: string }
interface SlotPlayers { teamA: SlotPlayerInfo[]; teamB: SlotPlayerInfo[] }
interface MapInfo { id: string; name: string; thumbnail_url: string | null }
interface SlotMapState {
  type: 'none' | 'fixed' | 'auto' | 'ladder'
  candidateMaps: MapInfo[]
}

const loading = ref(true)
const pageError = ref<string | null>(null)
const savingSlot = ref<number | null>(null)
const isCompleted = ref(false)
const completing = ref(false)
const completeError = ref<string | null>(null)

const schedule = ref<ScheduleRow | null>(null)
const teamA = ref<TeamInfo | null>(null)
const teamB = ref<TeamInfo | null>(null)
const slotWinners = ref(new Map<number, number>())
const slotPlayerMap = ref(new Map<number, SlotPlayers>())
const entryPointsA = ref(0)
const entryPointsB = ref(0)

// 맵 관련 상태
const allMapsById = ref(new Map<string, MapInfo>())
const matchMapConfig = ref(new Map<number, string[]>())
const entryBanMap = ref(new Map<number, Map<number, string | null>>())
const entryPickMap = ref(new Map<number, Map<number, string | null>>())
const ladderSelectedMaps = ref(new Map<number, string>())

// 맵 사다리타기 모달 상태
const ladderSlot = ref<number | null>(null)
const ladderPicking = ref(false)
const ladderPickResult = ref<string | null>(null)
const savingLadderMap = ref(false)

// 에이스 결정전 상태
// 에이스 티어 밴 (엔트리 제출 시 각 팀장이 선택한 값)
const aceTierBanA = ref<string | null>(null)
const aceTierBanB = ref<string | null>(null)

const aceData = reactive<{
  aceTier: string | null
  playerAId: number | null
  playerBId: number | null
}>({ aceTier: null, playerAId: null, playerBId: null })

// 티어 사다리타기 모달 상태
const tierLadderOpen = ref(false)
const tierPicking = ref(false)
const tierPickResult = ref<string | null>(null)
const savingTier = ref(false)

// 로스터 (에이스 선수 드롭다운용)
const rosterA = ref<SlotPlayerInfo[]>([])
const rosterB = ref<SlotPlayerInfo[]>([])

// 선수 교체 상태
// substitutionMap: slotNum → { teamA: number[] | null, teamB: number[] | null }
// (각 배열은 해당 슬롯의 player_ids와 동일 길이, null이면 교체 없음)
const substitutionMap = ref(new Map<number, { teamA: number[] | null; teamB: number[] | null }>())

interface SubModal {
  slotNum: number
  isTeamA: boolean
  playerIndex: number
  originalPlayerId: number
  options: SelectOption[]
}
const subModal = ref<SubModal | null>(null)
const savingSub = ref(false)

// 1~6경기 스코어
const score6A = computed(() =>
  [...slotWinners.value.entries()].filter(([s, w]) => s !== ACE_SLOT.num && w === schedule.value?.team_a_captain_id).length
)
const score6B = computed(() =>
  [...slotWinners.value.entries()].filter(([s, w]) => s !== ACE_SLOT.num && w === schedule.value?.team_b_captain_id).length
)

// 전체 스코어 (에이스 포함)
const scoreA = computed(() =>
  [...slotWinners.value.entries()].filter(([, w]) => w === schedule.value?.team_a_captain_id).length
)
const scoreB = computed(() =>
  [...slotWinners.value.entries()].filter(([, w]) => w === schedule.value?.team_b_captain_id).length
)

const showAce = computed(() => {
  if (score6A.value !== 3 || score6B.value !== 3) return false
  if (entryPointsA.value === 0 && entryPointsB.value === 0) return true
  return Math.abs(entryPointsA.value - entryPointsB.value) < 3
})

// 에이스 티어 후보 (양팀 밴 제외한 나머지)
const aceTierCandidates = computed((): string[] => {
  const bans = new Set<string>()
  if (aceTierBanA.value) bans.add(aceTierBanA.value)
  if (aceTierBanB.value) bans.add(aceTierBanB.value)
  return ALL_TIERS.filter(t => !bans.has(t))
})

// 에이스 맵 후보 (리그 배정 맵 전체에서 2·3경기 확정 맵 제외)
const aceMapCandidates = computed((): MapInfo[] => {
  const leagueMapIds = new Set<string>()
  for (const ids of matchMapConfig.value.values()) {
    for (const id of ids) leagueMapIds.add(id)
  }

  const confirmedIds = new Set<string>()
  for (const slotNum of [2, 3]) {
    const m = getResolvedMap(slotNum)
    if (m) confirmedIds.add(m.id)
  }

  return [...leagueMapIds]
    .filter(id => !confirmedIds.has(id))
    .map(id => allMapsById.value.get(id))
    .filter(Boolean) as MapInfo[]
})

// 에이스 출전 가능 선수 (확정 티어 이하)
const eligiblePlayersA = computed((): SlotPlayerInfo[] => {
  if (!aceData.aceTier) return []
  const maxRank = TIER_RANK[aceData.aceTier] ?? 0
  return rosterA.value.filter(p => (TIER_RANK[p.tier.toUpperCase()] ?? 0) <= maxRank)
})

const eligiblePlayersB = computed((): SlotPlayerInfo[] => {
  if (!aceData.aceTier) return []
  const maxRank = TIER_RANK[aceData.aceTier] ?? 0
  return rosterB.value.filter(p => (TIER_RANK[p.tier.toUpperCase()] ?? 0) <= maxRank)
})

const eligibleOptionsA = computed((): SelectOption[] =>
  eligiblePlayersA.value.map(p => ({
    value: p.id,
    label: p.nickname,
    tier: p.tier,
    race: p.race || undefined,
    points: TIER_POINTS[p.tier.toUpperCase()] ?? 1,
  }))
)

const eligibleOptionsB = computed((): SelectOption[] =>
  eligiblePlayersB.value.map(p => ({
    value: p.id,
    label: p.nickname,
    tier: p.tier,
    race: p.race || undefined,
    points: TIER_POINTS[p.tier.toUpperCase()] ?? 1,
  }))
)

const acePlayerA = computed(() =>
  aceData.playerAId ? eligibleOptionsA.value.find(o => o.value === aceData.playerAId) ?? null : null
)
const acePlayerB = computed(() =>
  aceData.playerBId ? eligibleOptionsB.value.find(o => o.value === aceData.playerBId) ?? null : null
)

// 현재 맵 사다리타기 모달의 후보 맵
const currentLadderMaps = computed((): MapInfo[] => {
  if (ladderSlot.value === 7) return aceMapCandidates.value
  return slotMapStates.value.get(ladderSlot.value ?? -1)?.candidateMaps ?? []
})

// ── 맵 배정 계산 ────────────────────────────────────────────────

function resolveSlotMap(slotNum: number): SlotMapState {
  const mapIds = matchMapConfig.value.get(slotNum) ?? []
  const maps = mapIds.map(id => allMapsById.value.get(id)).filter(Boolean) as MapInfo[]

  if (maps.length === 0) return { type: 'none', candidateMaps: [] }

  // 밴 없는 경기 (1, 4, 5, 6) 또는 맵이 1개뿐인 경우
  if (!BAN_SLOTS.has(slotNum) || maps.length === 1) {
    return { type: 'fixed', candidateMaps: maps }
  }

  // 밴 슬롯 (2, 3): 밴 결과 계산
  const captAId = schedule.value?.team_a_captain_id ?? 0
  const captBId = schedule.value?.team_b_captain_id ?? 0
  const banA = entryBanMap.value.get(captAId)?.get(slotNum) ?? null
  const banB = entryBanMap.value.get(captBId)?.get(slotNum) ?? null

  let candidates = [...maps]

  if (banA && banB) {
    if (banA === banB) {
      candidates = candidates.filter(m => m.id !== banA)
    } else {
      const afterBoth = candidates.filter(m => m.id !== banA && m.id !== banB)
      if (afterBoth.length === 0) {
        const rankA = TIER_RANK[(teamA.value?.tier ?? 'e').toUpperCase()] ?? 1
        const rankB = TIER_RANK[(teamB.value?.tier ?? 'e').toUpperCase()] ?? 1
        if (rankA === rankB) {
          candidates = maps
        } else {
          const effectiveBan = rankA <= rankB ? banA : banB
          candidates = candidates.filter(m => m.id !== effectiveBan)
        }
      } else {
        candidates = afterBoth
      }
    }
  } else if (banA) {
    candidates = candidates.filter(m => m.id !== banA)
  } else if (banB) {
    candidates = candidates.filter(m => m.id !== banB)
  }

  if (candidates.length === 0) return { type: 'none', candidateMaps: [] }
  if (candidates.length === 1) return { type: 'auto', candidateMaps: candidates }
  return { type: 'ladder', candidateMaps: candidates }
}

const slotMapStates = computed(() => {
  const result = new Map<number, SlotMapState>()
  for (const slot of REGULAR_SLOTS) {
    result.set(slot.num, resolveSlotMap(slot.num))
  }
  return result
})

function getSlotPlayerRank(slotNum: number, isTeamA: boolean): number {
  const players = slotPlayerMap.value.get(slotNum)
  const list = isTeamA ? players?.teamA : players?.teamB
  if (!list?.length) return 0
  return TIER_RANK[list[0].tier.toUpperCase()] ?? 0
}

function resolveByPick(slotNum: number, candidates: MapInfo[]): MapInfo | null {
  const captAId = schedule.value?.team_a_captain_id ?? 0
  const captBId = schedule.value?.team_b_captain_id ?? 0
  const pickA = entryPickMap.value.get(captAId)?.get(slotNum) ?? null
  const pickB = entryPickMap.value.get(captBId)?.get(slotNum) ?? null
  const candidateIds = new Set(candidates.map(m => m.id))
  const validPickA = pickA && candidateIds.has(pickA) ? pickA : null
  const validPickB = pickB && candidateIds.has(pickB) ? pickB : null

  if (!validPickA && !validPickB) return null
  if (validPickA && validPickA === validPickB) return candidates.find(m => m.id === validPickA) ?? null

  // 다른 픽 → 해당 슬롯 출전 선수 티어 비교
  const rankA = getSlotPlayerRank(slotNum, true)
  const rankB = getSlotPlayerRank(slotNum, false)
  if (rankA === rankB) return null  // 동티어 → 사다리 필요
  const winId = rankA < rankB ? (validPickA ?? validPickB) : (validPickB ?? validPickA)
  return candidates.find(m => m.id === winId) ?? null
}

function getResolvedMap(slotNum: number): MapInfo | null {
  if (slotNum === 7) {
    const selectedId = ladderSelectedMaps.value.get(7)
    return selectedId ? (allMapsById.value.get(selectedId) ?? null) : null
  }
  const state = slotMapStates.value.get(slotNum)
  if (!state || state.type === 'none') return null
  if (state.type === 'ladder') {
    if (BAN_SLOTS.has(slotNum)) {
      const pickResolved = resolveByPick(slotNum, state.candidateMaps)
      if (pickResolved) return pickResolved
      // 동티어 동일하지 않은 픽 → 사다리 결과로 폴백
    }
    const selectedId = ladderSelectedMaps.value.get(slotNum)
    return selectedId ? (allMapsById.value.get(selectedId) ?? null) : null
  }
  return state.candidateMaps[0] ?? null
}

// ── 선수 교체 ────────────────────────────────────────────────────

function getActivePlayers(slotNum: number, isTeamA: boolean): SlotPlayerInfo[] {
  const sub = substitutionMap.value.get(slotNum)
  const subIds = isTeamA ? sub?.teamA : sub?.teamB
  const original = slotPlayerMap.value.get(slotNum)
  const originalList = isTeamA ? original?.teamA : original?.teamB
  if (!originalList?.length) return []

  if (subIds?.length) {
    return subIds.map(id => {
      const roster = isTeamA ? rosterA.value : rosterB.value
      const found = roster.find(p => p.id === id)
      return found ?? { id, nickname: `선수${id}`, tier: 'e', race: '' }
    })
  }
  return originalList
}

function isSubstituted(slotNum: number, isTeamA: boolean, playerIndex: number): boolean {
  const sub = substitutionMap.value.get(slotNum)
  const subIds = isTeamA ? sub?.teamA : sub?.teamB
  if (!subIds) return false
  const original = slotPlayerMap.value.get(slotNum)
  const originalList = isTeamA ? original?.teamA : original?.teamB
  return subIds[playerIndex] !== originalList?.[playerIndex]?.id
}

function getAlreadyAssignedIds(captainId: number, excludeSlotNum: number, excludePlayerIndex: number): Set<number> {
  const assigned = new Set<number>()
  for (const [slotNum, slotPlayers] of slotPlayerMap.value) {
    const isTeamA = captainId === schedule.value?.team_a_captain_id
    const list = isTeamA ? slotPlayers.teamA : slotPlayers.teamB
    const sub = substitutionMap.value.get(slotNum)
    const subIds = isTeamA ? sub?.teamA : sub?.teamB

    list.forEach((p, idx) => {
      // 교체 대상인 슬롯+인덱스는 제외
      if (slotNum === excludeSlotNum && idx === excludePlayerIndex) return
      const activeId = subIds?.[idx] ?? p.id
      assigned.add(activeId)
    })
  }
  return assigned
}

function openSubModal(slotNum: number, isTeamA: boolean, playerIndex: number) {
  const captainId = isTeamA ? schedule.value!.team_a_captain_id : schedule.value!.team_b_captain_id
  const roster = isTeamA ? rosterA.value : rosterB.value
  const original = slotPlayerMap.value.get(slotNum)
  const originalList = isTeamA ? original?.teamA : original?.teamB
  const originalPlayer = originalList?.[playerIndex]
  if (!originalPlayer) return

  const originalRank = TIER_RANK[originalPlayer.tier.toUpperCase()] ?? 0
  const assigned = getAlreadyAssignedIds(captainId, slotNum, playerIndex)

  const options: SelectOption[] = roster
    .filter(p => {
      if (assigned.has(p.id)) return false
      const rank = TIER_RANK[p.tier.toUpperCase()] ?? 0
      return rank <= originalRank
    })
    .map(p => ({
      value: p.id,
      label: p.nickname,
      tier: p.tier,
      race: p.race || undefined,
      points: TIER_POINTS[p.tier.toUpperCase()] ?? 1,
    }))

  subModal.value = { slotNum, isTeamA, playerIndex, originalPlayerId: originalPlayer.id, options }
}

async function confirmSub(newPlayerId: number) {
  if (!subModal.value || savingSub.value) return
  const { slotNum, isTeamA, playerIndex } = subModal.value
  savingSub.value = true
  try {
    const original = slotPlayerMap.value.get(slotNum)
    const originalList = isTeamA ? original?.teamA : original?.teamB
    if (!originalList) return

    const existing = substitutionMap.value.get(slotNum) ?? { teamA: null, teamB: null }
    const currentIds: number[] = (isTeamA ? existing.teamA : existing.teamB)
      ?? originalList.map(p => p.id)
    const newIds = [...currentIds]
    newIds[playerIndex] = newPlayerId

    await setSlotSubstitution(schedule.value!.id, slotNum, isTeamA, newIds)

    const updated = new Map(substitutionMap.value)
    updated.set(slotNum, isTeamA
      ? { teamA: newIds, teamB: existing.teamB }
      : { teamA: existing.teamA, teamB: newIds }
    )
    substitutionMap.value = updated
    subModal.value = null
  } catch (e: any) {
    console.error(e)
  } finally {
    savingSub.value = false
  }
}

async function resetSub(slotNum: number, isTeamA: boolean, playerIndex: number) {
  const original = slotPlayerMap.value.get(slotNum)
  const originalList = isTeamA ? original?.teamA : original?.teamB
  if (!originalList) return

  const existing = substitutionMap.value.get(slotNum) ?? { teamA: null, teamB: null }
  const currentIds: number[] = (isTeamA ? existing.teamA : existing.teamB)
    ?? originalList.map(p => p.id)
  const newIds = [...currentIds]
  newIds[playerIndex] = originalList[playerIndex].id

  const isAllOriginal = newIds.every((id, i) => id === originalList[i]?.id)
  const finalIds = isAllOriginal ? originalList.map(p => p.id) : newIds

  try {
    await setSlotSubstitution(schedule.value!.id, slotNum, isTeamA, finalIds)
    const updated = new Map(substitutionMap.value)
    updated.set(slotNum, isTeamA
      ? { teamA: isAllOriginal ? null : finalIds, teamB: existing.teamB }
      : { teamA: existing.teamA, teamB: isAllOriginal ? null : finalIds }
    )
    substitutionMap.value = updated
  } catch (e: any) {
    console.error(e)
  }
}

// ── 맵 사다리타기 ──────────────────────────────────────────────────

function openLadder(slotNum: number) {
  ladderSlot.value = slotNum
  ladderPickResult.value = ladderSelectedMaps.value.get(slotNum) ?? null
}

function randomPick() {
  if (ladderPicking.value) return
  ladderPicking.value = true
  ladderPickResult.value = null

  const candidates = currentLadderMaps.value
  if (candidates.length === 0) { ladderPicking.value = false; return }

  let count = 0
  const totalFlashes = 10 + Math.floor(Math.random() * 8)
  const interval = setInterval(() => {
    ladderPickResult.value = candidates[Math.floor(Math.random() * candidates.length)].id
    count++
    if (count >= totalFlashes) {
      clearInterval(interval)
      ladderPicking.value = false
    }
  }, 80)
}

async function confirmLadder() {
  if (!ladderSlot.value || !ladderPickResult.value) return
  savingLadderMap.value = true
  try {
    await setSlotMap(matchId, ladderSlot.value, ladderPickResult.value)
    const newMap = new Map(ladderSelectedMaps.value)
    newMap.set(ladderSlot.value, ladderPickResult.value)
    ladderSelectedMaps.value = newMap
    ladderSlot.value = null
  } catch (e: any) {
    console.error(e)
  } finally {
    savingLadderMap.value = false
  }
}

// ── 티어 사다리타기 ────────────────────────────────────────────────

function openTierLadder() {
  tierLadderOpen.value = true
  tierPickResult.value = null
}

function randomTierPick() {
  if (tierPicking.value) return
  tierPicking.value = true
  tierPickResult.value = null

  const candidates = aceTierCandidates.value
  if (candidates.length === 0) { tierPicking.value = false; return }

  let count = 0
  const totalFlashes = 10 + Math.floor(Math.random() * 8)
  const interval = setInterval(() => {
    tierPickResult.value = candidates[Math.floor(Math.random() * candidates.length)]
    count++
    if (count >= totalFlashes) {
      clearInterval(interval)
      tierPicking.value = false
    }
  }, 80)
}

async function confirmTierLadder() {
  if (!tierPickResult.value) return
  savingTier.value = true
  try {
    await setAceSlotData(matchId, { aceTier: tierPickResult.value })
    aceData.aceTier = tierPickResult.value
    tierLadderOpen.value = false
  } catch (e: any) {
    console.error(e)
  } finally {
    savingTier.value = false
  }
}

async function resetAceTier() {
  try {
    await setAceSlotData(matchId, { aceTier: null })
    aceData.aceTier = null
    tierPickResult.value = null
  } catch (e: any) {
    console.error(e)
  }
}

// ── 에이스 선수 선택 ────────────────────────────────────────────

async function setAcePlayer(side: 'A' | 'B', value: number) {
  const playerId = value || null
  if (side === 'A') aceData.playerAId = playerId
  else aceData.playerBId = playerId
  try {
    await setAceSlotData(matchId, side === 'A' ? { playerAId: playerId } : { playerBId: playerId })
  } catch (e: any) {
    console.error(e)
  }
}

// ── 데이터 로딩 ─────────────────────────────────────────────────

onMounted(async () => {
  try {
    const [leagueData, captains, players, teamNames, schedules, slotResults, entries, matchMapsData, allMapsData, draftPicks, swapLog] = await withTimeout(Promise.all([
      getLeague(leagueId),
      getCaptains(leagueId),
      getPlayers(),
      getTeamNames(leagueId),
      getSchedules(leagueId),
      getSlotResults(matchId),
      getScheduleEntries(matchId),
      getMatchMaps(leagueId),
      getMaps(),
      getDraftPicks(leagueId),
      getSwapLog(leagueId),
    ]))

    void leagueData

    const match = schedules.find(s => s.id === matchId)
    if (!match) throw new Error('경기를 찾을 수 없습니다.')
    schedule.value = match
    isCompleted.value = match.is_completed

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))

    const makeTeam = (captainId: number): TeamInfo => {
      const p = playerMap.get(captainId)
      return {
        captainId,
        nickname: p?.nickname ?? `선수 ${captainId}`,
        teamName: nameMap.get(captainId) ?? '',
        tier: p?.tier ?? 'e',
      }
    }

    const captainIds = captains.map(c => c.player_id)
    if (captainIds.includes(match.team_a_captain_id)) teamA.value = makeTeam(match.team_a_captain_id)
    if (captainIds.includes(match.team_b_captain_id)) teamB.value = makeTeam(match.team_b_captain_id)

    const winnerMap = new Map<number, number>()
    for (const r of slotResults) {
      if (r.winner_captain_id != null) winnerMap.set(r.slot_num, r.winner_captain_id)
    }
    slotWinners.value = winnerMap

    // 슬롯별 선수 맵
    const toInfo = (id: number): SlotPlayerInfo => {
      const p = playerMap.get(id)
      return { id, nickname: p?.nickname ?? `선수${id}`, tier: p?.tier ?? 'e', race: p?.race ?? '' }
    }
    const aEntries = entries.filter(e => e.captain_player_id === match.team_a_captain_id)
    const bEntries = entries.filter(e => e.captain_player_id === match.team_b_captain_id)
    const spMap = new Map<number, SlotPlayers>()
    const allSlots = new Set([...aEntries.map(e => e.match_slot), ...bEntries.map(e => e.match_slot)])
    for (const slotNum of allSlots) {
      const aSlot = aEntries.find(e => e.match_slot === slotNum)
      const bSlot = bEntries.find(e => e.match_slot === slotNum)
      spMap.set(slotNum, {
        teamA: (aSlot?.player_ids ?? []).map(toInfo),
        teamB: (bSlot?.player_ids ?? []).map(toInfo),
      })
    }
    slotPlayerMap.value = spMap

    // 팀별 총 포인트
    const calcPoints = (captainId: number) =>
      entries
        .filter(e => e.captain_player_id === captainId)
        .flatMap(e => e.player_ids)
        .reduce((sum, pid) => sum + (TIER_POINTS[(playerMap.get(pid)?.tier ?? 'e').toUpperCase()] ?? 1), 0)
    entryPointsA.value = calcPoints(match.team_a_captain_id)
    entryPointsB.value = calcPoints(match.team_b_captain_id)

    // 맵 데이터
    const mapsById = new Map<string, MapInfo>()
    for (const m of allMapsData) {
      mapsById.set(m.id, { id: m.id, name: m.name, thumbnail_url: m.thumbnail_url })
    }
    allMapsById.value = mapsById

    const mmConfig = new Map<number, string[]>()
    for (const mm of matchMapsData) {
      mmConfig.set(mm.match_number, mm.map_ids)
    }
    matchMapConfig.value = mmConfig

    // 엔트리 밴/픽 맵
    const banMap = new Map<number, Map<number, string | null>>()
    const pickMap = new Map<number, Map<number, string | null>>()
    for (const e of entries) {
      if (!banMap.has(e.captain_player_id)) banMap.set(e.captain_player_id, new Map())
      banMap.get(e.captain_player_id)!.set(e.match_slot, e.banned_map_id)
      if (!pickMap.has(e.captain_player_id)) pickMap.set(e.captain_player_id, new Map())
      pickMap.get(e.captain_player_id)!.set(e.match_slot, e.picked_map_id)
    }
    entryBanMap.value = banMap
    entryPickMap.value = pickMap

    // 사다리타기 기선택 맵
    const ladderMap = new Map<number, string>()
    for (const r of slotResults) {
      if (r.selected_map_id) ladderMap.set(r.slot_num, r.selected_map_id)
    }
    ladderSelectedMaps.value = ladderMap

    // 선수 교체 복원
    const subMap = new Map<number, { teamA: number[] | null; teamB: number[] | null }>()
    for (const r of slotResults) {
      if (r.slot_num === 7) continue
      if (r.sub_player_a_ids || r.sub_player_b_ids) {
        subMap.set(r.slot_num, {
          teamA: r.sub_player_a_ids ?? null,
          teamB: r.sub_player_b_ids ?? null,
        })
      }
    }
    substitutionMap.value = subMap

    // 에이스 밴 복원 (엔트리 제출 시 저장된 값)
    const aceBans = await getAceTierBans(matchId)
    for (const ban of aceBans) {
      if (ban.captain_player_id === match.team_a_captain_id) aceTierBanA.value = ban.tier_ban
      else if (ban.captain_player_id === match.team_b_captain_id) aceTierBanB.value = ban.tier_ban
    }

    // 에이스 데이터 복원
    const aceRow = slotResults.find(r => r.slot_num === 7)
    if (aceRow) {
      aceData.aceTier = aceRow.ace_tier ?? null
      aceData.playerAId = aceRow.ace_player_a_id ?? null
      aceData.playerBId = aceRow.ace_player_b_id ?? null
    }

    // 팀 로스터 계산 (에이스 선수 드롭다운)
    const finalRosters = computeFinalRosters(captains, draftPicks, swapLog)
    const makeRoster = (captainId: number): SlotPlayerInfo[] => {
      const memberIds = finalRosters.get(captainId) ?? []
      return memberIds.map(toInfo)
    }
    rosterA.value = makeRoster(match.team_a_captain_id)
    rosterB.value = makeRoster(match.team_b_captain_id)

  } catch (e: any) {
    pageError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loading.value = false
  }
})

async function handleComplete() {
  completing.value = true
  completeError.value = null
  try {
    const winner = scoreA.value > scoreB.value
      ? schedule.value!.team_a_captain_id
      : scoreB.value > scoreA.value
        ? schedule.value!.team_b_captain_id
        : null
    await completeMatch(matchId, winner)
    isCompleted.value = true
  } catch (e: any) {
    completeError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    completing.value = false
  }
}

async function toggleWinner(slotNum: number, captainId: number) {
  if (savingSlot.value != null) return
  const current = slotWinners.value.get(slotNum)
  const next = current === captainId ? null : captainId

  savingSlot.value = slotNum
  try {
    await setSlotResult(matchId, slotNum, next)
    const map = new Map(slotWinners.value)
    if (next == null) map.delete(slotNum)
    else map.set(slotNum, next)
    slotWinners.value = map
  } catch (e: any) {
    console.error(e)
  } finally {
    savingSlot.value = null
  }
}
</script>

<style lang="scss" scoped>
@use './MatchSlotResultView.scss';
</style>
