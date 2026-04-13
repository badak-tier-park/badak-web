import { supabase } from './supabase'

export interface PlayerRow {
  id: number
  discord_id: string
  nickname: string
  race: 'T' | 'Z' | 'P'
  tier: string
  is_admin: boolean
  created_at: string
  updated_at: string
}

export async function getPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('nickname', { ascending: true })

  if (error) throw error
  return data
}

export async function getPlayerByDiscordId(discordId: string): Promise<PlayerRow | null> {
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('discord_id', discordId)
    .single()
  return data ?? null
}

export async function updatePlayer(
  id: number,
  fields: { nickname: string; race: 'T' | 'Z' | 'P'; tier: string },
): Promise<PlayerRow> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
