import { supabase } from './supabase'

export interface SwapLogRow {
  id: number
  league_id: string
  order_num: number
  seed_holder_player_id: number
  from_player_id: number
  to_player_id: number
}

export async function getSwapLog(leagueId: string): Promise<SwapLogRow[]> {
  const { data, error } = await supabase
    .from('league_swap_log')
    .select('*')
    .eq('league_id', leagueId)
    .order('order_num', { ascending: true })
  if (error) throw error
  return data
}

export async function saveSwapLog(
  leagueId: string,
  entries: Array<{ order_num: number; seed_holder_player_id: number; from_player_id: number; to_player_id: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_swap_log')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError
  if (entries.length === 0) return
  const rows = entries.map(e => ({ league_id: leagueId, ...e }))
  const { error } = await supabase.from('league_swap_log').insert(rows)
  if (error) throw error
}

export interface DraftPickRow {
  id: number
  league_id: string
  captain_player_id: number
  member_player_id: number
  pick_order: number
}

export async function getDraftPicks(leagueId: string): Promise<DraftPickRow[]> {
  const { data, error } = await supabase
    .from('league_draft_picks')
    .select('*')
    .eq('league_id', leagueId)
    .order('pick_order', { ascending: true })
  if (error) throw error
  return data
}

export async function deleteSinglePick(
  leagueId: string,
  memberPlayerId: number,
): Promise<void> {
  const { error } = await supabase
    .from('league_draft_picks')
    .delete()
    .eq('league_id', leagueId)
    .eq('member_player_id', memberPlayerId)
  if (error) throw error
}

export async function addSinglePick(
  leagueId: string,
  captainPlayerId: number,
  memberPlayerId: number,
  pickOrder: number,
): Promise<void> {
  const { error } = await supabase
    .from('league_draft_picks')
    .insert({ league_id: leagueId, captain_player_id: captainPlayerId, member_player_id: memberPlayerId, pick_order: pickOrder })
  if (error) throw error
}

export async function saveDraftPicks(
  leagueId: string,
  picks: Array<{ captain_player_id: number; member_player_id: number; pick_order: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_draft_picks')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError

  if (picks.length === 0) return

  const rows = picks.map((p) => ({
    league_id: leagueId,
    captain_player_id: p.captain_player_id,
    member_player_id: p.member_player_id,
    pick_order: p.pick_order,
  }))
  const { error } = await supabase.from('league_draft_picks').insert(rows)
  if (error) throw error
}
