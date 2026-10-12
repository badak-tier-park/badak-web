export const TIER_ORDER = ['S', 'A+', 'A-', 'B+', 'B-', 'C+', 'C-', 'D+', 'D-', 'E'] as const
export type Tier = (typeof TIER_ORDER)[number]

export const RACE_ORDER = ['T', 'Z', 'P'] as const

/**
 * 티어별 포인트 (높을수록 상위 티어). 2026 윈터리그부터 S를 추가한 0.5 단위 10단계 체계.
 *
 * 구 5단계 값(A/B/C/D)은 그 시절 리그 스냅샷(league_player_snapshots)에 그대로 남아 있어
 * 지난 시즌 엔트리 포인트를 당시 점수로 보여주기 위해 **옛 점수값 그대로** 둔다. 지우면 지난
 * 시즌 선수가 0점이 된다. E만 신·구 이름이 겹쳐 지난 시즌 E는 0.5점으로 보인다 (운영진 합의).
 */
export const TIER_POINTS: Record<string, number> = {
  S: 5,
  'A+': 4.5, 'A-': 4,
  'B+': 3.5, 'B-': 3,
  'C+': 2.5, 'C-': 2,
  'D+': 1.5, 'D-': 1,
  E: 0.5,
  A: 5, B: 4, C: 3, D: 2,
}

/** 공백/전각 기호를 정리하고 대문자화한다. */
export function normalizeTier(t?: string | null): string {
  return (t ?? '')
    .trim()
    .toUpperCase()
    .replace(/[＋﹢]/g, '+')
    .replace(/[－–—ー]/g, '-')
    .replace(/\s+/g, '')
}

/** 티어 포인트(=순위 비교값). 알 수 없는 값이면 0. */
export function tierPoint(t?: string | null): number {
  return TIER_POINTS[normalizeTier(t)] ?? 0
}

/** 핸디 계산용 1~10 단계 (E=1 … S=10). 알 수 없는 값이면 0. */
export function tierStep(t?: string | null): number {
  return tierPoint(t) * 2
}

/**
 * CSS 클래스용 접미사. 'A+' -> 'a-plus', 'A-' -> 'a-minus', 'E' -> 'e'.
 * 구 5단계 값(예: 'A')은 부호가 없어 letter만 반환 — 테두리 없는 레거시 스타일로 폴백된다.
 */
export function tierClass(t?: string | null): string {
  const n = normalizeTier(t)
  const letter = n.charAt(0).toLowerCase()
  if (n.endsWith('+')) return `${letter}-plus`
  if (n.endsWith('-')) return `${letter}-minus`
  return letter
}
