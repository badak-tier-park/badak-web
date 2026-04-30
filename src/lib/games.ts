import { supabase } from './supabase'

export interface GameRow {
  id: number
  discord_id: number | null
  played_at: string | null
  map_name: string | null
  game_duration_seconds: number | null
  winner_name: string | null
  winner_race: string | null
  loser_name: string | null
  loser_race: string | null
  winner_apm: number | null
  loser_apm: number | null
  replay_file: string | null
  season_id: number | null
}

export interface EnrichedGameRow extends GameRow {
  winner_tier: string | null
  loser_tier: string | null
  map_thumbnail_url: string | null
}

export async function getEnrichedGames(): Promise<EnrichedGameRow[]> {
  const [gamesRes, playersRes, mapsRes] = await Promise.all([
    supabase.from('games').select('*').order('played_at', { ascending: false }),
    supabase.from('users').select('nickname, aliases, star_nicknames, tier'),
    supabase.from('maps').select('name, aliases, thumbnail_url'),
  ])

  if (gamesRes.error) throw gamesRes.error

  const players = playersRes.data ?? []
  const maps = mapsRes.data ?? []

  const tierByName = new Map<string, string>()
  for (const p of players) {
    tierByName.set(p.nickname.toLowerCase(), p.tier)
    for (const a of (p.aliases ?? [])) tierByName.set(a.toLowerCase(), p.tier)
    for (const sn of (p.star_nicknames ?? [])) tierByName.set(sn.toLowerCase(), p.tier)
  }

  const thumbByName = new Map<string, string | null>()
  for (const m of maps) {
    thumbByName.set(m.name.toLowerCase(), m.thumbnail_url)
    for (const a of (m.aliases ?? [])) thumbByName.set(a.toLowerCase(), m.thumbnail_url)
  }

  return gamesRes.data.map(g => ({
    ...g,
    winner_tier: g.winner_name ? (tierByName.get(g.winner_name.toLowerCase()) ?? null) : null,
    loser_tier: g.loser_name ? (tierByName.get(g.loser_name.toLowerCase()) ?? null) : null,
    map_thumbnail_url: g.map_name ? (thumbByName.get(g.map_name.toLowerCase()) ?? null) : null,
  }))
}

export async function deleteGame(id: number): Promise<void> {
  const { error } = await supabase.from('games').delete().eq('id', id)
  if (error) throw error
}
