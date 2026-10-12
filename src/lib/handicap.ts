import { TIER_ORDER, tierPoint } from './constants'
import { INDIVIDUAL_SLOTS } from './entries'

/**
 * 티어 단계 차이별 핸디 한 줄 (`leagues.handicap_table`).
 * hp는 상위 티어 선수의 체력 %, note는 체력 외에 추가로 주는 핸디 설명.
 */
export interface HandicapRow {
  steps: number
  hp: number | null
  note: string
}

/** 가장 큰 단계 차이 (S ↔ E) */
export const MAX_TIER_STEPS = TIER_ORDER.length - 1

/** 두 티어의 단계 차이 (0.5P = 1단계) */
export function tierStepGap(a?: string | null, b?: string | null): number {
  return Math.round(Math.abs(tierPoint(a) - tierPoint(b)) * 2)
}

/**
 * 이 경기에 핸디를 적용하는지 — 양팀이 제출한 엔트리 포인트 차이가 리그 기준 이상일 때.
 * 기준은 시즌마다 바뀔 수 있어 리그 설정값(`leagues.handicap_point_gap`)이다. null이면 핸디 없음.
 */
export function isHandicapMatch(ptA: number, ptB: number, gap: number | null | undefined): boolean {
  return gap != null && Math.abs(ptA - ptB) >= gap
}

export interface SlotHandicap {
  /** 핸디를 받는(체력이 깎이는) 쪽 — 상위 티어 선수 */
  stronger: 'A' | 'B'
  steps: number
  hp: number | null
  note: string
}

/**
 * 개인전 한 경기의 핸디. 팀전·에이스 결정전은 핸디가 없다(규정).
 * 같은 티어이거나 표에 해당 단계가 비어 있으면 null.
 */
export function slotHandicap(
  slotNum: number,
  tierA: string | null | undefined,
  tierB: string | null | undefined,
  table: HandicapRow[] | null | undefined,
): SlotHandicap | null {
  if (!(INDIVIDUAL_SLOTS as readonly number[]).includes(slotNum)) return null
  const steps = tierStepGap(tierA, tierB)
  if (steps === 0) return null
  const row = table?.find(r => r.steps === steps)
  const note = row?.note?.trim() ?? ''
  if (!row || (row.hp == null && !note)) return null
  return { stronger: tierPoint(tierA) > tierPoint(tierB) ? 'A' : 'B', steps, hp: row.hp, note }
}

/** 표시용 문구 — 예) "홍길동 체력 90% · 일꾼 4기 시작" */
export function handicapText(h: SlotHandicap, strongerName: string): string {
  const parts = [h.hp != null ? `${strongerName} 체력 ${h.hp}%` : strongerName, h.note].filter(Boolean)
  return parts.join(' · ')
}
