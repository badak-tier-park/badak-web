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

export async function getGames(): Promise<GameRow[]> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .order('played_at', { ascending: false })
  if (error) throw error
  return data
}
