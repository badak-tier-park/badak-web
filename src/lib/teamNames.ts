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

export async function saveTeamNames(
  leagueId: string,
  entries: Array<{ captain_player_id: number; team_name: string }>,
): Promise<void> {
  const rows = entries.map(e => ({
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
