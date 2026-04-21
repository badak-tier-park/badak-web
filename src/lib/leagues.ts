import { supabase } from './supabase'
import type { ScheduleRow } from './schedules'

export interface StandingEntry {
  captainId: number
  wins: number
  losses: number
  rank: number
}

// 정규경기 기반 순위 계산 (wins 내림차순, 동률이면 captainId 오름차순)
export function calculateStandings(
  captainIds: number[],
  regularSchedules: ScheduleRow[],
): StandingEntry[] {
  const completed = regularSchedules.filter(s => s.is_completed && s.match_type === 'regular')
  const winsMap = new Map<number, number>(captainIds.map(id => [id, 0]))
  const lossesMap = new Map<number, number>(captainIds.map(id => [id, 0]))

  for (const s of completed) {
    if (s.winner_captain_id == null) continue
    winsMap.set(s.winner_captain_id, (winsMap.get(s.winner_captain_id) ?? 0) + 1)
    const loserId = s.winner_captain_id === s.team_a_captain_id ? s.team_b_captain_id : s.team_a_captain_id
    lossesMap.set(loserId, (lossesMap.get(loserId) ?? 0) + 1)
  }

  const sorted = captainIds
    .map(id => ({ captainId: id, wins: winsMap.get(id) ?? 0, losses: lossesMap.get(id) ?? 0 }))
    .sort((a, b) => b.wins - a.wins || a.captainId - b.captainId)

  return sorted.map((e, i) => ({ ...e, rank: i + 1 }))
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
  is_ready: boolean
  picks_completed: boolean
  draft_completed: boolean
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
