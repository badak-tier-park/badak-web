import { supabase } from './supabase'

export interface PlayerRow {
  id: number
  discord_id: string
  nickname: string
  aliases: string[]
  star_nicknames: string[]
  race: 'T' | 'Z' | 'P'
  tier: string
  is_admin: boolean
  is_military: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

// discord_id는 bigint라 JSON 숫자로 받으면 JS number 정밀도(2^53)를 넘어 끝자리가 반올림된다.
// 그 값을 수정 화면에 채워 저장하면 실제 ID가 틀린 값으로 덮어써지므로 text로 받는다
const PLAYER_COLUMNS =
  'id, discord_id::text, nickname, aliases, star_nicknames, race, tier, is_admin, is_military, is_active, created_at, updated_at'

export async function getPlayers(): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('users')
    .select(PLAYER_COLUMNS)
    .order('nickname', { ascending: true })

  if (error) throw error
  return data
}

export async function getPlayerByDiscordId(discordId: string): Promise<PlayerRow | null> {
  const { data } = await supabase
    .from('users')
    .select(PLAYER_COLUMNS)
    .eq('discord_id', discordId)
    .single()
  return data ?? null
}

// 디스코드 ID는 users에서 유일한 값(23505 = unique 위반)
function friendlyError(error: { code?: string; message: string }): Error {
  if (error.code === '23505') return new Error('이미 등록된 디스코드 ID입니다.')
  return new Error(error.message)
}

// 디스코드 ID는 정밀도 때문에 문자열 그대로 보낸다(PLAYER_COLUMNS 참고).
// 로그인 판정은 이 값과 디스코드 계정을 비교하므로 틀리면 등록해도 로그인이 안 된다
export async function createPlayer(
  fields: { discord_id: string; nickname: string; aliases: string[]; star_nicknames: string[]; race: 'T' | 'Z' | 'P'; tier: string; is_military: boolean; is_active: boolean },
): Promise<PlayerRow> {
  const { data, error } = await supabase
    .from('users')
    .insert(fields)
    .select(PLAYER_COLUMNS)
    .single()

  if (error) throw friendlyError(error)
  return data
}

export async function updatePlayer(
  id: number,
  fields: { discord_id?: string; nickname: string; aliases: string[]; star_nicknames: string[]; race: 'T' | 'Z' | 'P'; tier: string; is_military: boolean; is_active: boolean },
): Promise<PlayerRow> {
  const { data, error } = await supabase
    .from('users')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(PLAYER_COLUMNS)
    .single()

  if (error) throw friendlyError(error)
  return data
}
