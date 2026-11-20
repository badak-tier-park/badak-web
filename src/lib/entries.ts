import { supabase } from './supabase'
import type { CaptainRow } from './leagueDetail'
import type { DraftPickRow } from './draft'
import { tierPoint } from './constants'

// ── 상수 ────────────────────────────────────────────────────
export { TIER_POINTS } from './constants'
export const INDIVIDUAL_SLOTS = [1, 2, 3, 5, 6] as const
export const TEAM_SLOT = 4
// NOTE: 엔트리 포인트 한도(개인전 / 팀전 / 전체)는 리그별로 leagues 테이블의
// entry_solo_max / entry_team_max / entry_total_max 컬럼에서 설정한다.

/** 군인(병사) 엔트리 포인트 감점 */
export const MILITARY_DEDUCTION = 0.5

// ── 엔트리 포인트 계산 ───────────────────────────────────────
export interface EntryPointPlayer {
  tier: string
  is_military?: boolean
}

export interface EntryPoints {
  solo: number
  team: number
  total: number
}

/**
 * 한 팀 엔트리의 개인전 / 팀전 / 전체 포인트.
 *
 * 군인은 MILITARY_DEDUCTION 만큼 빼되, 개인전과 팀전에 중복 출전해도 **한쪽에서만** 뺀다
 * (리그 규정). 개인전 슬롯을 먼저 세어 개인전 쪽에서 차감하므로 solo + team = total이 유지된다.
 * 엔트리 합계는 참가·공개·결과 화면이 모두 이 함수로 계산해야 숫자가 어긋나지 않는다.
 */
export function calcEntryPoints(
  slots: { match_slot: number; player_ids: number[] }[],
  getPlayer: (id: number) => EntryPointPlayer | undefined,
): EntryPoints {
  const deducted = new Set<number>()
  const pointOf = (id: number) => {
    const p = getPlayer(id)
    const base = tierPoint(p?.tier)
    if (!p?.is_military || deducted.has(id)) return base
    deducted.add(id)
    return Math.max(0, base - MILITARY_DEDUCTION)
  }
  const sumSlots = (slotNums: readonly number[]) =>
    slots
      .filter(s => slotNums.includes(s.match_slot))
      .reduce((sum, s) => sum + s.player_ids.reduce((acc, id) => acc + (id ? pointOf(id) : 0), 0), 0)

  const solo = sumSlots(INDIVIDUAL_SLOTS)
  const team = sumSlots([TEAM_SLOT])
  return { solo, team, total: solo + team }
}

/**
 * 양팀 엔트리 포인트 차이로 에이스 결정전을 생략하는지.
 *
 * 기준(gap)은 시즌마다 바뀌는 규정이라 리그별 설정값(`leagues.ace_skip_point_gap`)을 받는다.
 * null이면 포인트로 판정하지 않고 3:3이면 항상 에결을 한다.
 */
export function isAceSkippedByPoints(ptA: number, ptB: number, gap: number | null | undefined): boolean {
  return gap != null && Math.abs(ptA - ptB) >= gap
}

export interface MatchDecision {
  /** 승패가 확정됐는지 — 확정 전에는 경기 완료(저장)를 막는다 */
  decided: boolean
  winner: number | null
}

/**
 * 정규 경기(1~6경기 + 에이스 결정전) 승패 확정 판정.
 *
 * - 양팀 엔트리 포인트 차이가 에결 생략 기준 **미만**: 먼저 4승한 팀. 3:3이면 에결 승자
 * - 기준 **이상**: 포인트를 적게 쓴 팀은 **3승**으로 확정된다(남은 경기를 져도 3:3 → 포인트로 승리).
 *   많이 쓴 팀은 4승해야 확정
 *
 * 확정된 뒤의 남은 경기는 치르지 않으므로 결과 화면에서 입력을 잠근다.
 */
export function decideMatch(p: {
  capA: number
  capB: number
  winsA: number
  winsB: number
  ptA: number
  ptB: number
  gap: number | null | undefined
  aceWinner: number | null | undefined
}): MatchDecision {
  if (isAceSkippedByPoints(p.ptA, p.ptB, p.gap)) {
    const lowIsA = p.ptA < p.ptB
    const [low, high] = lowIsA ? [p.capA, p.capB] : [p.capB, p.capA]
    const [lowWins, highWins] = lowIsA ? [p.winsA, p.winsB] : [p.winsB, p.winsA]
    if (lowWins >= 3) return { decided: true, winner: low }
    if (highWins >= 4) return { decided: true, winner: high }
    return { decided: false, winner: null }
  }
  if (p.winsA >= 4) return { decided: true, winner: p.capA }
  if (p.winsB >= 4) return { decided: true, winner: p.capB }
  if (p.winsA === 3 && p.winsB === 3 && p.aceWinner) return { decided: true, winner: p.aceWinner }
  return { decided: false, winner: null }
}

/** 3:3 동률에서 에결이 생략된 경우의 승자 — 포인트를 적게 쓴 팀. 생략 대상이 아니면 null */
export function pointTiebreakWinner(
  ptA: number, ptB: number, capA: number, capB: number, gap: number | null | undefined,
): number | null {
  if (!isAceSkippedByPoints(ptA, ptB, gap)) return null
  return ptA < ptB ? capA : capB
}

// ── 타입 ────────────────────────────────────────────────────
export interface EntrySlot {
  match_slot: number
  player_ids: number[]
  banned_map_id?: string | null
  picked_map_id?: string | null
  // 팀전(4경기) 한정: 랜덤 종족으로 출전하는 선수 id 목록
  random_player_ids?: number[]
}

/** 밴 선택이 필요한 경기 슬롯 번호 */
export const BAN_SLOTS = [2, 3] as const

// ── 엔트리 레코드 (공개용) ────────────────────────────────────
export interface EntryRecord {
  captain_player_id: number
  match_slot: number
  player_ids: number[]
  banned_map_id: string | null
  picked_map_id: string | null
  random_player_ids: number[]
}

// ── DB CRUD ─────────────────────────────────────────────────
export async function getEntries(
  scheduleId: number,
  captainPlayerId: number,
): Promise<EntrySlot[]> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('match_slot, player_ids, banned_map_id, picked_map_id, random_player_ids')
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
    picked_map_id: s.picked_map_id ?? null,
    random_player_ids: s.random_player_ids ?? [],
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

// 엔트리 마감: 경기 당일 20:00 (한국 시간). 이후엔 제출 취소 불가(제출이 확정된다).
// 서버(cancel_entry_submission)는 DB 함수 entry_deadline()으로 같은 시각을 검사한다 — 바꿀 때 함께 바꾼다.
// 승부예측 마감과 지금은 같은 시각이지만 규정이 따로라 상수도 따로 둔다
export const ENTRY_DEADLINE_KST = '20:00'

export function getEntryDeadline(matchDate: string): Date {
  return new Date(`${matchDate}T${ENTRY_DEADLINE_KST}:00+09:00`)
}

/** 제출 취소 가능 여부 — 공개 전 + 마감 전. 날짜 미정 경기는 마감이 없다 */
export function canCancelSubmission(
  schedule: { is_entry_revealed: boolean; match_date: string | null },
  now: Date = new Date(),
): boolean {
  if (schedule.is_entry_revealed) return false
  return !schedule.match_date || now < getEntryDeadline(schedule.match_date)
}

/**
 * 엔트리 제출 취소 → 저장 상태로 되돌린다. 우리 쪽 공개 동의도 함께 풀린다.
 * 공개·마감 검사를 서버가 한 번에 해야 상대가 동의를 누르는 순간과 겹쳐도 공개 후 취소가 안 된다
 */
export async function cancelEntrySubmission(scheduleId: number, captainPlayerId: number): Promise<void> {
  const { error } = await supabase.rpc('cancel_entry_submission', {
    p_schedule_id: scheduleId,
    p_captain_player_id: captainPlayerId,
  })
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

/** 여러 경기의 엔트리 일괄 조회 */
export async function getEntriesForSchedules(scheduleIds: number[]): Promise<(EntryRecord & { schedule_id: number })[]> {
  if (!scheduleIds.length) return []
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('schedule_id, captain_player_id, match_slot, player_ids, banned_map_id, picked_map_id, random_player_ids')
    .in('schedule_id', scheduleIds)
  if (error) throw error
  return (data ?? []) as (EntryRecord & { schedule_id: number })[]
}

/** 경기의 모든 팀장 엔트리 조회 (엔트리 공개용) */
export async function getScheduleEntries(scheduleId: number): Promise<EntryRecord[]> {
  const { data, error } = await supabase
    .from('league_match_entries')
    .select('captain_player_id, match_slot, player_ids, banned_map_id, picked_map_id, random_player_ids')
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
/**
 * 최종 팀 로스터(팀장이 맨 앞). 저장된 지목식 픽(`league_draft_picks`)이 곧 최종 팀이다.
 *
 * 시드권 교체(`league_swap_log`)를 여기서 다시 적용하면 안 된다 — 지목식 최종 저장은 교체가 이미
 * 반영된 팀 구성을 픽으로 저장하므로(DraftView `saveDraft`), 한 번 더 적용하면 교체가 뒤집혀
 * 교체 전 팀이 나온다. 교체 기록은 지목식 화면의 "시드권 적용 기록" 표시용이다.
 */
export function computeFinalRosters(
  captains: CaptainRow[],
  picks: DraftPickRow[],
): Map<number, number[]> {
  const rosters = new Map<number, number[]>()
  for (const c of captains) {
    const members = picks
      .filter(p => p.captain_player_id === c.player_id)
      .sort((a, b) => a.pick_order - b.pick_order)
      .map(p => p.member_player_id)
    rosters.set(c.player_id, [c.player_id, ...members])
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
    .upsert(
      { schedule_id: scheduleId, captain_player_id: captainPlayerId, tier_ban: tierBan },
      { onConflict: 'schedule_id,captain_player_id' },
    )
  if (error) throw error
}
