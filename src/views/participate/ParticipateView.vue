<template>
  <div class="participate-page">
    <AppHeader />

    <div class="participate-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">리그 참여</h1>
      </div>

      <div v-if="loadingLeagues" class="state-msg">불러오는 중...</div>
      <div v-else-if="!leagues.length" class="state-msg">현재 참여 가능한 리그가 없습니다.</div>

      <div v-else class="league-list">
        <div v-for="league in leagues" :key="league.id" class="league-card">
          <div class="league-card-top">
            <span class="status-badge" :class="`status-badge--${getLeagueStatus(league)}`">
              {{ statusLabel(getLeagueStatus(league)) }}
            </span>
            <span class="eligibility-badge">{{ eligibilityLabel(league.eligibility_type) }}</span>
          </div>

          <p class="league-name">{{ league.name }}</p>

          <div class="league-meta">
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
                <path d="M1 5h10" stroke="currentColor" stroke-width="1.1"/>
                <path d="M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
              {{ league.start_date }} ~ {{ league.end_date }}
            </span>
          </div>
          <div class="league-meta">
            <span class="meta-item">
              <span
                v-for="tier in league.eligible_tiers"
                :key="tier"
                class="tier-chip"
                :class="`tier-chip--${tier.toLowerCase()}`"
              >{{ tier }}</span>
            </span>
          </div>

          <div class="league-card-actions">
            <button v-if="league.description" class="btn-guide" @click="openGuide(league)">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
                <path d="M7 6.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
                <circle cx="7" cy="4.5" r="0.7" fill="currentColor"/>
              </svg>
              리그 안내
            </button>
            <button class="btn-check-entry" @click="openRevealList(league)">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <ellipse cx="7" cy="7" rx="5.5" ry="3.5" stroke="currentColor" stroke-width="1.3"/>
                <circle cx="7" cy="7" r="1.8" fill="currentColor"/>
              </svg>
              엔트리 확인
            </button>
            <button class="btn-check-result" @click="openResultList(league)">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1.5" y="3" width="11" height="8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
                <path d="M4.5 7h5M7 5v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              </svg>
              경기 결과
            </button>
            <button class="btn-check-standings" @click="openStandingsList(league)">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <rect x="1" y="8" width="3" height="5" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <rect x="5.5" y="5" width="3" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/>
                <rect x="10" y="2" width="3" height="11" rx="1" stroke="currentColor" stroke-width="1.2"/>
              </svg>
              리그 순위
            </button>
            <button
              v-if="myCaptainLeagueIds.has(league.id)"
              class="btn-entry-open"
              @click="openMatchList(league)"
            >
              엔트리 제출
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── 리그 안내 모달 ──────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="guideModal.open" class="modal-overlay">
        <div class="modal">
          <div class="modal-header">
            <p class="modal-title">{{ guideModal.name }}</p>
            <button class="modal-close" @click="guideModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <EditorContent :editor="viewEditor" />
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 경기 목록 모달 ──────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="matchListModal.open" class="modal-overlay">
        <div class="modal modal--match-list">
          <div class="modal-header">
            <p class="modal-title">엔트리 제출</p>
            <p class="modal-subtitle">{{ matchListModal.league?.name }}</p>
            <button class="modal-close" @click="matchListModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body match-list-body">
            <div v-if="matchListModal.loading" class="state-msg">불러오는 중...</div>
            <div v-else-if="!matchListModal.matches.length" class="state-msg">
              참여 중인 경기가 없습니다.
            </div>
            <div v-else class="match-item-list">
              <div
                v-for="item in matchListModal.matches"
                :key="item.schedule.id"
                class="match-item"
              >
                <div class="match-item-info">
                  <span class="round-tag">{{ item.schedule.round }}라운드</span>
                  <span class="match-item-vs">
                    <span class="my-team-name">{{ item.myTeamName }}</span>
                    <span class="vs-divider">VS</span>
                    <span class="opp-team-name">{{ item.opponentTeamName }}</span>
                  </span>
                  <span class="match-item-date">
                    {{ item.schedule.match_date ? item.schedule.match_date.replaceAll('-', '/') : '날짜 미정' }}
                  </span>
                </div>
                <div class="match-item-actions">
                  <template v-if="entryStatusMap.get(item.schedule.id) === 'submitted'">
                    <span class="entry-done-badge">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                      제출됨
                    </span>
                    <span v-if="consentedSet.has(item.schedule.id)" class="entry-consent-badge">
                      공개 동의됨
                    </span>
                    <button
                      v-else
                      class="btn-entry btn-entry--consent"
                      :disabled="consentingId === item.schedule.id"
                      @click="handleConsentReveal(item)"
                    >{{ consentingId === item.schedule.id ? '...' : '공개 동의' }}</button>
                  </template>
                  <template v-else-if="entryStatusMap.get(item.schedule.id) === 'saved'">
                    <button class="btn-entry btn-entry--edit" @click="openEntryModal(item)">수정</button>
                    <button
                      class="btn-entry btn-entry--submit"
                      :disabled="submittingId === item.schedule.id"
                      @click="handleSubmitEntry(item.schedule.id)"
                    >{{ submittingId === item.schedule.id ? '...' : '제출' }}</button>
                  </template>
                  <template v-else>
                    <button class="btn-entry" @click="openEntryModal(item)">작성</button>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 공개된 경기 목록 모달 ──────────────────────────────── -->
    <Teleport to="body">
      <div v-if="revealListModal.open" class="modal-overlay">
        <div class="modal modal--match-list">
          <div class="modal-header">
            <div>
              <p class="modal-title">엔트리 확인</p>
              <p class="modal-subtitle">{{ revealListModal.league?.name }}</p>
            </div>
            <button class="modal-close" @click="revealListModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body match-list-body">
            <div v-if="revealListModal.loading" class="state-msg">불러오는 중...</div>
            <div v-else-if="!revealListModal.matches.length" class="state-msg">
              아직 공개된 엔트리가 없습니다.
            </div>
            <div v-else class="match-item-list">
              <div
                v-for="item in revealListModal.matches"
                :key="item.schedule.id"
                class="match-item"
              >
                <div class="match-item-info">
                  <span class="round-tag">{{ item.schedule.round }}라운드</span>
                  <span class="match-item-vs">
                    <span class="my-team-name">{{ item.teamAName }}</span>
                    <span class="vs-divider">VS</span>
                    <span class="opp-team-name">{{ item.teamBName }}</span>
                  </span>
                  <span class="match-item-date">
                    {{ item.schedule.match_date ? item.schedule.match_date.replaceAll('-', '/') : '날짜 미정' }}
                  </span>
                </div>
                <div class="match-item-actions">
                  <button class="btn-entry" @click="openRevealEntry(item)">확인</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 엔트리 확인 (공개된 내용 보기) 모달 ──────────────── -->
    <EntryRevealModal
      v-if="revealModal.open && revealModal.item"
      :schedule-id="revealModal.item.schedule.id"
      :round="revealModal.item.schedule.round"
      :match-date="revealModal.item.schedule.match_date"
      :league-id="revealListModal.league?.id ?? ''"
      :team-a-captain-id="revealModal.item.schedule.team_a_captain_id"
      :team-b-captain-id="revealModal.item.schedule.team_b_captain_id"
      :team-a-name="revealModal.item.teamAName"
      :team-b-name="revealModal.item.teamBName"
      @close="revealModal.open = false"
    />

    <!-- ── 경기 결과 목록 모달 ──────────────────────────────── -->
    <Teleport to="body">
      <div v-if="resultListModal.open" class="modal-overlay">
        <div class="modal modal--match-list">
          <div class="modal-header">
            <div>
              <p class="modal-title">경기 결과</p>
              <p class="modal-subtitle">{{ resultListModal.league?.name }}</p>
            </div>
            <button class="modal-close" @click="resultListModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body match-list-body">
            <div v-if="resultListModal.loading" class="state-msg">불러오는 중...</div>
            <div v-else-if="!resultListModal.matches.length" class="state-msg">
              아직 종료된 경기가 없습니다.
            </div>
            <div v-else class="match-item-list">
              <div
                v-for="item in resultListModal.matches"
                :key="item.schedule.id"
                class="match-item"
              >
                <div class="match-item-info">
                  <span class="round-tag">{{ item.schedule.round }}라운드</span>
                  <span class="match-item-vs">
                    <span
                      class="result-team-name"
                      :class="item.schedule.winner_captain_id === item.schedule.team_a_captain_id ? 'result-team-name--win' : 'result-team-name--loss'"
                    >{{ item.teamAName }}</span>
                    <span class="result-score">
                      <span :class="item.schedule.winner_captain_id === item.schedule.team_a_captain_id ? 'result-score--win' : 'result-score--loss'">{{ item.teamAWins }}</span>
                      <span class="result-score-sep">:</span>
                      <span :class="item.schedule.winner_captain_id === item.schedule.team_b_captain_id ? 'result-score--win' : 'result-score--loss'">{{ item.teamBWins }}</span>
                    </span>
                    <span
                      class="result-team-name"
                      :class="item.schedule.winner_captain_id === item.schedule.team_b_captain_id ? 'result-team-name--win' : 'result-team-name--loss'"
                    >{{ item.teamBName }}</span>
                  </span>
                  <span class="match-item-date">
                    {{ item.schedule.match_date ? item.schedule.match_date.replaceAll('-', '/') : '날짜 미정' }}
                  </span>
                </div>
                <div class="match-item-actions">
                  <button class="btn-entry" @click="openResultEntry(item)">결과 보기</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 리그 순위 모달 ────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="standingsModal.open" class="modal-overlay">
        <div class="modal modal--result-standings">
          <div class="modal-header">
            <div>
              <p class="modal-title">리그 순위</p>
              <p class="modal-subtitle">{{ standingsModal.league?.name }}</p>
            </div>
            <button class="modal-close" @click="standingsModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body standings-body">
            <div v-if="standingsModal.loading" class="state-msg">불러오는 중...</div>
            <div v-else-if="!standingsModal.standings.length" class="state-msg">
              아직 종료된 경기가 없습니다.
            </div>
            <div v-else class="standings-list">
              <div
                v-for="(team, idx) in standingsModal.standings"
                :key="team.captainId"
                class="standing-team"
              >
                <div class="standing-team-header">
                  <span class="standing-rank">{{ idx + 1 }}</span>
                  <span class="standing-name">{{ team.teamName }}</span>
                  <div class="standing-stats">
                    <span class="standing-record">{{ team.wins }}승 {{ team.losses }}패</span>
                    <span class="standing-pts">{{ team.matchPoints }}<span class="standing-pts-label">pt</span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- ── 경기 결과 확인 모달 ────────────────────────────────── -->
    <EntryRevealModal
      v-if="resultModal.open && resultModal.item"
      :schedule-id="resultModal.item.schedule.id"
      :round="resultModal.item.schedule.round"
      :match-date="resultModal.item.schedule.match_date"
      :league-id="resultListModal.league?.id ?? ''"
      :team-a-captain-id="resultModal.item.schedule.team_a_captain_id"
      :team-b-captain-id="resultModal.item.schedule.team_b_captain_id"
      :team-a-name="resultModal.item.teamAName"
      :team-b-name="resultModal.item.teamBName"
      :show-results="true"
      @close="resultModal.open = false"
    />

    <!-- ── 엔트리 제출 모달 ────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="entryModal.open" class="modal-overlay">
        <div class="modal modal--entry">
          <div class="modal-header">
            <div>
              <p class="modal-title">엔트리 작성</p>
              <p class="modal-subtitle">
                {{ entryModal.schedule?.round }}라운드
                <span v-if="entryModal.schedule?.match_date">
                  · {{ entryModal.schedule.match_date.replaceAll('-', '/') }}
                </span>
                · vs {{ entryModal.opponentTeamName }}
              </p>
            </div>
            <button class="modal-close" @click="closeEntryModal">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <!-- 포인트 바 (항상 노출) -->
          <div v-if="!loadingEntry" class="entry-points-bar">
            <div class="epi" :class="{ 'epi--over': individualPoints > MAX_INDIVIDUAL_POINTS }">
              <div class="epi-top">
                <span class="epi-label">개인전</span>
                <span class="epi-val">{{ individualPoints }}<span class="epi-max">/{{ MAX_INDIVIDUAL_POINTS }}</span></span>
              </div>
              <div class="epi-track">
                <div class="epi-fill" :style="{ width: `${Math.min(100, individualPoints / MAX_INDIVIDUAL_POINTS * 100)}%` }" />
              </div>
            </div>
            <div class="epi-divider" />
            <div class="epi" :class="{ 'epi--over': teamPoints > MAX_TEAM_POINTS }">
              <div class="epi-top">
                <span class="epi-label">팀전</span>
                <span class="epi-val">{{ teamPoints }}<span class="epi-max">/{{ MAX_TEAM_POINTS }}</span></span>
              </div>
              <div class="epi-track">
                <div class="epi-fill" :style="{ width: `${Math.min(100, teamPoints / MAX_TEAM_POINTS * 100)}%` }" />
              </div>
            </div>
            <div class="epi-divider" />
            <div class="epi epi--total" :class="{ 'epi--over': totalPoints > MAX_TOTAL_POINTS }">
              <div class="epi-top">
                <span class="epi-label">합계</span>
                <span class="epi-val">{{ totalPoints }}<span class="epi-max">/{{ MAX_TOTAL_POINTS }}</span></span>
              </div>
              <div class="epi-track">
                <div class="epi-fill" :style="{ width: `${Math.min(100, totalPoints / MAX_TOTAL_POINTS * 100)}%` }" />
              </div>
            </div>
          </div>

          <div class="modal-body entry-body">
            <div v-if="loadingEntry" class="state-msg">불러오는 중...</div>

            <template v-else>
              <div class="slot-list">
                <template v-for="slot in SLOT_CONFIG" :key="slot.num">
                  <div class="slot-row" :class="{ 'slot-row--team': slot.type === 'team' }">
                    <!-- 슬롯 레이블 (좌측) -->
                    <div class="slot-label">
                      <span class="slot-num">{{ slot.num }}</span>
                      <span class="slot-type-badge" :class="`slot-type-badge--${slot.type}`">
                        {{ slot.type === 'team' ? '팀전' : '개인전' }}
                      </span>
                    </div>

                    <!-- 맵 + 선수 (우측) -->
                    <div class="slot-content">
                      <!-- 맵 칩 -->
                      <div v-if="entryModal.slotMaps[slot.num]?.length" class="slot-maps-row">
                        <div
                          v-for="map in entryModal.slotMaps[slot.num]"
                          :key="map.id"
                          class="map-chip"
                          :class="{ 'map-chip--banned': entryModal.banSelections[slot.num] === map.id }"
                        >
                          <img v-if="map.thumbnail_url" :src="map.thumbnail_url" class="map-chip-img" />
                          <div v-else class="map-chip-img-empty" />
                          <span class="map-chip-name">{{ map.name }}</span>
                          <button
                            v-if="(BAN_SLOTS as readonly number[]).includes(slot.num) && entryModal.slotMaps[slot.num].length > 1"
                            class="map-chip-ban"
                            :class="{ 'map-chip-ban--active': entryModal.banSelections[slot.num] === map.id }"
                            type="button"
                            @click="toggleBan(slot.num, map.id)"
                          >{{ entryModal.banSelections[slot.num] === map.id ? '밴 취소' : '밴' }}</button>
                        </div>
                      </div>

                      <!-- 선수 선택 -->
                      <div class="slot-selects">
                        <PlayerSelect
                          v-for="idx in slot.count"
                          :key="idx"
                          :model-value="getSlotPlayer(slot.num, idx - 1)"
                          :options="buildOptions(slot.num, idx - 1)"
                          @update:model-value="setSlotPlayer(slot.num, idx - 1, $event)"
                        />
                      </div>
                    </div>
                  </div>
                </template>

                <!-- 에이스 결정전 티어 밴 -->
                <div class="ace-ban-section">
                  <div class="ace-ban-header">
                    <span class="ace-ban-title">에이스 결정전 티어 밴</span>
                    <span class="ace-ban-hint">상대가 출전시킬 수 없는 티어 1개를 선택하세요</span>
                  </div>
                  <div class="ace-ban-tiers">
                    <button
                      v-for="tier in ACE_TIERS"
                      :key="tier"
                      class="ace-ban-tier-btn"
                      :class="[`tier-badge--${tier.toLowerCase()}`, { 'ace-ban-tier-btn--selected': entryModal.aceTierBan === tier }]"
                      type="button"
                      @click="entryModal.aceTierBan = entryModal.aceTierBan === tier ? null : tier"
                    >
                      <span class="ace-ban-tier-label">{{ tier }}</span>
                      <span class="ace-ban-tier-sub">티어</span>
                    </button>
                  </div>
                </div>
              </div>

            </template>
          </div>

          <div class="modal-footer">
            <p v-if="entryError" class="entry-error">{{ entryError }}</p>
            <button class="btn-cancel" @click="closeEntryModal">취소</button>
            <button class="btn-submit" :disabled="entrySaving || loadingEntry" @click="handleEntrySubmit">
              {{ entrySaving ? '저장 중...' : '저장' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import PlayerSelect, { type SelectOption } from '@/components/PlayerSelect.vue'
import EntryRevealModal from '@/components/EntryRevealModal.vue'
import { getLeagues, getLeagueStatus, type LeagueRow, type LeagueStatus, type EligibilityType } from '@/lib/leagues'
import { getCaptains, getMatchMaps } from '@/lib/leagueDetail'
import { getMaps } from '@/lib/maps'
import { getDraftPicks, getSwapLog } from '@/lib/draft'
import { getSchedules, getRevealedSchedules, getCompletedSchedules, getSlotResultsForSchedules, type ScheduleRow } from '@/lib/schedules'
import { getPlayers, getPlayerByDiscordId, type PlayerRow } from '@/lib/players'
import { getTeamNames } from '@/lib/teamNames'
import {
  getEntries, saveEntries, submitEntry, getEntryStatusMap, computeFinalRosters,
  consentReveal, checkBothConsented, getConsentedSet,
  getAceTierBan, saveAceTierBan,
  TIER_POINTS, INDIVIDUAL_SLOTS, TEAM_SLOT, BAN_SLOTS,
  MAX_INDIVIDUAL_POINTS, MAX_TEAM_POINTS, MAX_TOTAL_POINTS,
  type EntrySlot, type EntryStatus,
} from '@/lib/entries'
import { revealEntries } from '@/lib/schedules'
import { notifyEntrySubmitted } from '@/lib/notifications'
import { useAuthStore } from '@/stores/auth'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { FontSize } from '@/lib/tiptapFontSize'

// 슬롯별 승점
const MATCH_SLOT_POINTS: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 6: 1, 7: 2 }

const SLOT_CONFIG = [
  { num: 1, type: 'individual', count: 1 },
  { num: 2, type: 'individual', count: 1 },
  { num: 3, type: 'individual', count: 1 },
  { num: 4, type: 'team',       count: 2 },
  { num: 5, type: 'individual', count: 1 },
  { num: 6, type: 'individual', count: 1 },
] as const

const ACE_TIERS = ['A', 'B', 'C', 'D', 'E'] as const

// ── 상태 ─────────────────────────────────────────────────────
const auth = useAuthStore()
const loadingLeagues = ref(true)
const leagues = ref<LeagueRow[]>([])
const myPlayerId = ref<number | null>(null)
const myCaptainLeagueIds = ref(new Set<string>())
const entryStatusMap = ref(new Map<number, EntryStatus>())
const submittingId = ref<number | null>(null)
const consentedSet = ref(new Set<number>())
const consentingId = ref<number | null>(null)

// 리그 안내 모달
const guideModal = reactive({ open: false, name: '' })
const viewEditor = useEditor({
  content: '',
  editable: false,
  extensions: [
    StarterKit, TextStyle, Color, FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  editorProps: { attributes: { class: 'tiptap-editor' } },
})
function openGuide(league: LeagueRow) {
  guideModal.name = league.name
  viewEditor.value?.commands.setContent(league.description ?? '')
  guideModal.open = true
}
watch(() => guideModal.open, open => { if (!open) viewEditor.value?.commands.setContent('') })

// 경기 목록 모달
interface MyMatchItem {
  schedule: ScheduleRow
  leagueId: string
  myTeamName: string
  opponentTeamName: string
  myTeamCaptainId: number
}
const matchListModal = reactive({
  open: false,
  league: null as LeagueRow | null,
  matches: [] as MyMatchItem[],
  loading: false,
})

// 공개된 경기 목록 모달
interface RevealListItem {
  schedule: ScheduleRow
  teamAName: string
  teamBName: string
}
const revealListModal = reactive({
  open: false,
  league: null as LeagueRow | null,
  matches: [] as RevealListItem[],
  loading: false,
})

async function openRevealList(league: LeagueRow) {
  revealListModal.open = true
  revealListModal.league = league
  revealListModal.matches = []
  revealListModal.loading = true
  try {
    const [schedules, players, teamNames] = await Promise.all([
      getRevealedSchedules(league.id),
      getPlayers(),
      getTeamNames(league.id),
    ])
    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))
    const teamName = (id: number) => nameMap.get(id) || playerMap.get(id)?.nickname || `선수 ${id}`
    revealListModal.matches = schedules
      .filter(s => !s.is_completed)
      .map(s => ({
        schedule: s,
        teamAName: teamName(s.team_a_captain_id),
        teamBName: teamName(s.team_b_captain_id),
      }))
  } finally {
    revealListModal.loading = false
  }
}

// 엔트리 공개 내용 보기 모달
const revealModal = reactive({
  open: false,
  item: null as RevealListItem | null,
})

function openRevealEntry(item: RevealListItem) {
  revealModal.item = item
  revealModal.open = true
}

// 종료된 경기 목록 모달
interface ResultListItem extends RevealListItem {
  teamAWins: number
  teamBWins: number
}

const resultListModal = reactive({
  open: false,
  league: null as LeagueRow | null,
  matches: [] as ResultListItem[],
  loading: false,
})

// 리그 순위 모달
interface MatchResultItem {
  schedule: ScheduleRow
  opponentName: string
  myPoints: number
  oppPoints: number
  isWin: boolean
  teamAName: string
  teamBName: string
}

interface TeamStanding {
  captainId: number
  teamName: string
  wins: number
  losses: number
  matchPoints: number
  matches: MatchResultItem[]
}

const standingsModal = reactive({
  open: false,
  league: null as LeagueRow | null,
  standings: [] as TeamStanding[],
  loading: false,
})

async function openResultList(league: LeagueRow) {
  resultListModal.open = true
  resultListModal.league = league
  resultListModal.matches = []
  resultListModal.loading = true
  try {
    const [schedules, players, teamNames] = await Promise.all([
      getCompletedSchedules(league.id),
      getPlayers(),
      getTeamNames(league.id),
    ])

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))
    const teamName = (id: number) => nameMap.get(id) || playerMap.get(id)?.nickname || `선수 ${id}`

    const slotResults = schedules.length
      ? await getSlotResultsForSchedules(schedules.map(s => s.id))
      : []

    const slotsBySchedule = new Map<number, typeof slotResults>()
    for (const r of slotResults) {
      if (!slotsBySchedule.has(r.schedule_id)) slotsBySchedule.set(r.schedule_id, [])
      slotsBySchedule.get(r.schedule_id)!.push(r)
    }

    resultListModal.matches = schedules
      .slice()
      .sort((a, b) => {
        const da = a.match_date ?? '0000'
        const db = b.match_date ?? '0000'
        return da > db ? -1 : da < db ? 1 : b.id - a.id
      })
      .map(s => {
        const slots = slotsBySchedule.get(s.id) ?? []
        let winsA = 0, winsB = 0
        for (const slot of slots) {
          if (slot.winner_captain_id === s.team_a_captain_id) winsA++
          else if (slot.winner_captain_id === s.team_b_captain_id) winsB++
        }
        return {
          schedule: s,
          teamAName: teamName(s.team_a_captain_id),
          teamBName: teamName(s.team_b_captain_id),
          teamAWins: winsA,
          teamBWins: winsB,
        }
      })
  } finally {
    resultListModal.loading = false
  }
}

async function openStandingsList(league: LeagueRow) {
  standingsModal.open = true
  standingsModal.league = league
  standingsModal.standings = []
  standingsModal.loading = true
  try {
    const [schedules, captains, players, teamNames] = await Promise.all([
      getCompletedSchedules(league.id),
      getCaptains(league.id),
      getPlayers(),
      getTeamNames(league.id),
    ])

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))
    const teamName = (id: number) => nameMap.get(id) || playerMap.get(id)?.nickname || `선수 ${id}`

    const slotResults = schedules.length
      ? await getSlotResultsForSchedules(schedules.map(s => s.id))
      : []

    const slotsBySchedule = new Map<number, typeof slotResults>()
    for (const r of slotResults) {
      if (!slotsBySchedule.has(r.schedule_id)) slotsBySchedule.set(r.schedule_id, [])
      slotsBySchedule.get(r.schedule_id)!.push(r)
    }

    const standingsMap = new Map<number, TeamStanding>()
    for (const c of captains) {
      standingsMap.set(c.player_id, {
        captainId: c.player_id,
        teamName: teamName(c.player_id),
        wins: 0,
        losses: 0,
        matchPoints: 0,
        matches: [],
      })
    }

    for (const s of schedules) {
      const { team_a_captain_id: capA, team_b_captain_id: capB, winner_captain_id: winner } = s
      const slots = slotsBySchedule.get(s.id) ?? []

      let ptsA = 0, ptsB = 0
      for (const slot of slots) {
        const pts = MATCH_SLOT_POINTS[slot.slot_num] ?? 1
        if (slot.winner_captain_id === capA) ptsA += pts
        else if (slot.winner_captain_id === capB) ptsB += pts
      }

      const tNameA = teamName(capA)
      const tNameB = teamName(capB)

      if (standingsMap.has(capA)) {
        const st = standingsMap.get(capA)!
        winner === capA ? st.wins++ : st.losses++
        st.matchPoints += ptsA
        st.matches.push({ schedule: s, opponentName: tNameB, myPoints: ptsA, oppPoints: ptsB, isWin: winner === capA, teamAName: tNameA, teamBName: tNameB })
      }
      if (standingsMap.has(capB)) {
        const st = standingsMap.get(capB)!
        winner === capB ? st.wins++ : st.losses++
        st.matchPoints += ptsB
        st.matches.push({ schedule: s, opponentName: tNameA, myPoints: ptsB, oppPoints: ptsA, isWin: winner === capB, teamAName: tNameA, teamBName: tNameB })
      }
    }

    standingsModal.standings = [...standingsMap.values()].sort((a, b) =>
      b.matchPoints !== a.matchPoints ? b.matchPoints - a.matchPoints : b.wins - a.wins
    )
  } finally {
    standingsModal.loading = false
  }
}

// 결과 확인 모달
const resultModal = reactive({
  open: false,
  item: null as RevealListItem | null,
})

function openResultEntry(item: RevealListItem) {
  resultModal.item = item
  resultModal.open = true
}

// 엔트리 모달
const loadingEntry = ref(false)
const entrySaving = ref(false)
const entryError = ref<string | null>(null)

interface SlotMapInfo {
  id: string
  name: string
  thumbnail_url: string | null
}

interface EntryModalState {
  open: boolean
  schedule: ScheduleRow | null
  leagueId: string
  opponentTeamName: string
  teamMembers: PlayerRow[]
  selections: Record<number, number[]>
  slotMaps: Record<number, SlotMapInfo[]>   // match_slot → 맵 목록
  banSelections: Record<number, string | null>  // match_slot → banned_map_id
  aceTierBan: string | null
}
const entryModal = reactive<EntryModalState>({
  open: false,
  schedule: null,
  leagueId: '',
  opponentTeamName: '',
  teamMembers: [],
  selections: {},
  slotMaps: {},
  banSelections: {},
  aceTierBan: null,
})

// ── 데이터 로드 ──────────────────────────────────────────────
onMounted(async () => {
  const allLeagues = await getLeagues()
  leagues.value = allLeagues.filter(l => getLeagueStatus(l) === 'ongoing')
  loadingLeagues.value = false

  const discordId = auth.user?.identities?.find(i => i.provider === 'discord')?.id ?? ''
  if (!discordId) return

  const me = await getPlayerByDiscordId(discordId)
  if (!me) return
  myPlayerId.value = me.id

  // 팀장인 리그 파악
  const draftDoneLeagues = allLeagues.filter(l => l.draft_completed)
  await Promise.all(draftDoneLeagues.map(async l => {
    const captains = await getCaptains(l.id)
    if (captains.some(c => c.player_id === me.id)) {
      myCaptainLeagueIds.value.add(l.id)
    }
  }))

  // 엔트리 제출 현황
  entryStatusMap.value = await getEntryStatusMap(me.id)

  // 공개 동의 현황
  consentedSet.value = await getConsentedSet(me.id)
})

// ── 경기 목록 모달 ────────────────────────────────────────────
async function openMatchList(league: LeagueRow) {
  matchListModal.open = true
  matchListModal.league = league
  matchListModal.matches = []
  matchListModal.loading = true

  try {
    const [schedules, players, teamNames] = await Promise.all([
      getSchedules(league.id),
      getPlayers(),
      getTeamNames(league.id),
    ])

    const playerMap = new Map(players.map(p => [p.id, p]))
    const nameMap = new Map(teamNames.map(t => [t.captain_player_id, t.team_name]))
    const teamName = (id: number) => nameMap.get(id) || playerMap.get(id)?.nickname || `선수 ${id}`

    matchListModal.matches = schedules
      .filter(s => !s.is_completed && (s.team_a_captain_id === myPlayerId.value || s.team_b_captain_id === myPlayerId.value))
      .map(s => {
        const opponentId = s.team_a_captain_id === myPlayerId.value ? s.team_b_captain_id : s.team_a_captain_id
        return {
          schedule: s,
          leagueId: league.id,
          myTeamName: teamName(myPlayerId.value!),
          opponentTeamName: teamName(opponentId),
          myTeamCaptainId: myPlayerId.value!,
        }
      })
      .sort((a, b) => {
        const da = a.schedule.match_date ?? '9999'
        const db = b.schedule.match_date ?? '9999'
        return da < db ? -1 : da > db ? 1 : a.schedule.round - b.schedule.round
      })

  } finally {
    matchListModal.loading = false
  }
}

// ── 엔트리 모달 ───────────────────────────────────────────────
function initSelections() {
  const s: Record<number, number[]> = {}
  for (const slot of SLOT_CONFIG) s[slot.num] = Array(slot.count).fill(0)
  entryModal.selections = s
}

function getSlotPlayer(slotNum: number, idx: number): number {
  return entryModal.selections[slotNum]?.[idx] ?? 0
}

function setSlotPlayer(slotNum: number, idx: number, playerId: number) {
  if (!entryModal.selections[slotNum]) return
  entryModal.selections[slotNum][idx] = playerId
}

function buildOptions(slotNum: number, idx: number): SelectOption[] {
  const isTeam = slotNum === TEAM_SLOT
  return entryModal.teamMembers
    .filter(m => {
      if (isTeam) {
        const teamIds = entryModal.selections[TEAM_SLOT] ?? []
        return !teamIds.some((id, i) => id === m.id && i !== idx)
      } else {
        for (const s of INDIVIDUAL_SLOTS as readonly number[]) {
          if (s === slotNum) continue
          if ((entryModal.selections[s]?.[0] ?? 0) === m.id) return false
        }
        return true
      }
    })
    .map(m => ({
      value: m.id,
      label: m.nickname,
      tier: m.tier,
      race: m.race,
      points: TIER_POINTS[m.tier] ?? 0,
    }))
}

const playerTierMap = computed(() => {
  const m = new Map<number, string>()
  for (const p of entryModal.teamMembers) m.set(p.id, p.tier)
  return m
})

const individualPoints = computed(() =>
  (INDIVIDUAL_SLOTS as readonly number[]).reduce((sum, slotNum) => {
    const id = entryModal.selections[slotNum]?.[0] ?? 0
    return sum + (id ? TIER_POINTS[playerTierMap.value.get(id) ?? ''] ?? 0 : 0)
  }, 0)
)
const teamPoints = computed(() =>
  (entryModal.selections[TEAM_SLOT] ?? []).reduce((sum, id) =>
    sum + (id ? TIER_POINTS[playerTierMap.value.get(id) ?? ''] ?? 0 : 0), 0)
)
const totalPoints = computed(() => individualPoints.value + teamPoints.value)

async function openEntryModal(item: MyMatchItem) {
  entryModal.open = true
  entryModal.schedule = item.schedule
  entryModal.leagueId = item.leagueId
  entryModal.opponentTeamName = item.opponentTeamName
  entryModal.teamMembers = []
  entryModal.slotMaps = {}
  entryModal.banSelections = {}
  entryModal.aceTierBan = null
  entryError.value = null
  initSelections()
  loadingEntry.value = true

  try {
    const [captains, picks, swapLog, players, existing, matchMaps, allMaps, existingAceBan] = await Promise.all([
      getCaptains(item.leagueId),
      getDraftPicks(item.leagueId),
      getSwapLog(item.leagueId),
      getPlayers(),
      getEntries(item.schedule.id, item.myTeamCaptainId),
      getMatchMaps(item.leagueId),
      getMaps(),
      getAceTierBan(item.schedule.id, item.myTeamCaptainId),
    ])

    const mapInfoMap = new Map(allMaps.map(m => [m.id, m]))
    const slotMaps: Record<number, SlotMapInfo[]> = {}
    for (const mm of matchMaps) {
      slotMaps[mm.match_number] = mm.map_ids.map(id => {
        const m = mapInfoMap.get(id)
        return { id, name: m?.name ?? id, thumbnail_url: m?.thumbnail_url ?? null }
      })
    }
    entryModal.slotMaps = slotMaps

    // 밴 초기값
    const bans: Record<number, string | null> = {}
    for (const s of BAN_SLOTS) bans[s] = null
    entryModal.banSelections = bans

    const rosters = computeFinalRosters(captains, picks, swapLog)
    const myRoster = rosters.get(item.myTeamCaptainId) ?? []
    const playerMap = new Map(players.map(p => [p.id, p]))
    entryModal.teamMembers = myRoster.map(id => playerMap.get(id)).filter(Boolean) as PlayerRow[]

    if (existing.length) {
      for (const e of existing) {
        if (entryModal.selections[e.match_slot] !== undefined) {
          const len = entryModal.selections[e.match_slot].length
          for (let i = 0; i < len; i++) {
            entryModal.selections[e.match_slot][i] = e.player_ids[i] ?? 0
          }
        }
        if (e.banned_map_id && (BAN_SLOTS as readonly number[]).includes(e.match_slot)) {
          entryModal.banSelections[e.match_slot] = e.banned_map_id
        }
      }
    }
    entryModal.aceTierBan = existingAceBan
  } catch (e: any) {
    entryError.value = e.message ?? '데이터를 불러올 수 없습니다.'
  } finally {
    loadingEntry.value = false
  }
}

function closeEntryModal() {
  entryModal.open = false
}

function toggleBan(slotNum: number, mapId: string) {
  entryModal.banSelections[slotNum] = entryModal.banSelections[slotNum] === mapId ? null : mapId
}

async function handleEntrySubmit() {
  entryError.value = null

  for (const slot of SLOT_CONFIG) {
    const ids = entryModal.selections[slot.num] ?? []
    if (ids.some(id => !id)) {
      entryError.value = `경기${slot.num} 선수를 모두 선택해주세요.`
      return
    }
  }

  for (const slotNum of BAN_SLOTS) {
    const maps = entryModal.slotMaps[slotNum]
    if (maps && maps.length > 1 && !entryModal.banSelections[slotNum]) {
      entryError.value = `경기${slotNum}에서 밴할 맵을 선택해주세요.`
      return
    }
  }

  if (individualPoints.value > MAX_INDIVIDUAL_POINTS) {
    entryError.value = `개인전 포인트(${individualPoints.value})가 한도(${MAX_INDIVIDUAL_POINTS})를 초과했습니다.`
    return
  }
  if (teamPoints.value > MAX_TEAM_POINTS) {
    entryError.value = `팀전 포인트(${teamPoints.value})가 한도(${MAX_TEAM_POINTS})를 초과했습니다.`
    return
  }
  if (totalPoints.value > MAX_TOTAL_POINTS) {
    entryError.value = `전체 포인트(${totalPoints.value})가 한도(${MAX_TOTAL_POINTS})를 초과했습니다.`
    return
  }

  if (!entryModal.aceTierBan) {
    entryError.value = '에이스 결정전에서 밴할 티어를 선택해주세요.'
    return
  }

  entrySaving.value = true
  try {
    const slots: EntrySlot[] = SLOT_CONFIG.map(slot => ({
      match_slot: slot.num,
      player_ids: entryModal.selections[slot.num].filter(Boolean),
      banned_map_id: entryModal.banSelections[slot.num] ?? null,
    }))
    await Promise.all([
      saveEntries(entryModal.schedule!.id, myPlayerId.value!, slots),
      saveAceTierBan(entryModal.schedule!.id, myPlayerId.value!, entryModal.aceTierBan),
    ])
    entryStatusMap.value.set(entryModal.schedule!.id, 'saved')
    // 경기 목록 모달의 상태도 갱신
    const match = matchListModal.matches.find(m => m.schedule.id === entryModal.schedule!.id)
    if (match) entryStatusMap.value = new Map(entryStatusMap.value)
    closeEntryModal()
  } catch (e: any) {
    entryError.value = e.message ?? '제출 중 오류가 발생했습니다.'
  } finally {
    entrySaving.value = false
  }
}

async function handleConsentReveal(item: MyMatchItem) {
  if (!myPlayerId.value) return
  const scheduleId = item.schedule.id
  consentingId.value = scheduleId
  try {
    await consentReveal(scheduleId, myPlayerId.value)
    consentedSet.value = new Set([...consentedSet.value, scheduleId])

    const bothConsented = await checkBothConsented(
      scheduleId,
      item.schedule.team_a_captain_id,
      item.schedule.team_b_captain_id,
    )
    if (bothConsented) {
      await revealEntries(scheduleId)
    }
  } catch (e: any) {
    alert(e.message ?? '동의 처리 중 오류가 발생했습니다.')
  } finally {
    consentingId.value = null
  }
}

async function handleSubmitEntry(scheduleId: number) {
  if (!myPlayerId.value) return
  submittingId.value = scheduleId
  try {
    await submitEntry(scheduleId, myPlayerId.value)
    entryStatusMap.value = new Map(entryStatusMap.value).set(scheduleId, 'submitted')

    const match = matchListModal.matches.find(m => m.schedule.id === scheduleId)
    if (match) {
      notifyEntrySubmitted({
        leagueName: matchListModal.league?.name ?? '',
        teamName: match.myTeamName,
        matchRound: `${match.schedule.round}라운드`,
        matchDate: match.schedule.match_date,
      })
    }
  } catch (e: any) {
    alert(e.message ?? '제출 중 오류가 발생했습니다.')
  } finally {
    submittingId.value = null
  }
}

function statusLabel(status: LeagueStatus) {
  return { ongoing: '진행중', upcoming: '예정', preparing: '준비중', finished: '종료' }[status]
}
function eligibilityLabel(type: EligibilityType) {
  return { open: '누구나', application: '신청제', invitation: '초대제' }[type]
}
</script>

<style lang="scss" scoped>
@use './ParticipateView.scss';
</style>
