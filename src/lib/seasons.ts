import { supabase } from './supabase'

export interface SeasonRow {
  id: number
  name: string
  start_date: string | null
  end_date: string | null
  created_at: string
}

export async function getSeasons(): Promise<SeasonRow[]> {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function createSeason(fields: { name: string; start_date?: string | null; end_date?: string | null }): Promise<SeasonRow> {
  const { data, error } = await supabase.from('seasons').insert(fields).select().single()
  if (error) throw error
  return data
}

export async function updateSeason(id: number, fields: { name: string; start_date?: string | null; end_date?: string | null }): Promise<void> {
  const { error } = await supabase.from('seasons').update(fields).eq('id', id)
  if (error) throw error
}

export async function deleteSeason(id: number): Promise<void> {
  const { error } = await supabase.from('seasons').delete().eq('id', id)
  if (error) throw error
}
