<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <div class="modal modal--lg modal--full-mobile poll-modal">
        <div class="modal-header">
          <div>
            <p class="modal-title">{{ detail ? '팀 투표' : '팀 투표 · 경기 목록' }}</p>
            <p class="modal-subtitle">
              {{ league.name }}<span v-if="myTeamName"> · {{ myTeamName }}</span>
              <template v-if="detail"> · {{ detail.label }} vs {{ detail.opponentName }}</template>
            </p>
          </div>
          <button class="modal-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-body poll-body">
          <div v-if="loading" class="state-msg">불러오는 중...</div>
          <div v-else-if="loadError" class="state-msg state-msg--error">{{ loadError }}</div>
          <div v-else-if="myCaptainId === null" class="state-msg">이 리그에서 소속 팀을 찾을 수 없습니다.</div>

          <!-- ── 경기 목록 ───────────────────────────────────── -->
          <template v-else-if="!detail">
            <p class="poll-hint">
              나가고 싶은 경기에 ✓ 체크하면 팀장·부팀장이 엔트리를 짤 때 참고합니다. 결정이 아니라 참고용이며,
              엔트리를 제출하면 그 경기 투표는 자동으로 마감됩니다.
            </p>
            <div v-if="!matches.length" class="state-msg">투표할 수 있는 경기가 없습니다.</div>
            <div v-for="m in matches" :key="m.schedule.id" class="poll-match">
              <div class="poll-match-info">
                <span class="round-tag">{{ m.label }}</span>
                <span class="poll-match-vs">vs {{ m.opponentName }}</span>
                <span class="poll-match-date">{{ m.schedule.match_date ? m.schedule.match_date.replaceAll('-', '/') : '날짜 미정' }}</span>
              </div>
              <div class="poll-match-actions">
                <template v-if="!m.poll">
                  <span class="poll-state">투표 없음</span>
                  <button
                    v-if="isLeader"
                    class="btn-pill btn-pill--md btn-pill--purple"
                    :disabled="busyId === m.schedule.id"
                    @click="handleOpen(m)"
                  >{{ busyId === m.schedule.id ? '...' : '투표 열기' }}</button>
                </template>
                <template v-else>
                  <span class="poll-state" :class="m.poll.status === 'open' ? 'poll-state--open' : 'poll-state--closed'">
                    {{ m.poll.status === 'open' ? '투표 중' : (m.poll.closed_reason === 'entry_submitted' ? '마감 (엔트리 제출)' : '마감') }}
                  </span>
                  <span class="poll-state">{{ voterCount(m.poll.id) }}명 참여</span>
                  <button class="btn-pill btn-pill--md btn-pill--purple" @click="openDetail(m)">
                    {{ m.poll.status === 'open' ? '투표하기' : '결과 보기' }}
                  </button>
                </template>
              </div>
            </div>
            <p v-if="actionError" class="save-error">{{ actionError }}</p>
          </template>

          <!-- ── 투표 화면 ───────────────────────────────────── -->
          <template v-else>
            <div class="poll-detail-bar">
              <button class="btn-pill btn-pill--sm btn-pill--ghost" @click="closeDetail">← 목록</button>
              <span class="poll-state" :class="detail.poll.status === 'open' ? 'poll-state--open' : 'poll-state--closed'">
                {{ detail.poll.status === 'open' ? '투표 중' : '마감됨' }}
              </span>
              <template v-if="isLeader">
                <button
                  v-if="detail.poll.status === 'open'"
                  class="btn-pill btn-pill--sm btn-pill--red btn-pill--silent"
                  :disabled="busyId === detail.schedule.id"
                  @click="handleToggleStatus(false)"
                >투표 마감</button>
                <button
                  v-else-if="canReopen(detail.schedule)"
                  class="btn-pill btn-pill--sm btn-pill--green"
                  :disabled="busyId === detail.schedule.id"
                  @click="handleToggleStatus(true)"
                >다시 열기</button>
                <span v-else class="poll-reopen-note">엔트리 제출 후에는 다시 열 수 없습니다 (제출 취소 시 가능)</span>
              </template>
            </div>

            <div class="poll-slots">
              <div v-for="slot in POLL_SLOTS" :key="slot" class="poll-slot" :class="{ 'poll-slot--on': draft[slot]?.on }">
                <!-- 투표 중이면 머리줄 전체가 ✓ 토글 — 작은 원만 누르게 하면 휴대폰에서 빗나간다 -->
                <button
                  v-if="detail.poll.status === 'open'"
                  type="button"
                  class="poll-slot-head poll-slot-head--toggle"
                  :aria-pressed="!!draft[slot]?.on"
                  :aria-label="`${slot}경기 나가고 싶음`"
                  title="나가고 싶음"
                  @click="toggleSlot(slot)"
                >
                  <span class="slot-num">{{ slot }}</span>
                  <span class="slot-type-badge" :class="{ 'slot-type-badge--team': slot === 4 }">
                    {{ slot === 4 ? '팀전' : '개인전' }}
                  </span>
                  <span class="poll-check" :class="{ 'poll-check--on': draft[slot]?.on }" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2.5 7.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  </span>
                </button>
                <div v-else class="poll-slot-head">
                  <span class="slot-num">{{ slot }}</span>
                  <span class="slot-type-badge" :class="{ 'slot-type-badge--team': slot === 4 }">
                    {{ slot === 4 ? '팀전' : '개인전' }}
                  </span>
                </div>

                <!-- 맵 (썸네일 + 이름) -->
                <div v-if="slotMapIds(slot).length" class="poll-slot-maps">
                  <span v-for="id in slotMapIds(slot)" :key="id" class="map-chip">
                    <img v-if="mapThumb(id)" :src="mapThumb(id)!" class="map-chip-img" alt="" />
                    <span v-else class="map-chip-img map-chip-img--empty" />
                    <span class="map-chip-name">{{ mapName(id) }}</span>
                  </span>
                </div>

                <!-- 2·3경기: 내가 나가면 밴·픽 (필수) -->
                <div v-if="detail.poll.status === 'open' && draft[slot]?.on && needsBanPick(slot)" class="poll-banpick">
                  <p class="poll-banpick-hint">내가 이 경기에 나갈 때의 밴·픽 (둘 다 필수)</p>
                  <div v-for="id in slotMapIds(slot)" :key="id" class="poll-banpick-row">
                    <span class="map-chip">
                      <img v-if="mapThumb(id)" :src="mapThumb(id)!" class="map-chip-img" alt="" />
                      <span v-else class="map-chip-img map-chip-img--empty" />
                      <span class="map-chip-name">{{ mapName(id) }}</span>
                    </span>
                    <button
                      type="button" class="poll-bp-btn poll-bp-btn--ban"
                      :class="{ 'poll-bp-btn--active': draft[slot].ban === id }"
                      :disabled="draft[slot].pick === id"
                      @click="setBan(slot, id)"
                    >{{ draft[slot].ban === id ? '밴 취소' : '밴' }}</button>
                    <button
                      type="button" class="poll-bp-btn poll-bp-btn--pick"
                      :class="{ 'poll-bp-btn--active': draft[slot].pick === id }"
                      :disabled="draft[slot].ban === id"
                      @click="setPick(slot, id)"
                    >{{ draft[slot].pick === id ? '픽 취소' : '픽' }}</button>
                  </div>
                </div>

                <!-- 지원자 (누가 골랐는지) -->
                <div class="poll-voters">
                  <span v-if="!voters(slot).length" class="poll-voters-empty">지원자 없음</span>
                  <span v-for="v in voters(slot)" :key="v.user_id" class="poll-voter" :class="{ 'poll-voter--me': v.user_id === myPlayerId }">
                    <span class="poll-voter-nick">{{ playerName(v.user_id) }}</span>
                    <RaceBadge :race="playerRace(v.user_id)" size="sm" />
                    <TierBadge :tier="playerTier(v.user_id)" size="sm" />
                    <span v-if="v.ban_map_id" class="poll-voter-bp">밴 {{ mapName(v.ban_map_id) }}</span>
                    <span v-if="v.pick_map_id" class="poll-voter-bp">픽 {{ mapName(v.pick_map_id) }}</span>
                  </span>
                </div>
              </div>
            </div>

            <p class="poll-novote">
              투표하지 않은 팀원: {{ nonVoters.length ? nonVoters.join(', ') : '없음' }}
            </p>
            <p v-if="saveError" class="save-error">{{ saveError }}</p>
          </template>
        </div>

        <div v-if="detail && detail.poll.status === 'open'" class="modal-footer">
          <div class="modal-actions">
            <button class="btn-cancel" :disabled="saving" @click="closeDetail">닫기</button>
            <button class="btn-confirm" :disabled="saving || !!draftProblem" :title="draftProblem ?? ''" @click="handleSave">
              {{ saving ? '저장 중...' : '투표 저장' }}
            </button>
          </div>
          <p v-if="draftProblem" class="poll-problem">{{ draftProblem }}</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { getCaptains, getMatchMaps, getLeaguePlayers } from '@/lib/leagueDetail'
import { getDraftPicks } from '@/lib/draft'
import { getSchedules, type ScheduleRow } from '@/lib/schedules'
import { getTeamNames } from '@/lib/teamNames'
import { getMaps, type MapRow } from '@/lib/maps'
import { computeFinalRosters, getEntryStatusMap } from '@/lib/entries'
import type { LeagueRow } from '@/lib/leagues'
import type { PlayerRow } from '@/lib/players'
import {
  getTeamPolls, getTeamPollVotes, openTeamPoll, setTeamPollOpen, saveMyTeamPollVotes,
  votersBySlot, POLL_SLOTS, POLL_BAN_SLOTS,
  type TeamPoll, type TeamPollVote,
} from '@/lib/teamPolls'
import RaceBadge from '@/components/RaceBadge.vue'
import TierBadge from '@/components/TierBadge.vue'

const props = defineProps<{
  league: LeagueRow
  myPlayerId: number
  /** 알림에서 들어온 경우 바로 열 경기 */
  focusScheduleId?: number | null
}>()
defineEmits<{ close: [] }>()

interface PollMatch {
  schedule: ScheduleRow
  label: string
  opponentName: string
  poll: TeamPoll | null
}

const loading = ref(true)
const loadError = ref<string | null>(null)
const myCaptainId = ref<number | null>(null)
const isLeader = ref(false)
const myTeamName = ref('')
const rosterIds = ref<number[]>([])
const matches = ref<PollMatch[]>([])
const players = ref(new Map<number, PlayerRow>())
const mapsById = ref(new Map<string, MapRow>())
const matchMapIds = ref(new Map<number, string[]>())
const votes = ref<TeamPollVote[]>([])
const busyId = ref<number | null>(null)
/** 우리 팀이 엔트리를 제출한 경기 — 다시 열기는 제출 전·공개 전에만(서버 set_team_poll_status도 같은 조건으로 막는다) */
const submittedScheduleIds = ref(new Set<number>())
const actionError = ref<string | null>(null)

function matchLabel(s: ScheduleRow): string {
  if (s.match_type === 'regular') return `${s.round}라운드`
  return ({ semifinal: '준결승', final_set1: '결승 1세트', final_set2: '결승 2세트', super_ace: '슈퍼에이스' } as Record<string, string>)[s.match_type] ?? s.match_type
}

const playerName = (id: number) => players.value.get(id)?.nickname ?? `선수 ${id}`
const playerRace = (id: number) => players.value.get(id)?.race ?? ''
const playerTier = (id: number) => players.value.get(id)?.tier ?? ''
const mapName = (id: string) => mapsById.value.get(id)?.name ?? '(알 수 없는 맵)'
const mapThumb = (id: string) => mapsById.value.get(id)?.thumbnail_url ?? null
const slotMapIds = (slot: number) => matchMapIds.value.get(slot) ?? []
// 엔트리 창의 밴·픽 조건과 같다 — 2·3경기이고 맵이 2개 이상
const needsBanPick = (slot: number) =>
  (POLL_BAN_SLOTS as readonly number[]).includes(slot) && slotMapIds(slot).length > 1

async function load() {
  loading.value = true
  loadError.value = null
  try {
    const [captains, pl, teamNames, picks, schedules, mm, maps] = await Promise.all([
      getCaptains(props.league.id),
      getLeaguePlayers(props.league.id),
      getTeamNames(props.league.id),
      getDraftPicks(props.league.id),
      getSchedules(props.league.id),
      getMatchMaps(props.league.id),
      getMaps(),
    ])
    players.value = new Map(pl.map(p => [p.id, p]))
    mapsById.value = new Map(maps.map(m => [m.id, m]))
    matchMapIds.value = new Map(mm.map(r => [r.match_number, r.map_ids]))

    const rosters = computeFinalRosters(captains, picks)
    let mine: number | null = null
    for (const [captainId, ids] of rosters) {
      if (ids.includes(props.myPlayerId)) mine = captainId
    }
    myCaptainId.value = mine
    if (mine === null) return

    rosterIds.value = rosters.get(mine) ?? []
    const nameOf = (captainId: number) =>
      teamNames.find(t => t.captain_player_id === captainId)?.team_name
      || playerName(captainId)
    myTeamName.value = nameOf(mine)
    const myTn = teamNames.find(t => t.captain_player_id === mine)
    isLeader.value = mine === props.myPlayerId || myTn?.vice_captain_player_id === props.myPlayerId

    const mySchedules = schedules
      .filter(s => !s.is_completed && !s.is_entry_revealed && s.match_type !== 'super_ace'
        && (s.team_a_captain_id === mine || s.team_b_captain_id === mine))
      .sort((a, b) => {
        const da = a.match_date ?? '9999'
        const db = b.match_date ?? '9999'
        return da < db ? -1 : da > db ? 1 : a.round - b.round
      })
    const polls = (await getTeamPolls(mySchedules.map(s => s.id))).filter(p => p.captain_player_id === mine)
    votes.value = await getTeamPollVotes(polls.map(p => p.id))
    await loadSubmitted(mine)
    matches.value = mySchedules.map(s => ({
      schedule: s,
      label: matchLabel(s),
      opponentName: nameOf(s.team_a_captain_id === mine ? s.team_b_captain_id : s.team_a_captain_id),
      poll: polls.find(p => p.schedule_id === s.id) ?? null,
    }))
  } catch (e: any) {
    loadError.value = e.message ?? '불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
}

async function loadSubmitted(captainId: number) {
  const status = await getEntryStatusMap(captainId)
  submittedScheduleIds.value = new Set([...status].filter(([, st]) => st === 'submitted').map(([id]) => id))
}

// 엔트리 제출로 자동 마감된 투표에 [다시 열기]가 보이던 문제 — 제출됐거나 공개·종료된 경기는 숨긴다
const canReopen = (s: ScheduleRow) =>
  !s.is_entry_revealed && !s.is_completed && !submittedScheduleIds.value.has(s.id)

const voterCount = (pollId: number) => new Set(votes.value.filter(v => v.poll_id === pollId).map(v => v.user_id)).size

async function reloadPolls() {
  if (myCaptainId.value === null) return
  const ids = matches.value.map(m => m.schedule.id)
  const polls = (await getTeamPolls(ids)).filter(p => p.captain_player_id === myCaptainId.value)
  votes.value = await getTeamPollVotes(polls.map(p => p.id))
  await loadSubmitted(myCaptainId.value)
  matches.value = matches.value.map(m => ({ ...m, poll: polls.find(p => p.schedule_id === m.schedule.id) ?? null }))
  if (detail.value) {
    const fresh = matches.value.find(m => m.schedule.id === detail.value!.schedule.id)
    if (fresh?.poll) detail.value = { ...detail.value, poll: fresh.poll }
  }
}

async function handleOpen(m: PollMatch) {
  if (myCaptainId.value === null) return
  if (!confirm(`${m.label} vs ${m.opponentName} 투표를 열까요?\n팀원 전원에게 알림이 갑니다.`)) return
  busyId.value = m.schedule.id
  actionError.value = null
  try {
    await openTeamPoll(m.schedule.id, myCaptainId.value, rosterIds.value)
    await reloadPolls()
    const fresh = matches.value.find(x => x.schedule.id === m.schedule.id)
    if (fresh?.poll) openDetail(fresh)
  } catch (e: any) {
    actionError.value = e.message ?? '투표를 열지 못했습니다.'
  } finally {
    busyId.value = null
  }
}

// ── 투표 화면 ────────────────────────────────────────────────
interface Detail { schedule: ScheduleRow; label: string; opponentName: string; poll: TeamPoll }
interface SlotDraft { on: boolean; ban: string | null; pick: string | null }
const detail = ref<Detail | null>(null)
const draft = reactive<Record<number, SlotDraft>>({})
const saving = ref(false)
const saveError = ref<string | null>(null)

function openDetail(m: PollMatch) {
  if (!m.poll) return
  detail.value = { schedule: m.schedule, label: m.label, opponentName: m.opponentName, poll: m.poll }
  saveError.value = null
  const mine = votes.value.filter(v => v.poll_id === m.poll!.id && v.user_id === props.myPlayerId)
  for (const slot of POLL_SLOTS) {
    const v = mine.find(x => x.slot === slot)
    draft[slot] = { on: !!v, ban: v?.ban_map_id ?? null, pick: v?.pick_map_id ?? null }
  }
}

function closeDetail() {
  detail.value = null
  saveError.value = null
}

function toggleSlot(slot: number) {
  const d = draft[slot]
  d.on = !d.on
  if (!d.on) { d.ban = null; d.pick = null }
}
function setBan(slot: number, id: string) {
  const d = draft[slot]
  d.ban = d.ban === id ? null : id
  if (d.pick === id) d.pick = null
}
function setPick(slot: number, id: string) {
  const d = draft[slot]
  if (d.ban === id) return
  d.pick = d.pick === id ? null : id
}

// 저장을 막는 사유 — 2·3경기에 손들고 밴·픽을 안 골랐을 때 (서버도 같은 검사를 한다)
const draftProblem = computed<string | null>(() => {
  for (const slot of POLL_SLOTS) {
    const d = draft[slot]
    if (d?.on && needsBanPick(slot) && (!d.ban || !d.pick)) return `${slot}경기: 밴과 픽을 모두 골라 주세요`
  }
  return null
})

async function handleSave() {
  if (!detail.value || draftProblem.value) return
  saving.value = true
  saveError.value = null
  try {
    const list = POLL_SLOTS.filter(s => draft[s]?.on).map(s => ({
      slot: s,
      ban: needsBanPick(s) ? draft[s].ban : null,
      pick: needsBanPick(s) ? draft[s].pick : null,
    }))
    await saveMyTeamPollVotes(detail.value.poll.id, list)
    await reloadPolls()
    closeDetail()
  } catch (e: any) {
    saveError.value = e.message ?? '투표를 저장하지 못했습니다.'
  } finally {
    saving.value = false
  }
}

async function handleToggleStatus(open: boolean) {
  if (!detail.value) return
  if (!open && !confirm('투표를 마감할까요? 마감해도 엔트리 제출 전에는 다시 열 수 있습니다.')) return
  busyId.value = detail.value.schedule.id
  saveError.value = null
  try {
    await setTeamPollOpen(detail.value.poll.id, open)
    await reloadPolls()
    if (detail.value) openDetail({ ...detail.value, poll: detail.value.poll })
  } catch (e: any) {
    saveError.value = e.message ?? '변경하지 못했습니다.'
  } finally {
    busyId.value = null
  }
}

const voters = (slot: number) => {
  if (!detail.value) return []
  return (votersBySlot(votes.value.filter(v => v.poll_id === detail.value!.poll.id)).get(slot) ?? [])
    .slice()
    .sort((a, b) => playerName(a.user_id).localeCompare(playerName(b.user_id)))
}

const nonVoters = computed(() => {
  if (!detail.value) return []
  const voted = new Set(votes.value.filter(v => v.poll_id === detail.value!.poll.id).map(v => v.user_id))
  return detail.value.poll.member_ids.filter(id => !voted.has(id)).map(playerName)
})

onMounted(async () => {
  await load()
  if (props.focusScheduleId) {
    const m = matches.value.find(x => x.schedule.id === props.focusScheduleId)
    if (m?.poll) openDetail(m)
  }
})
</script>

<style lang="scss" scoped>
@use '@/styles/buttons';
@use '@/styles/modal';
@use './TeamPollModal.scss';
</style>
