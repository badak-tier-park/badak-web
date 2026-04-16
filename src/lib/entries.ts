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

export type EntryStatus = 'none' | 'saved' | 'submitted'

/** 팀장의 모든 경기 엔트리 상태 확인 (schedule_id → 'none' | 'saved' | 'submitted') */
export async function getEntryStatusMap(
  captainPlayerId: number,
): Promise<Map<number, EntryStatus>> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id, match_slot, is_submitted')
    .eq('captain_player_id', captainPlayerId)
  if (error) throw error

  const slotsBySchedule = new Map<number, { slots: Set<number>; submitted: boolean }>()
  for (const row of data ?? []) {
    if (!slotsBySchedule.has(row.schedule_id))
      slotsBySchedule.set(row.schedule_id, { slots: new Set(), submitted: false })
    const entry = slotsBySchedule.get(row.schedule_id)!
    entry.slots.add(row.match_slot)
    if (row.is_submitted) entry.submitted = true
  }

  const result = new Map<number, EntryStatus>()
  for (const [scheduleId, { slots, submitted }] of slotsBySchedule) {
    const complete = [1, 2, 3, 4, 5, 6].every(s => slots.has(s))
    if (!complete) continue
    result.set(scheduleId, submitted ? 'submitted' : 'saved')
  }
  return result
}

/** 엔트리 제출 확정 */
export async function submitEntry(
  scheduleId: number,
  captainPlayerId: number,
): Promise<void> {
  const { error } = await supabase
    .from('league_match_entries')
    .update({ is_submitted: true })
    .eq('schedule_id', scheduleId)
    .eq('captain_player_id', captainPlayerId)
  if (error) throw error
}

/** 공개 동의 처리 */
export async function consentReveal(scheduleId: number, captainPlayerId: number): Promise<void> {
  const { error } = await supabase
    .from('league_match_entries')
    .update({ consent_reveal: true })
    .eq('schedule_id', scheduleId)
    .eq('captain_player_id', captainPlayerId)
  if (error) throw error
}

/** 양팀 모두 공개 동의 여부 확인 */
export async function checkBothConsented(
  scheduleId: number,
  captainAId: number,
  captainBId: number,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('captain_player_id, consent_reveal')
    .eq('schedule_id', scheduleId)
    .in('captain_player_id', [captainAId, captainBId])
  if (error) throw error
  const map = new Map((data ?? []).map(r => [r.captain_player_id, r.consent_reveal]))
  return map.get(captainAId) === true && map.get(captainBId) === true
}

/** 이미 공개 동의한 schedule_id 집합 반환 */
export async function getConsentedSet(captainPlayerId: number): Promise<Set<number>> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id')
    .eq('captain_player_id', captainPlayerId)
    .eq('consent_reveal', true)
  if (error) throw error
  return new Set((data ?? []).map(r => r.schedule_id))
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

/** 양팀 모두 엔트리를 제출 확정한 schedule_id 집합 반환 */
export async function getBothSubmittedSet(
  schedules: { id: number; team_a_captain_id: number; team_b_captain_id: number }[],
): Promise<Set<number>> {
  if (!schedules.length) return new Set()
  const ids = schedules.map(s => s.id)
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id, captain_player_id')
    .in('schedule_id', ids)
    .eq('is_submitted', true)
  if (error) throw error

  const submittedSet = new Set<string>()
  for (const row of data ?? [])
    submittedSet.add(`${row.schedule_id}_${row.captain_player_id}`)

  const result = new Set<number>()
  for (const s of schedules) {
    if (
      submittedSet.has(`${s.id}_${s.team_a_captain_id}`) &&
      submittedSet.has(`${s.id}_${s.team_b_captain_id}`)
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

// ── 에이스 티어 밴 ─────────────────────────────────────────────
export async function getAceTierBan(
  scheduleId: number,
  captainPlayerId: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('league_match_ace_bans')
    .select('tier_ban')
    .eq('schedule_id', scheduleId)
    .eq('captain_player_id', captainPlayerId)
    .maybeSingle()
  if (error) throw error
  return data?.tier_ban ?? null
}

export async function getAceTierBans(
  scheduleId: number,
): Promise<Array<{ captain_player_id: number; tier_ban: string | null }>> {
  const { data, error } = await supabase
    .from('league_match_ace_bans')
    .select('captain_player_id, tier_ban')
    .eq('schedule_id', scheduleId)
  if (error) throw error
  return data ?? []
}

export async function saveAceTierBan(
  scheduleId: number,
  captainPlayerId: number,
  tierBan: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('league_match_ace_bans')
    .upsert({ schedule_id: scheduleId, captain_player_id: captainPlayerId, tier_ban: tierBan })
  if (error) throw error
}
