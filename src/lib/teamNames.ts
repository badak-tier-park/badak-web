import { supabase } from './supabase'

export interface TeamNameRow {
  id: number
  league_id: string
  captain_player_id: number
  team_name: string
  vice_captain_player_id: number | null
  updated_at: string
}

export interface TeamSetupInput {
  captain_player_id: number
  team_name: string
  vice_captain_player_id: number | null
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
 * 팀명과 부팀장을 저장한다. 팀명과 부팀장 모두 비어있는 항목은 DB에서 삭제되며,
 * 이때 해당 팀은 자동으로 팀장 닉네임을 팀명으로 사용하게 된다.
 */
export async function saveTeamNames(
  leagueId: string,
  entries: TeamSetupInput[],
): Promise<void> {
  const normalized = entries.map(e => ({
    captain_player_id: e.captain_player_id,
    team_name: e.team_name.trim(),
    vice_captain_player_id: e.vice_captain_player_id,
  }))

  const toUpsert = normalized.filter(e => e.team_name.length > 0 || e.vice_captain_player_id !== null)
  const toDelete = normalized
    .filter(e => e.team_name.length === 0 && e.vice_captain_player_id === null)
    .map(e => e.captain_player_id)

  if (toUpsert.length > 0) {
    const rows = toUpsert.map(e => ({
      league_id: leagueId,
      captain_player_id: e.captain_player_id,
      team_name: e.team_name,
      vice_captain_player_id: e.vice_captain_player_id,
      updated_at: new Date().toISOString(),
    }))
    const { error } = await supabase
      .from('league_team_names')
      .upsert(rows, { onConflict: 'league_id,captain_player_id' })
    if (error) throw error
  }

  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('league_team_names')
      .delete()
      .eq('league_id', leagueId)
      .in('captain_player_id', toDelete)
    if (error) throw error
  }
}
