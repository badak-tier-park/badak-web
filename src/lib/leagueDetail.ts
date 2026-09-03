import { supabase } from './supabase'
import { getPlayers, type PlayerRow } from './players'

export interface CaptainRow {
  league_id: string
  player_id: number
  order_num: number
}

export interface MatchMapRow {
  league_id: string
  match_number: number
  map_ids: string[]
}

export async function getCaptains(leagueId: string): Promise<CaptainRow[]> {
  const { data, error } = await supabase
    .from('league_captains')
    .select('*')
    .eq('league_id', leagueId)
    .order('order_num', { ascending: true })
  if (error) throw error
  return data
}

export async function saveCaptains(
  leagueId: string,
  captains: Array<{ player_id: number; order_num: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_captains')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError

  if (captains.length === 0) return

  const rows = captains.map((c) => ({
    league_id: leagueId,
    player_id: c.player_id,
    order_num: c.order_num,
  }))
  const { error } = await supabase.from('league_captains').insert(rows)
  if (error) throw error
}

export async function getMatchMaps(leagueId: string): Promise<MatchMapRow[]> {
  const { data, error } = await supabase
    .from('league_match_maps')
    .select('*')
    .eq('league_id', leagueId)
    .order('match_number', { ascending: true })
  if (error) throw error
  return data
}

export async function saveMatchMaps(
  leagueId: string,
  matchMaps: Array<{ match_number: number; map_ids: string[] }>,
): Promise<void> {
  const rows = matchMaps.map((m) => ({
    league_id: leagueId,
    match_number: m.match_number,
    map_ids: m.map_ids,
  }))
  const { error } = await supabase
    .from('league_match_maps')
    .upsert(rows, { onConflict: 'league_id,match_number' })
  if (error) throw error
}

// ── 시드권자 ──────────────────────────────────────────────

export interface SeedHolderRow {
  id: number
  league_id: string
  player_id: number
  order_num: number
}

export async function getSeedHolders(leagueId: string): Promise<SeedHolderRow[]> {
  const { data, error } = await supabase
    .from('league_seed_holders')
    .select('*')
    .eq('league_id', leagueId)
    .order('order_num', { ascending: true })
  if (error) throw error
  return data
}

export async function saveSeedHolders(
  leagueId: string,
  holders: Array<{ player_id: number; order_num: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_seed_holders')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError

  if (holders.length === 0) return

  const rows = holders.map((h) => ({
    league_id: leagueId,
    player_id: h.player_id,
    order_num: h.order_num,
  }))
  const { error } = await supabase.from('league_seed_holders').insert(rows)
  if (error) throw error
}

// ── 선수 스냅샷 ─────────────────────────────────────────────
export interface PlayerSnapshot {
  league_id: string
  player_id: number
  tier: string
  race: string
  /** 스냅샷 도입 이전 행은 null일 수 있다 */
  is_military: boolean | null
}

export async function savePlayerSnapshots(
  leagueId: string,
  snapshots: { player_id: number; tier: string; race: string; is_military: boolean }[],
): Promise<void> {
  if (!snapshots.length) return
  const rows = snapshots.map(s => ({ league_id: leagueId, ...s }))
  const { error } = await supabase
    .from('league_player_snapshots')
    .upsert(rows, { onConflict: 'league_id,player_id' })
  if (error) throw error
}

export async function getPlayerSnapshots(leagueId: string): Promise<PlayerSnapshot[]> {
  const { data, error } = await supabase
    .from('league_player_snapshots')
    .select('league_id, player_id, tier, race, is_military')
    .eq('league_id', leagueId)
  if (error) throw error
  return (data ?? []) as PlayerSnapshot[]
}

export async function getPlayerSnapshotsForLeagues(
  leagueIds: string[],
): Promise<PlayerSnapshot[]> {
  if (!leagueIds.length) return []
  const { data, error } = await supabase
    .from('league_player_snapshots')
    .select('league_id, player_id, tier, race, is_military')
    .in('league_id', leagueIds)
  if (error) throw error
  return (data ?? []) as PlayerSnapshot[]
}

/**
 * 리그 시점의 선수 목록을 반환한다.
 *
 * 지목식이 완료된 리그는 당시 tier/race/is_military가 스냅샷으로 고정되어 있으므로
 * 그 값으로 덮어쓴다. 스냅샷이 없으면(지목식 진행 중이거나 스냅샷 도입 이전 리그)
 * 현재 값을 그대로 쓴다.
 *
 * 닉네임 등 나머지 필드는 항상 현재 값을 유지한다 — 닉네임 변경은 과거 기록에도
 * 반영되는 편이 자연스럽다.
 */
export async function getLeaguePlayers(leagueId: string): Promise<PlayerRow[]> {
  const [players, snapshots] = await Promise.all([
    getPlayers(),
    getPlayerSnapshots(leagueId),
  ])
  if (!snapshots.length) return players

  const snapById = new Map(snapshots.map(s => [s.player_id, s]))
  return players.map(p => {
    const snap = snapById.get(p.id)
    if (!snap) return p
    return {
      ...p,
      tier: snap.tier,
      race: (snap.race || p.race) as PlayerRow['race'],
      is_military: snap.is_military ?? p.is_military,
    }
  })
}
