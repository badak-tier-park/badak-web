<template>
  <div class="hof-page">
    <AppHeader />

    <div class="hof-content">
      <button class="btn-back" @click="$router.back()">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        이전
      </button>
      <div class="hof-hero">
        <h1 class="hof-title">명예의 전당</h1>
        <p class="hof-subtitle">바닥리그 역대 기록</p>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>

      <template v-else>
        <!-- ── 리그별 우승 기록 ── -->
        <section v-if="leagueAwards.length" class="hof-section">
          <div class="hof-section-header">
            <h2 class="hof-section-title">리그 우승 기록</h2>
          </div>
          <div class="hof-leagues">
            <div v-for="award in leagueAwards" :key="award.leagueId" class="hof-league-card">
              <div class="hof-league-name">{{ award.leagueName }}</div>
              <div class="hof-league-awards">
                <div v-if="award.champion" class="hof-team-block hof-team-block--champion">
                  <div class="hof-team-header">
                    <span class="hof-place-icon">🏆</span>
                    <span class="hof-place-label hof-place-label--champion">우승</span>
                    <span class="hof-team-name" :class="`tier-badge--${award.champion.captainTier.toLowerCase()}`">
                      {{ award.champion.teamName }}
                    </span>
                    <button class="hof-members-toggle" @click="toggleMembers(award.leagueId, 'champion')">
                      {{ expandedMembers.has(award.leagueId + '_champion') ? '접기' : '팀원 보기' }}
                    </button>
                  </div>
                  <div v-if="expandedMembers.has(award.leagueId + '_champion')" class="hof-members">
                    <span
                      v-for="m in award.champion.members"
                      :key="m.id"
                      class="hof-member-chip"
                      :class="`tier-badge--${m.tier.toLowerCase()}`"
                    >
                      <span v-if="m.race" class="hof-member-race" :class="`race-badge--${m.race.toLowerCase()}`">{{ m.race.toUpperCase() }}</span>
                      {{ m.nickname }}
                    </span>
                  </div>
                </div>
                <div v-if="award.runnerUp" class="hof-team-block hof-team-block--runner-up">
                  <div class="hof-team-header">
                    <span class="hof-place-icon">🥈</span>
                    <span class="hof-place-label hof-place-label--runner-up">준우승</span>
                    <span class="hof-team-name" :class="`tier-badge--${award.runnerUp.captainTier.toLowerCase()}`">
                      {{ award.runnerUp.teamName }}
                    </span>
                    <button class="hof-members-toggle" @click="toggleMembers(award.leagueId, 'runner-up')">
                      {{ expandedMembers.has(award.leagueId + '_runner-up') ? '접기' : '팀원 보기' }}
                    </button>
                  </div>
                  <div v-if="expandedMembers.has(award.leagueId + '_runner-up')" class="hof-members">
                    <span
                      v-for="m in award.runnerUp.members"
                      :key="m.id"
                      class="hof-member-chip"
                      :class="`tier-badge--${m.tier.toLowerCase()}`"
                    >
                      <span v-if="m.race" class="hof-member-race" :class="`race-badge--${m.race.toLowerCase()}`">{{ m.race.toUpperCase() }}</span>
                      {{ m.nickname }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- ── 역대 수상 기록 ── -->
        <section v-if="awardRecords.length" class="hof-section">
          <div class="hof-section-header">
            <h2 class="hof-section-title">역대 수상 기록</h2>
          </div>
          <div class="hof-award-records">
            <div v-for="(rec, idx) in pagedAwardRecords" :key="rec.playerId" class="hof-ar-row">
              <span class="hof-ar-rank">{{ (pageAwards - 1) * PAGE_SIZE + idx + 1 }}</span>
              <span class="hof-ar-name">{{ rec.nickname }}</span>
              <div class="hof-ar-medals">
                <span v-if="rec.championCount" class="hof-ar-medal hof-ar-medal--champion">🏆 {{ rec.championCount }}회</span>
                <span v-if="rec.runnerUpCount" class="hof-ar-medal hof-ar-medal--runner-up">🥈 {{ rec.runnerUpCount }}회</span>
              </div>
            </div>
          </div>
          <div v-if="totalPagesAwards > 1" class="hof-pagination">
            <button class="hof-page-btn" :disabled="pageAwards === 1" @click="pageAwards--">‹</button>
            <span class="hof-page-info">{{ pageAwards }} / {{ totalPagesAwards }}</span>
            <button class="hof-page-btn" :disabled="pageAwards === totalPagesAwards" @click="pageAwards++">›</button>
          </div>
        </section>

        <!-- ── 개인 전적 ── -->
        <section class="hof-section">
          <div class="hof-section-header">
            <h2 class="hof-section-title">개인 전적</h2>
            <input
              v-model="searchQuery"
              class="hof-search"
              type="text"
              placeholder="선수 검색"
              @input="pagePlayers = 1"
            />
          </div>
          <div v-if="!filteredPlayerEntries.length" class="state-msg-inline">검색 결과가 없습니다.</div>
          <template v-else>
            <div class="hof-table-header">
              <span class="hof-th hof-th--rank">#</span>
              <span class="hof-th hof-th--name">선수</span>
              <button class="hof-th hof-th--record hof-th--sortable" :class="{ 'hof-th--active': sortKey === 'wins' }" @click="setSortKey('wins')">
                전적
                <span class="hof-sort-icon" :class="{ 'hof-sort-icon--active': sortKey === 'wins' }">
                  {{ sortKey === 'wins' ? (sortDir === 'desc' ? '↓' : '↑') : '↕' }}
                </span>
              </button>
              <button class="hof-th hof-th--rate hof-th--sortable" :class="{ 'hof-th--active': sortKey === 'winRate' }" @click="setSortKey('winRate')">
                승률
                <span class="hof-sort-icon" :class="{ 'hof-sort-icon--active': sortKey === 'winRate' }">
                  {{ sortKey === 'winRate' ? (sortDir === 'desc' ? '↓' : '↑') : '↕' }}
                </span>
              </button>
              <span class="hof-th hof-th--award">수상</span>
            </div>
            <div
              v-for="(entry, idx) in pagedPlayerEntries"
              :key="entry.playerId"
              class="hof-row"
            >
              <span class="hof-td hof-td--rank">{{ filteredStartIdx + idx + 1 }}</span>
              <div class="hof-td hof-td--name">
                <span class="hof-player-name">{{ entry.nickname }}</span>
              </div>
              <div class="hof-td hof-td--record">
                <span class="hof-wins">{{ entry.wins }}승</span>
                <span class="hof-losses">{{ entry.losses }}패</span>
              </div>
              <span class="hof-td hof-td--rate" :class="rateClass(entry.winRate)">
                {{ entry.wins + entry.losses > 0 ? (entry.winRate * 100).toFixed(0) + '%' : '-' }}
              </span>
              <div class="hof-td hof-td--award">
                <template v-if="entry.awards.length">
                  <span v-if="champCount(entry) > 0" class="hof-badge hof-badge--champion">🏆 {{ champCount(entry) }}회</span>
                  <span v-if="ruCount(entry) > 0" class="hof-badge hof-badge--runner-up">🥈 {{ ruCount(entry) }}회</span>
                </template>
              </div>
            </div>
            <div v-if="totalPagesPlayers > 1" class="hof-pagination">
              <button class="hof-page-btn" :disabled="pagePlayers === 1" @click="pagePlayers--">‹</button>
              <span class="hof-page-info">{{ pagePlayers }} / {{ totalPagesPlayers }}</span>
              <button class="hof-page-btn" :disabled="pagePlayers === totalPagesPlayers" @click="pagePlayers++">›</button>
            </div>
          </template>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { getLeagues } from '@/lib/leagues'
import { getPlayers } from '@/lib/players'
import { getAllCompletedSchedules, getSlotResultsForSchedules } from '@/lib/schedules'
import { getAllTeamNames } from '@/lib/teamNames'
import { getEntriesForSchedules } from '@/lib/entries'
import { getDraftPicks, getSwapLog } from '@/lib/draft'
import { getCaptains } from '@/lib/leagueDetail'
import { computeFinalRosters } from '@/lib/entries'

interface MemberInfo { id: number; nickname: string; tier: string; race: string }

interface TeamAward {
  captainId: number
  captainTier: string
  teamName: string
  members: MemberInfo[]
}

interface LeagueAward {
  leagueId: string
  leagueName: string
  champion: TeamAward | null
  runnerUp: TeamAward | null
}

interface AwardRecord {
  leagueId: string
  leagueName: string
  place: 'champion' | 'runner-up'
}

interface AwardRecordSummary {
  playerId: number
  nickname: string
  championCount: number
  runnerUpCount: number
}

const TIER_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }

interface PlayerEntry {
  playerId: number
  nickname: string
  tier: string
  wins: number
  losses: number
  winRate: number
  awards: AwardRecord[]
}

const PAGE_SIZE = 10

const loading = ref(true)
const leagueAwards = ref<LeagueAward[]>([])
const playerEntries = ref<PlayerEntry[]>([])
const awardRecords = ref<AwardRecordSummary[]>([])
const expandedMembers = ref(new Set<string>())
const searchQuery = ref('')
const pageAwards = ref(1)
const pagePlayers = ref(1)
const sortKey = ref<'wins' | 'winRate' | 'default'>('default')
const sortDir = ref<'asc' | 'desc'>('desc')

function setSortKey(key: 'wins' | 'winRate') {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    sortKey.value = key
    sortDir.value = 'desc'
  }
  pagePlayers.value = 1
}

const pagedAwardRecords = computed(() => {
  const start = (pageAwards.value - 1) * PAGE_SIZE
  return awardRecords.value.slice(start, start + PAGE_SIZE)
})
const totalPagesAwards = computed(() => Math.ceil(awardRecords.value.length / PAGE_SIZE))

const filteredPlayerEntries = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const base = q ? playerEntries.value.filter(e => e.nickname.toLowerCase().includes(q)) : playerEntries.value
  if (sortKey.value === 'default') return base
  const mul = sortDir.value === 'desc' ? -1 : 1
  return [...base].sort((a, b) => {
    const av = sortKey.value === 'wins' ? a.wins : a.winRate
    const bv = sortKey.value === 'wins' ? b.wins : b.winRate
    return (av - bv) * mul
  })
})
const filteredStartIdx = computed(() => (pagePlayers.value - 1) * PAGE_SIZE)
const pagedPlayerEntries = computed(() => {
  const start = filteredStartIdx.value
  return filteredPlayerEntries.value.slice(start, start + PAGE_SIZE)
})
const totalPagesPlayers = computed(() => Math.ceil(filteredPlayerEntries.value.length / PAGE_SIZE))

const champCount = (e: PlayerEntry) => e.awards.filter(a => a.place === 'champion').length
const ruCount = (e: PlayerEntry) => e.awards.filter(a => a.place === 'runner-up').length

function toggleMembers(leagueId: string, place: string) {
  const key = leagueId + '_' + place
  if (expandedMembers.value.has(key)) expandedMembers.value.delete(key)
  else expandedMembers.value.add(key)
  expandedMembers.value = new Set(expandedMembers.value)
}

function rateClass(rate: number): string {
  if (rate >= 0.7) return 'hof-rate--high'
  if (rate >= 0.5) return 'hof-rate--mid'
  return 'hof-rate--low'
}

onMounted(async () => {
  try {
    const [leagues, players, schedules, teamNames] = await Promise.all([
      getLeagues(),
      getPlayers(),
      getAllCompletedSchedules(),
      getAllTeamNames(),
    ])

    const playerMap = new Map(players.map(p => [p.id, p]))
    const leagueMap = new Map(leagues.map(l => [l.id, l]))
    const teamNameMap = new Map(teamNames.map(t => [`${t.league_id}_${t.captain_player_id}`, t.team_name]))

    // 리그별 일정 분류
    const schedulesByLeague = new Map<string, typeof schedules>()
    for (const s of schedules) {
      if (!schedulesByLeague.has(s.league_id)) schedulesByLeague.set(s.league_id, [])
      schedulesByLeague.get(s.league_id)!.push(s)
    }

    // 리그별 우승/준우승 captain ID 파악
    const championByLeague = new Map<string, { championId: number; runnerUpId: number }>()
    for (const [leagueId, lScheds] of schedulesByLeague) {
      let championId: number | null = null
      let runnerUpId: number | null = null
      const superAce = lScheds.find(s => s.match_type === 'super_ace')
      if (superAce?.winner_captain_id) {
        championId = superAce.winner_captain_id
        runnerUpId = superAce.team_a_captain_id === championId ? superAce.team_b_captain_id : superAce.team_a_captain_id
      } else {
        const set1 = lScheds.find(s => s.match_type === 'final_set1')
        const set2 = lScheds.find(s => s.match_type === 'final_set2')
        if (set1?.winner_captain_id && set2?.winner_captain_id && set1.winner_captain_id === set2.winner_captain_id) {
          championId = set1.winner_captain_id
          runnerUpId = set1.team_a_captain_id === championId ? set1.team_b_captain_id : set1.team_a_captain_id
        }
      }
      if (championId && runnerUpId) championByLeague.set(leagueId, { championId, runnerUpId })
    }

    // playerId → AwardRecord[]
    const awardsByPlayer = new Map<number, AwardRecord[]>()
    const addAward = (playerId: number, rec: AwardRecord) => {
      if (!awardsByPlayer.has(playerId)) awardsByPlayer.set(playerId, [])
      awardsByPlayer.get(playerId)!.push(rec)
    }

    // 리그 어워드 카드 구성 (로스터 포함)
    const awards: LeagueAward[] = []
    for (const [leagueId, result] of championByLeague) {
      const league = leagueMap.get(leagueId)
      if (!league) continue

      const [captains, draftPicks, swapLog] = await Promise.all([
        getCaptains(leagueId),
        getDraftPicks(leagueId),
        getSwapLog(leagueId),
      ])

      const finalRosters = computeFinalRosters(captains, draftPicks, swapLog)

      const makeTeamAward = (captainId: number): TeamAward => {
        const rawIds = finalRosters.get(captainId) ?? [captainId]
        const memberIds = [...new Set(rawIds)] // 중복 제거 (captain이 draft pick에 포함된 경우)
        const members: MemberInfo[] = memberIds
          .map(id => {
            const p = playerMap.get(id)
            return { id, nickname: p?.nickname ?? `선수 ${id}`, tier: p?.tier ?? 'e', race: p?.race ?? '' }
          })
          .sort((a, b) => (TIER_RANK[b.tier.toUpperCase()] ?? 0) - (TIER_RANK[a.tier.toUpperCase()] ?? 0))
        const captain = playerMap.get(captainId)
        return {
          captainId,
          captainTier: captain?.tier ?? 'e',
          teamName: teamNameMap.get(`${leagueId}_${captainId}`) || captain?.nickname || `선수 ${captainId}`,
          members,
        }
      }

      const championTeam = makeTeamAward(result.championId)
      const runnerUpTeam = makeTeamAward(result.runnerUpId)

      awards.push({
        leagueId,
        leagueName: league.name,
        champion: championTeam,
        runnerUp: runnerUpTeam,
      })

      // 수상 기록 등록 (팀 멤버 전체)
      for (const m of championTeam.members) addAward(m.id, { leagueId, leagueName: league.name, place: 'champion' })
      for (const m of runnerUpTeam.members) addAward(m.id, { leagueId, leagueName: league.name, place: 'runner-up' })
    }

    // 최신 리그 순으로 정렬
    leagueAwards.value = awards.sort((a, b) => {
      const la = leagueMap.get(a.leagueId)?.created_at ?? ''
      const lb = leagueMap.get(b.leagueId)?.created_at ?? ''
      return lb.localeCompare(la)
    })

    // 개인 전적: 슬롯 결과 × 엔트리 매칭
    const allScheduleIds = schedules.map(s => s.id)
    const [slotResults, allEntries] = await Promise.all([
      getSlotResultsForSchedules(allScheduleIds),
      getEntriesForSchedules(allScheduleIds),
    ])

    // (scheduleId, slot, captainId) → playerIds 맵
    const entryKey = (sid: number, slot: number, cid: number) => `${sid}_${slot}_${cid}`
    const entryPlayerMap = new Map<string, number[]>()
    for (const e of allEntries) {
      entryPlayerMap.set(entryKey(e.schedule_id, e.match_slot, e.captain_player_id), e.player_ids)
    }

    const winsMap = new Map<number, number>()
    const lossesMap = new Map<number, number>()
    const markResult = (playerId: number, win: boolean) => {
      if (win) winsMap.set(playerId, (winsMap.get(playerId) ?? 0) + 1)
      else lossesMap.set(playerId, (lossesMap.get(playerId) ?? 0) + 1)
    }

    for (const slot of slotResults) {
      const sched = schedules.find(s => s.id === slot.schedule_id)
      if (!sched || slot.winner_captain_id == null) continue

      if (slot.slot_num === 7) {
        // 에이스 결정전: ace_player_a_id / ace_player_b_id
        const winnerIsA = slot.winner_captain_id === sched.team_a_captain_id
        if (slot.ace_player_a_id) markResult(slot.ace_player_a_id, winnerIsA)
        if (slot.ace_player_b_id) markResult(slot.ace_player_b_id, !winnerIsA)
        continue
      }

      const winnerCaptId = slot.winner_captain_id
      const loserCaptId = winnerCaptId === sched.team_a_captain_id ? sched.team_b_captain_id : sched.team_a_captain_id

      // 교체 선수 우선, 없으면 원래 엔트리
      const winnerIds = slot.sub_player_a_ids && winnerCaptId === sched.team_a_captain_id
        ? slot.sub_player_a_ids
        : slot.sub_player_b_ids && winnerCaptId === sched.team_b_captain_id
          ? slot.sub_player_b_ids
          : entryPlayerMap.get(entryKey(slot.schedule_id, slot.slot_num, winnerCaptId)) ?? []

      const loserIds = slot.sub_player_a_ids && loserCaptId === sched.team_a_captain_id
        ? slot.sub_player_a_ids
        : slot.sub_player_b_ids && loserCaptId === sched.team_b_captain_id
          ? slot.sub_player_b_ids
          : entryPlayerMap.get(entryKey(slot.schedule_id, slot.slot_num, loserCaptId)) ?? []

      for (const id of winnerIds) markResult(id, true)
      for (const id of loserIds) markResult(id, false)
    }

    // 전적이 있는 모든 선수 집합
    const allPlayerIds = new Set([...winsMap.keys(), ...lossesMap.keys()])
    const result: PlayerEntry[] = []
    for (const playerId of allPlayerIds) {
      const p = playerMap.get(playerId)
      const wins = winsMap.get(playerId) ?? 0
      const losses = lossesMap.get(playerId) ?? 0
      const total = wins + losses
      result.push({
        playerId,
        nickname: p?.nickname ?? `선수 ${playerId}`,
        tier: p?.tier ?? 'e',
        wins,
        losses,
        winRate: total > 0 ? wins / total : 0,
        awards: awardsByPlayer.get(playerId) ?? [],
      })
    }

    playerEntries.value = result.sort((a, b) => {
      const aChamp = a.awards.filter(x => x.place === 'champion').length
      const bChamp = b.awards.filter(x => x.place === 'champion').length
      if (bChamp !== aChamp) return bChamp - aChamp
      if (b.awards.length !== a.awards.length) return b.awards.length - a.awards.length
      if (b.wins !== a.wins) return b.wins - a.wins
      return a.losses - b.losses
    })

    // 역대 수상 기록 집계 (수상 경험자만, 메달 수 많은 순)
    awardRecords.value = [...awardsByPlayer.entries()]
      .map(([playerId, awards]) => ({
        playerId,
        nickname: playerMap.get(playerId)?.nickname ?? `선수 ${playerId}`,
        championCount: awards.filter(a => a.place === 'champion').length,
        runnerUpCount: awards.filter(a => a.place === 'runner-up').length,
      }))
      .sort((a, b) => {
        if (b.championCount !== a.championCount) return b.championCount - a.championCount
        return b.runnerUpCount - a.runnerUpCount
      })
  } finally {
    loading.value = false
  }
})
</script>

<style lang="scss" scoped>
@use './HallOfFameView.scss';
</style>
