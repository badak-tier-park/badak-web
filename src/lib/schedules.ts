import { supabase } from './supabase'

export interface ScheduleRow {
  id: number
  league_id: string
  round: number
  match_date: string | null
  team_a_captain_id: number
  team_b_captain_id: number
  winner_captain_id: number | null
  is_entry_revealed: boolean
  created_at: string
}

export async function updateMatchWinner(scheduleId: number, winnerCaptainId: number | null): Promise<void> {
  const { error } = await supabase
    .from('league_schedules')
    .update({ winner_captain_id: winnerCaptainId })
    .eq('id', scheduleId)
  if (error) throw error
}

export async function getSchedules(leagueId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('league_schedules')
    .select('*')
    .eq('league_id', leagueId)
    .order('round', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function revealEntries(scheduleId: number): Promise<void> {
  const { error } = await supabase
    .from('league_schedules')
    .update({ is_entry_revealed: true })
    .eq('id', scheduleId)
  if (error) throw error
}

export async function getRevealedSchedules(leagueId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('league_schedules')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_entry_revealed', true)
    .order('round', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function saveSchedules(
  leagueId: string,
  schedules: Array<{ round: number; match_date: string | null; team_a_captain_id: number; team_b_captain_id: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_schedules')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError

  if (schedules.length === 0) return

  const rows = schedules.map(s => ({ league_id: leagueId, ...s }))
  const { error } = await supabase.from('league_schedules').insert(rows)
  if (error) throw error
}
