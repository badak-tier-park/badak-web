import { supabase } from './supabase'

export type EventType = 'match' | 'event' | 'notice' | 'other'

export interface EventRow {
  id: number
  title: string
  description: string | null
  event_type: EventType
  event_date: string
  event_time: string | null
  created_at: string
  updated_at: string
}

export interface EventInput {
  title: string
  description: string | null
  event_type: EventType
  event_date: string
  event_time: string | null
}

export async function getEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('event_date', { ascending: true })
    .order('event_time', { ascending: true, nullsFirst: true })
  if (error) throw error
  return data
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .insert(input)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateEvent(id: number, input: EventInput): Promise<EventRow> {
  const { data, error } = await supabase
    .from('events')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteEvent(id: number): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) throw error
}

export const EVENT_TYPE_META: Record<EventType, { label: string; color: string }> = {
  match:  { label: '경기',   color: '#ef4444' },
  event:  { label: '이벤트', color: '#a855f7' },
  notice: { label: '공지',   color: '#3b82f6' },
  other:  { label: '기타',   color: '#9ca3af' },
}
