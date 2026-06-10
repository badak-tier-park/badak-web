import { supabase } from './supabase'

export interface TeamNameRow {
  id: number
  league_id: string
  captain_player_id: number
  team_name: string
  updated_at: string
}

export async function getAllTeamNames(): Promise<TeamNameRow[]> {
  const { data, error } = await supabase
    .from('league_team_names')
    .select('*')
  if (error) throw error
  return data
}

export async function getTeamNames(leagueId: string): Promise<TeamNameRow[]> {
  const { data, error } = await supabase
    .from('league_team_names')
    .select('*')
    .eq('league_id', leagueId)
  if (error) throw error
  return data
}

export async function upsertTeamName(
  leagueId: string,
  captainPlayerId: number,
  teamName: string,
): Promise<void> {
  const { error } = await supabase
    .from('league_team_names')
    .upsert(
      { league_id: leagueId, captain_player_id: captainPlayerId, team_name: teamName, updated_at: new Date().toISOString() },
      { onConflict: 'league_id,captain_player_id' },
    )
  if (error) throw error
}

/**
 * 팀명을 저장한다. team_name 이 빈 문자열인 항목은 DB에서 삭제하여
 * 해당 팀은 자동으로 팀장 닉네임을 팀명으로 사용하게 된다.
 */
export async function saveTeamNames(
  leagueId: string,
  entries: Array<{ captain_player_id: number; team_name: string }>,
): Promise<void> {
  const filled = entries
    .map(e => ({ ...e, team_name: e.team_name.trim() }))
    .filter(e => e.team_name.length > 0)
  const empties = entries.filter(e => !e.team_name.trim()).map(e => e.captain_player_id)

  if (filled.length > 0) {
    const rows = filled.map(e => ({
      league_id: leagueId,
      captain_player_id: e.captain_player_id,
      team_name: e.team_name,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('league_team_names')
      .upsert(rows, { onConflict: 'league_id,captain_player_id' })
    if (error) throw error
  }

  if (empties.length > 0) {
    const { error } = await supabase
      .from('league_team_names')
      .delete()
      .eq('league_id', leagueId)
      .in('captain_player_id', empties)
    if (error) throw error
  }
}
