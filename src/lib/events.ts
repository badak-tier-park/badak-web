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

export const EVENT_TYPE_META: Record<EventType, { label: string; color: string; bg: string; text: string }> = {
  match:  { label: '경기',   color: '#ef4444', bg: 'rgba(239, 68, 68, 0.18)',  text: '#fca5a5' },
  event:  { label: '이벤트', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.18)', text: '#d8b4fe' },
  notice: { label: '공지',   color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.18)', text: '#93c5fd' },
  other:  { label: '기타',   color: '#9ca3af', bg: 'rgba(156, 163, 175, 0.18)', text: '#d1d5db' },
}

// ── 리그 경기 일정 + 일반 일정 통합 조회 ──────────────
export interface CalendarItem {
  id: string
  source: 'event' | 'schedule'
  title: string
  description: string | null
  event_type: EventType
  event_date: string
  event_time: string | null
  league_id?: string
  league_name?: string
  schedule_id?: number
  match_type?: string
  team_a_name?: string
  team_b_name?: string
  round?: number
}

function matchTypeLabel(type: string, round: number): string {
  if (type === 'regular') return `${round}R`
  if (type === 'semifinal') return '4강'
  if (type === 'final_set1') return '결승 1세트'
  if (type === 'final_set2') return '결승 2세트'
  if (type === 'super_ace') return '슈퍼에이스'
  return type
}

export async function getCalendarItems(): Promise<CalendarItem[]> {
  const events = await getEvents()
  const eventItems: CalendarItem[] = events.map(e => ({
    id: `event-${e.id}`,
    source: 'event',
    title: e.title,
    description: e.description,
    event_type: e.event_type,
    event_date: e.event_date,
    event_time: e.event_time,
  }))

  const { data: schedules, error: schedErr } = await supabase
    .from('league_schedules')
    .select('id, league_id, round, match_date, team_a_captain_id, team_b_captain_id, match_type')
    .not('match_date', 'is', null)
  if (schedErr) throw schedErr
  if (!schedules || schedules.length === 0) return eventItems

  const leagueIds = [...new Set(schedules.map(s => s.league_id))]
  const captainIds = [...new Set(schedules.flatMap(s => [s.team_a_captain_id, s.team_b_captain_id]))]

  const [{ data: leagues }, { data: teamNames }, { data: users }] = await Promise.all([
    supabase.from('leagues').select('id, name').in('id', leagueIds),
    supabase.from('league_team_names').select('league_id, captain_player_id, team_name').in('league_id', leagueIds),
    supabase.from('users').select('id, nickname').in('id', captainIds),
  ])

  const leagueById = new Map<string, string>((leagues ?? []).map(l => [l.id, l.name]))
  const userById = new Map<number, string>((users ?? []).map(u => [u.id, u.nickname]))
  const teamNameMap = new Map<string, string>()
  for (const tn of teamNames ?? []) {
    teamNameMap.set(`${tn.league_id}-${tn.captain_player_id}`, tn.team_name)
  }

  const scheduleItems: CalendarItem[] = schedules.map(s => {
    const leagueName = leagueById.get(s.league_id) ?? '리그'
    const teamA = teamNameMap.get(`${s.league_id}-${s.team_a_captain_id}`) ?? userById.get(s.team_a_captain_id) ?? '?'
    const teamB = teamNameMap.get(`${s.league_id}-${s.team_b_captain_id}`) ?? userById.get(s.team_b_captain_id) ?? '?'
    const typeLabel = matchTypeLabel(s.match_type, s.round)
    return {
      id: `schedule-${s.id}`,
      source: 'schedule',
      title: `${leagueName} ${typeLabel}: ${teamA} vs ${teamB}`,
      description: null,
      event_type: 'match',
      event_date: s.match_date as string,
      event_time: null,
      league_id: s.league_id,
      league_name: leagueName,
      schedule_id: s.id,
      match_type: s.match_type,
      team_a_name: teamA,
      team_b_name: teamB,
      round: s.round,
    }
  })

  return [...eventItems, ...scheduleItems]
}
