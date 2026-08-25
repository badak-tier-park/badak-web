export const TIER_ORDER = ['A+', 'A-', 'B+', 'B-', 'C+', 'C-', 'D+', 'D-', 'E'] as const
export type Tier = (typeof TIER_ORDER)[number]

export const RACE_ORDER = ['T', 'Z', 'P'] as const

/**
 * 티어별 포인트 (높을수록 상위 티어). 0.5 단위로 세분화된 9단계 체계.
 * 구 5단계 값(A/B/C/D)은 DB 마이그레이션 전까지의 레거시 별칭 — 점수값이 신규 체계와
 * 동일하게 보존되도록 매핑되어 있다 (구 A=5 → 신 A+=5).
 */
export const TIER_POINTS: Record<string, number> = {
  'A+': 5, 'A-': 4.5,
  'B+': 4, 'B-': 3.5,
  'C+': 3, 'C-': 2.5,
  'D+': 2, 'D-': 1.5,
  E: 1,
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

/** 핸디 계산용 1~9 단계 (E=1 … A+=9). 알 수 없는 값이면 0. */
export function tierStep(t?: string | null): number {
  const p = tierPoint(t)
  return p === 0 ? 0 : p * 2 - 1
}

/** CSS 클래스용 letter ('A+' → 'a'). */
export function tierClass(t?: string | null): string {
  return normalizeTier(t).charAt(0).toLowerCase()
}
