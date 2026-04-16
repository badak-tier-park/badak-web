import { supabase } from './supabase'

export interface ScheduleRow {
  id: number
  league_id: string
  round: number
  match_date: string | null
  team_a_captain_id: number
  team_b_captain_id: number
  winner_captain_id: number | null
  is_entry_revealed: boolean
  is_completed: boolean
  created_at: string
}

export async function updateMatchWinner(scheduleId: number, winnerCaptainId: number | null): Promise<void> {
  const { error } = await supabase
    .from('league_schedules')
    .update({ winner_captain_id: winnerCaptainId })
    .eq('id', scheduleId)
  if (error) throw error
}

export async function getSchedules(leagueId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('league_schedules')
    .select('*')
    .eq('league_id', leagueId)
    .order('round', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function completeMatch(scheduleId: number, winnerCaptainId: number | null): Promise<void> {
  const { error } = await supabase
    .from('league_schedules')
    .update({ is_completed: true, winner_captain_id: winnerCaptainId })
    .eq('id', scheduleId)
  if (error) throw error
}

export async function revealEntries(scheduleId: number): Promise<void> {
  const { error } = await supabase
    .from('league_schedules')
    .update({ is_entry_revealed: true })
    .eq('id', scheduleId)
  if (error) throw error
}

export async function getCompletedSchedules(leagueId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('league_schedules')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_completed', true)
    .order('round', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

export async function getRevealedSchedules(leagueId: string): Promise<ScheduleRow[]> {
  const { data, error } = await supabase
    .from('league_schedules')
    .select('*')
    .eq('league_id', leagueId)
    .eq('is_entry_revealed', true)
    .order('round', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  return data
}

// ── 경기별 슬롯 결과 ──────────────────────────────────────────

export interface SlotResult {
  schedule_id: number
  slot_num: number
  winner_captain_id: number | null
  selected_map_id: string | null
  ace_tier: string | null
  ace_player_a_id: number | null
  ace_player_b_id: number | null
}

export async function getSlotResults(scheduleId: number): Promise<SlotResult[]> {
  const { data, error } = await supabase
    .from('league_match_slot_results')
    .select('*')
    .eq('schedule_id', scheduleId)
  if (error) throw error
  return data
}

export async function setSlotResult(
  scheduleId: number,
  slotNum: number,
  winnerCaptainId: number | null,
): Promise<void> {
  const { data: existing } = await supabase
    .from('league_match_slot_results')
    .select('selected_map_id, ace_tier')
    .eq('schedule_id', scheduleId)
    .eq('slot_num', slotNum)
    .maybeSingle()

  if (winnerCaptainId === null) {
    if (!existing) return
    const hasOtherData = existing.selected_map_id || existing.ace_tier
    if (hasOtherData) {
      const { error } = await supabase
        .from('league_match_slot_results')
        .update({ winner_captain_id: null })
        .eq('schedule_id', scheduleId)
        .eq('slot_num', slotNum)
      if (error) throw error
    } else {
      const { error } = await supabase
        .from('league_match_slot_results')
        .delete()
        .eq('schedule_id', scheduleId)
        .eq('slot_num', slotNum)
      if (error) throw error
    }
  } else if (existing) {
    const { error } = await supabase
      .from('league_match_slot_results')
      .update({ winner_captain_id: winnerCaptainId })
      .eq('schedule_id', scheduleId)
      .eq('slot_num', slotNum)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('league_match_slot_results')
      .insert({ schedule_id: scheduleId, slot_num: slotNum, winner_captain_id: winnerCaptainId })
    if (error) throw error
  }
}

export async function setSlotMap(
  scheduleId: number,
  slotNum: number,
  mapId: string,
): Promise<void> {
  const { data: existing } = await supabase
    .from('league_match_slot_results')
    .select('schedule_id')
    .eq('schedule_id', scheduleId)
    .eq('slot_num', slotNum)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('league_match_slot_results')
      .update({ selected_map_id: mapId })
      .eq('schedule_id', scheduleId)
      .eq('slot_num', slotNum)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('league_match_slot_results')
      .insert({ schedule_id: scheduleId, slot_num: slotNum, selected_map_id: mapId })
    if (error) throw error
  }
}

export async function setAceSlotData(
  scheduleId: number,
  data: {
    aceTier?: string | null
    playerAId?: number | null
    playerBId?: number | null
  },
): Promise<void> {
  const { data: existing } = await supabase
    .from('league_match_slot_results')
    .select('schedule_id')
    .eq('schedule_id', scheduleId)
    .eq('slot_num', 7)
    .maybeSingle()

  const payload: Record<string, unknown> = {}
  if ('aceTier' in data) payload.ace_tier = data.aceTier ?? null
  if ('playerAId' in data) payload.ace_player_a_id = data.playerAId ?? null
  if ('playerBId' in data) payload.ace_player_b_id = data.playerBId ?? null

  if (existing) {
    const { error } = await supabase
      .from('league_match_slot_results')
      .update(payload)
      .eq('schedule_id', scheduleId)
      .eq('slot_num', 7)
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('league_match_slot_results')
      .insert({ schedule_id: scheduleId, slot_num: 7, ...payload })
    if (error) throw error
  }
}

export async function saveSchedules(
  leagueId: string,
  schedules: Array<{ round: number; match_date: string | null; team_a_captain_id: number; team_b_captain_id: number }>,
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_schedules')
    .delete()
    .eq('league_id', leagueId)
  if (delError) throw delError

  if (schedules.length === 0) return

  const rows = schedules.map(s => ({ league_id: leagueId, ...s }))
  const { error } = await supabase.from('league_schedules').insert(rows)
  if (error) throw error
}
