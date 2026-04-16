export const TIER_ORDER = ['A', 'B', 'C', 'D', 'E'] as const
export const RACE_ORDER = ['T', 'Z', 'P'] as const

/** 티어별 랭크 (A가 가장 높음) */
export const TIER_RANK: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, E: 1 }

/** 티어별 랭크 (E가 가장 높음 — 팀장 순번용) */
export const TIER_RANK_ASC: Record<string, number> = { E: 1, D: 2, C: 3, B: 4, A: 5 }
