import { supabase } from './supabase'
import type { ScheduleRow } from './schedules'
import type { HandicapRow } from './handicap'

/**
 * 경기 슬롯별 승점 — 리그 규정: 개인전 +1, 팀전(4경기) +2, 에이스 결정전(7경기) +2.
 * 패배는 0점이고, 이긴 슬롯만큼 **승리팀·패배팀 모두** 받는다.
 */
export const MATCH_SLOT_POINTS: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 1, 6: 1, 7: 2 }

/** 한 경기에서 해당 팀이 받은 승점 */
export function matchPointsOf(
  slots: { slot_num: number; winner_captain_id: number | null }[],
  captainId: number,
): number {
  return slots
    .filter(s => s.winner_captain_id === captainId)
    .reduce((sum, s) => sum + (MATCH_SLOT_POINTS[s.slot_num] ?? 1), 0)
}

export interface StandingMatch {
  teamA: number
  teamB: number
  winner: number | null
  pointsA: number
  pointsB: number
}

export interface StandingEntry {
  captainId: number
  wins: number
  losses: number
  matchPoints: number
  rank: number
  /** 승리 수·승점이 같은 팀이 있는데 관리자가 재대결 결과(순서)를 아직 정하지 않음 */
  tied: boolean
}

/** 완료된 정규경기를 순위 계산용 경기 목록으로 변환 (승자는 경기 완료 시 저장된 값) */
export function toStandingMatches(
  schedules: ScheduleRow[],
  slots: { schedule_id: number; slot_num: number; winner_captain_id: number | null }[],
): StandingMatch[] {
  return schedules
    .filter(s => s.is_completed && s.match_type === 'regular')
    .map(s => {
      const own = slots.filter(r => r.schedule_id === s.id)
      return {
        teamA: s.team_a_captain_id,
        teamB: s.team_b_captain_id,
        winner: s.winner_captain_id,
        pointsA: matchPointsOf(own, s.team_a_captain_id),
        pointsB: matchPointsOf(own, s.team_b_captain_id),
      }
    })
}

/**
 * 예선 순위 — 리그 규정: 승리 수 → 승점 → (둘 다 같으면) 재대결.
 *
 * 재대결은 운영진이 따로 치르고, 관리자가 그 결과를 `leagues.standings_tiebreak_order`(팀장 id 순서)로
 * 저장한다. 순서가 정해지지 않은 동률 팀은 `tied`로 표시되고 임시로 팀장 id 순으로 놓인다.
 * 사용자 순위표와 플레이오프 대진이 같은 결과를 보도록 순위는 반드시 이 함수로만 계산한다.
 */
export function calculateStandings(
  captainIds: number[],
  matches: StandingMatch[],
  tiebreakOrder: number[] | null = null,
): StandingEntry[] {
  const stat = new Map(captainIds.map(id => [id, { wins: 0, losses: 0, matchPoints: 0 }]))
  for (const m of matches) {
    const a = stat.get(m.teamA)
    const b = stat.get(m.teamB)
    if (a) a.matchPoints += m.pointsA
    if (b) b.matchPoints += m.pointsB
    if (m.winner == null) continue
    const winner = stat.get(m.winner)
    const loser = stat.get(m.winner === m.teamA ? m.teamB : m.teamA)
    if (winner) winner.wins++
    if (loser) loser.losses++
  }

  const orderIdx = (id: number) => {
    const i = tiebreakOrder?.indexOf(id) ?? -1
    return i < 0 ? Number.POSITIVE_INFINITY : i
  }
  const rows = captainIds.map(id => ({ captainId: id, ...stat.get(id)! }))
  const sameRecord = (x: typeof rows[number], y: typeof rows[number]) =>
    x.wins === y.wins && x.matchPoints === y.matchPoints

  return rows
    .map(r => ({
      ...r,
      // 같은 성적의 다른 팀이 있고, 둘 중 하나라도 재대결 순서가 없으면 미해결 동률
      tied: rows.some(o => o.captainId !== r.captainId && sameRecord(o, r) &&
        (orderIdx(r.captainId) === Number.POSITIVE_INFINITY || orderIdx(o.captainId) === Number.POSITIVE_INFINITY)),
    }))
    .sort((x, y) =>
      y.wins - x.wins ||
      y.matchPoints - x.matchPoints ||
      orderIdx(x.captainId) - orderIdx(y.captainId) ||
      x.captainId - y.captainId)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

/**
 * 미해결 동률이 플레이오프 진출을 가르는 경계(1위|2위 = 결승 직행, 3위|4위 = 준결승 진출)에 걸렸는지.
 * 2위·3위 동률은 둘 다 준결승이라 대진에 영향이 없다.
 */
export function tieBlocksPlayoffs(standings: StandingEntry[]): boolean {
  return [1, 3].some(upper => {
    const a = standings.find(s => s.rank === upper)
    const b = standings.find(s => s.rank === upper + 1)
    return !!a && !!b && a.tied && b.tied && a.wins === b.wins && a.matchPoints === b.matchPoints
  })
}

export async function updateLeagueHandicap(
  id: string,
  fields: { handicap_point_gap: number | null; handicap_table: HandicapRow[] },
): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** 재대결 결과(동률 팀 순서)를 저장한다. null이면 초기화 */
export async function updateStandingsTiebreakOrder(id: string, order: number[] | null): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ standings_tiebreak_order: order, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export function allRegularMatchesDone(regularSchedules: ScheduleRow[]): boolean {
  const regular = regularSchedules.filter(s => s.match_type === 'regular')
  return regular.length > 0 && regular.every(s => s.is_completed)
}

export type LeagueType = 'regular_summer' | 'regular_winter' | 'jongchoe' | 'individual'
export type LeagueStatus = 'preparing' | 'upcoming' | 'ongoing' | 'finished'
export type EligibilityType = 'open' | 'application' | 'invitation'

export interface LeagueRow {
  id: string
  type: LeagueType
  name: string
  start_date: string
  end_date: string
  eligible_tiers: string[]
  eligibility_type: EligibilityType
  has_draft: boolean
  draft_date: string | null
  description: string | null
  captain_count: number
  entry_solo_max: number
  entry_team_max: number
  entry_total_max: number
  /** 팀전 최소 포인트. null이면 제한 없음 */
  entry_team_min: number | null
  /** 3:3에서 에결을 생략하고 포인트 적게 쓴 팀을 승자로 하는 포인트 차이. null이면 항상 에결 */
  ace_skip_point_gap: number | null
  /** 시드권 교체 시 허용하는 최대 티어 단계 차이 (0.5P = 1단계). null이면 제한 없음 */
  seed_swap_max_tier_steps: number | null
  /** 시드권 교체 시 허용하는 최대 픽 순번 차이. null이면 제한 없음 */
  seed_swap_max_pick_gap: number | null
  /** 승리 수·승점 동률 시 재대결 결과로 관리자가 정한 팀 순서 (팀장 player id). null이면 미정 */
  standings_tiebreak_order: number[] | null
  /** 핸디를 적용하는 양팀 엔트리 포인트 차이. null이면 핸디 없음 */
  handicap_point_gap: number | null
  /** 티어 단계 차이별 핸디 (체력 % + 추가 텍스트). 빈 단계는 핸디 없음 */
  handicap_table: HandicapRow[] | null
  is_ready: boolean
  picks_completed: boolean
  draft_completed: boolean
  draft_started: boolean
  team_names_completed: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface LeagueInsert {
  type: LeagueType
  name: string
  start_date: string
  end_date: string
  eligible_tiers: string[]
  eligibility_type: EligibilityType
  has_draft: boolean
  draft_date: string | null
  captain_count: number
}

export function getLeagueStatus(league: LeagueRow): LeagueStatus {
  if (!league.is_ready) return 'preparing'
  const isRegular = league.type === 'regular_summer' || league.type === 'regular_winter'
  if (isRegular && !league.draft_completed) return 'preparing'
  const today = new Date().toISOString().slice(0, 10)
  if (today < league.start_date) return 'upcoming'
  if (today > league.end_date) return 'finished'
  return 'ongoing'
}

export async function getLeague(id: string): Promise<LeagueRow> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

export async function getLeagues(): Promise<LeagueRow[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function updateLeague(id: string, payload: LeagueInsert): Promise<LeagueRow> {
  const { data, error } = await supabase
    .from('leagues')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateLeagueDescription(id: string, description: string): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ description, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function checkAndUpdateReady(id: string): Promise<void> {
  const { data: league } = await supabase.from('leagues').select('captain_count, description').eq('id', id).single()
  if (!league) return

  const { count: captainCount } = await supabase.from('league_captains').select('*', { count: 'exact', head: true }).eq('league_id', id)
  const { count: mapCount } = await supabase.from('league_match_maps').select('*', { count: 'exact', head: true }).eq('league_id', id)

  const isReady = !!(league.description && captainCount && captainCount >= league.captain_count && mapCount && mapCount > 0)

  await supabase.from('leagues').update({ is_ready: isReady, updated_at: new Date().toISOString() }).eq('id', id)
}

export async function setDraftStarted(id: string, started: boolean): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ draft_started: started, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setPicksCompleted(id: string): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ picks_completed: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setTeamNamesCompleted(id: string): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ team_names_completed: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function setDraftCompleted(id: string): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ picks_completed: true, draft_completed: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function createLeague(payload: LeagueInsert): Promise<LeagueRow> {
  const { data, error } = await supabase
    .from('leagues')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}

// 리그 생성자의 player_id (users.id) — 팀장/시드권자/지목식에서 제외 대상
export async function getLeagueCreatorPlayerId(leagueId: string): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_league_creator_player_id', { p_league_id: leagueId })
  if (error) throw error
  return data ?? null
}

export async function updateLeagueSeedSwapLimits(
  id: string,
  fields: { seed_swap_max_tier_steps: number | null; seed_swap_max_pick_gap: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function updateLeagueEntryLimits(
  id: string,
  fields: { entry_solo_max: number; entry_team_max: number; entry_total_max: number; entry_team_min: number | null; ace_skip_point_gap: number | null },
): Promise<void> {
  const { error } = await supabase
    .from('leagues')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}
