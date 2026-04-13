import { supabase } from './supabase'
import type { CaptainRow } from './leagueDetail'
import type { DraftPickRow, SwapLogRow } from './draft'

// ── 상수 ────────────────────────────────────────────────────
export const TIER_POINTS: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }
export const INDIVIDUAL_SLOTS = [1, 2, 3, 5, 6] as const
export const TEAM_SLOT = 4
export const MAX_INDIVIDUAL_POINTS = 16
export const MAX_TEAM_POINTS = 7
export const MAX_TOTAL_POINTS = 23

// ── 타입 ────────────────────────────────────────────────────
export interface EntrySlot {
  match_slot: number
  player_ids: number[]
  banned_map_id?: string | null
}

/** 밴 선택이 필요한 경기 슬롯 번호 */
export const BAN_SLOTS = [2, 3] as const

// ── 엔트리 레코드 (공개용) ────────────────────────────────────
export interface EntryRecord {
  captain_player_id: number
  match_slot: number
  player_ids: number[]
  banned_map_id: string | null
}

// ── DB CRUD ─────────────────────────────────────────────────
export async function getEntries(
  scheduleId: number,
  captainPlayerId: number,
): Promise<EntrySlot[]> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('match_slot, player_ids, banned_map_id')
    .eq('schedule_id', scheduleId)
    .eq('captain_player_id', captainPlayerId)
    .order('match_slot', { ascending: true })
  if (error) throw error
  return (data ?? []) as EntrySlot[]
}

export async function saveEntries(
  scheduleId: number,
  captainPlayerId: number,
  slots: EntrySlot[],
): Promise<void> {
  const { error: delError } = await supabase
    .from('league_match_entries')
    .delete()
    .eq('schedule_id', scheduleId)
    .eq('captain_player_id', captainPlayerId)
  if (delError) throw delError

  if (slots.length === 0) return

  const rows = slots.map(s => ({
    schedule_id: scheduleId,
    captain_player_id: captainPlayerId,
    match_slot: s.match_slot,
    player_ids: s.player_ids,
    banned_map_id: s.banned_map_id ?? null,
    updated_at: new Date().toISOString(),
  }))
  const { error } = await supabase.from('league_match_entries').insert(rows)
  if (error) throw error
}

/** 팀장의 모든 경기 엔트리 제출 여부 확인 (schedule_id → 완료 여부) */
export async function getEntryStatusMap(
  captainPlayerId: number,
): Promise<Map<number, boolean>> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id, match_slot')
    .eq('captain_player_id', captainPlayerId)
  if (error) throw error

  const slotsBySchedule = new Map<number, Set<number>>()
  for (const row of data ?? []) {
    if (!slotsBySchedule.has(row.schedule_id))
      slotsBySchedule.set(row.schedule_id, new Set())
    slotsBySchedule.get(row.schedule_id)!.add(row.match_slot)
  }

  const result = new Map<number, boolean>()
  for (const [scheduleId, slots] of slotsBySchedule) {
    result.set(scheduleId, [1, 2, 3, 4, 5, 6].every(s => slots.has(s)))
  }
  return result
}

/** 경기의 모든 팀장 엔트리 조회 (엔트리 공개용) */
export async function getScheduleEntries(scheduleId: number): Promise<EntryRecord[]> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('captain_player_id, match_slot, player_ids, banned_map_id')
    .eq('schedule_id', scheduleId)
    .order('captain_player_id', { ascending: true })
    .order('match_slot', { ascending: true })
  if (error) throw error
  return (data ?? []) as EntryRecord[]
}

/** 양팀 모두 엔트리를 완전히 제출한 schedule_id 집합 반환 */
export async function getBothSubmittedSet(
  schedules: { id: number; team_a_captain_id: number; team_b_captain_id: number }[],
): Promise<Set<number>> {
  if (!schedules.length) return new Set()
  const ids = schedules.map(s => s.id)
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id, captain_player_id, match_slot')
    .in('schedule_id', ids)
  if (error) throw error

  const map = new Map<number, Map<number, Set<number>>>()
  for (const row of data ?? []) {
    if (!map.has(row.schedule_id)) map.set(row.schedule_id, new Map())
    const cm = map.get(row.schedule_id)!
    if (!cm.has(row.captain_player_id)) cm.set(row.captain_player_id, new Set())
    cm.get(row.captain_player_id)!.add(row.match_slot)
  }

  const REQUIRED = [1, 2, 3, 4, 5, 6]
  const result = new Set<number>()
  for (const s of schedules) {
    const cm = map.get(s.id)
    if (!cm) continue
    const aSlots = cm.get(s.team_a_captain_id)
    const bSlots = cm.get(s.team_b_captain_id)
    if (
      aSlots && REQUIRED.every(sl => aSlots.has(sl)) &&
      bSlots && REQUIRED.every(sl => bSlots.has(sl))
    ) result.add(s.id)
  }
  return result
}

// ── 로스터 계산 ──────────────────────────────────────────────
/** 지목식 픽 + 시드권 교체를 반영한 최종 팀 로스터 계산 */
export function computeFinalRosters(
  captains: CaptainRow[],
  picks: DraftPickRow[],
  swapLog: SwapLogRow[],
): Map<number, number[]> {
  const rosters = new Map<number, number[]>()
  for (const c of captains) {
    const members = picks
      .filter(p => p.captain_player_id === c.player_id)
      .sort((a, b) => a.pick_order - b.pick_order)
      .map(p => p.member_player_id)
    rosters.set(c.player_id, [c.player_id, ...members])
  }

  for (const swap of swapLog) {
    let fromCaptain: number | null = null
    let toCaptain: number | null = null
    for (const [captId, members] of rosters) {
      if (members.includes(swap.from_player_id)) fromCaptain = captId
      if (members.includes(swap.to_player_id)) toCaptain = captId
    }
    if (fromCaptain !== null && toCaptain !== null) {
      rosters.set(
        fromCaptain,
        rosters.get(fromCaptain)!.map(id => (id === swap.from_player_id ? swap.to_player_id : id)),
      )
      rosters.set(
        toCaptain,
        rosters.get(toCaptain)!.map(id => (id === swap.to_player_id ? swap.from_player_id : id)),
      )
    }
  }

  return rosters
}
