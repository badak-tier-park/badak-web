import { supabase } from './supabase'

export type LeagueType = 'regular_summer' | 'regular_winter' | 'jongchoe' | 'individual'
export type LeagueStatus = 'upcoming' | 'ongoing' | 'finished'

export interface LeagueRow {
  id: string
  type: LeagueType
  name: string
  start_date: string
  end_date: string
  eligible_tiers: string[]
  created_at: string
  updated_at: string
}

export interface LeagueInsert {
  type: LeagueType
  name: string
  start_date: string
  end_date: string
  eligible_tiers: string[]
}

export function getLeagueStatus(league: LeagueRow): LeagueStatus {
  const today = new Date().toISOString().slice(0, 10)
  if (today < league.start_date) return 'upcoming'
  if (today > league.end_date) return 'finished'
  return 'ongoing'
}

export async function getLeagues(): Promise<LeagueRow[]> {
  const { data, error } = await supabase
    .from('leagues')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function updateLeague(id: string, payload: LeagueInsert): Promise<LeagueRow> {
  const { data, error } = await supabase
    .from('leagues')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function createLeague(payload: LeagueInsert): Promise<LeagueRow> {
  const { data, error } = await supabase
    .from('leagues')
    .insert(payload)
    .select()
    .single()

  if (error) throw error
  return data
}
