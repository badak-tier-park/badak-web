import { supabase } from './supabase'

// 팀 투표 — 팀장·부팀장이 경기마다 열고, 팀원이 "나가고 싶은 경기"에 손든다(참고용).
// 읽기는 우리 팀 팀원·운영진만 가능하고(상대 팀은 밴·픽이 드러나므로 DB 정책으로 막음),
// 쓰기는 서버 함수로만 한다. 규칙은 src/views/leagues/CLAUDE.md '팀 투표'

export type TeamPollStatus = 'open' | 'closed'

export interface TeamPoll {
  id: number
  schedule_id: number
  captain_player_id: number
  created_by: number
  member_ids: number[]
  status: TeamPollStatus
  closed_reason: 'manual' | 'entry_submitted' | null
  created_at: string
  closed_at: string | null
}

export interface TeamPollVote {
  poll_id: number
  user_id: number
  slot: number
  ban_map_id: string | null
  pick_map_id: string | null
}

/** 투표를 받는 경기 슬롯(에이스 결정전 제외) */
export const POLL_SLOTS = [1, 2, 3, 4, 5, 6] as const
/** 손들 때 밴·픽을 함께 고르는 경기 — 엔트리의 BAN_SLOTS와 같다 */
export const POLL_BAN_SLOTS = [2, 3] as const

/** 내가 볼 수 있는 경기들의 투표 (팀원이면 우리 팀 것, 운영진이면 전부) */
export async function getTeamPolls(scheduleIds: number[]): Promise<TeamPoll[]> {
  if (!scheduleIds.length) return []
  const { data, error } = await supabase
    .from('team_polls')
    .select('*')
    .in('schedule_id', scheduleIds)
  if (error) throw error
  return (data ?? []) as TeamPoll[]
}

/** 내가 팀원으로 들어 있는 열린 투표가 있는 리그 id — 리그 카드의 "팀 투표" 버튼 표시용 */
export async function getMyOpenPollLeagueIds(userId: number): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('team_polls')
    .select('league_schedules(league_id)')
    .eq('status', 'open')
    .contains('member_ids', [userId])
  if (error) throw error
  const ids = new Set<string>()
  for (const row of (data ?? []) as unknown as Array<{ league_schedules: { league_id: string } | null }>) {
    if (row.league_schedules?.league_id) ids.add(String(row.league_schedules.league_id))
  }
  return ids
}

export async function getTeamPollVotes(pollIds: number[]): Promise<TeamPollVote[]> {
  if (!pollIds.length) return []
  const { data, error } = await supabase
    .from('team_poll_votes')
    .select('poll_id, user_id, slot, ban_map_id, pick_map_id')
    .in('poll_id', pollIds)
  if (error) throw error
  return (data ?? []) as TeamPollVote[]
}

/** 투표 열기. memberIds = 지목식·시드권 교체를 반영한 우리 팀 로스터(팀장 포함) */
export async function openTeamPoll(scheduleId: number, captainPlayerId: number, memberIds: number[]): Promise<number> {
  const { data, error } = await supabase.rpc('open_team_poll', {
    p_schedule_id: scheduleId,
    p_captain_player_id: captainPlayerId,
    p_member_ids: memberIds,
  })
  if (error) throw error
  return data as number
}

/** 투표 닫기(false) / 다시 열기(true) — 엔트리를 제출했거나 공개된 경기는 다시 못 연다 */
export async function setTeamPollOpen(pollId: number, open: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_team_poll_status', { p_poll_id: pollId, p_open: open })
  if (error) throw error
}

export interface PollVoteInput {
  slot: number
  ban?: string | null
  pick?: string | null
}

/** 내 투표 저장 — 이전 투표를 통째로 바꾼다(빈 배열 = 모두 취소) */
export async function saveMyTeamPollVotes(pollId: number, votes: PollVoteInput[]): Promise<void> {
  const { error } = await supabase.rpc('submit_team_poll_votes', {
    p_poll_id: pollId,
    p_votes: votes.map(v => ({ slot: v.slot, ban: v.ban ?? null, pick: v.pick ?? null })),
  })
  if (error) throw error
}

/** 슬롯별 지원자 목록. 엔트리 창·대타 창에서도 같이 쓴다 */
export function votersBySlot(votes: TeamPollVote[]): Map<number, TeamPollVote[]> {
  const map = new Map<number, TeamPollVote[]>()
  for (const v of votes) {
    if (!map.has(v.slot)) map.set(v.slot, [])
    map.get(v.slot)!.push(v)
  }
  return map
}
