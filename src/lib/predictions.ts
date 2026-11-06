import { supabase } from './supabase'

export interface PredictionRow {
  id: number
  schedule_id: number
  user_id: number
  predicted_winner_captain_id: number
  bet_amount: number
  locked_multiplier: number
  points_earned: number
  created_at: string
  updated_at: string
}

export interface PredictableMatch {
  schedule_id: number
  league_id: string
  league_name: string
  match_date: string
  match_type: string
  round: number
  team_a_captain_id: number
  team_b_captain_id: number
  team_a_name: string
  team_b_name: string
  team_a_race: string | null
  team_b_race: string | null
  is_completed: boolean
  winner_captain_id: number | null
  user_prediction_captain_id: number | null
  user_bet_amount: number | null
  user_points_earned: number | null
  user_final_multiplier: number | null
  deadline: string
  is_open: boolean
  in_window: boolean
  // pool / live odds
  total_bet_a: number
  total_bet_b: number
  total_pot: number
  prob_a: number   // 0..1
  prob_b: number
  multiplier_a: number  // ∞-style: 0이면 베팅 없음
  multiplier_b: number
}

export interface RankingRow {
  user_id: number
  nickname: string
  race: string
  tier: string
  /** 그 리그 지갑 잔액 */
  points: number
  correct_count: number
  resolved_count: number
  pending_count: number
  accuracy: number
}

function isoDateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function getCurrentMonday(now: Date = new Date()): Date {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

export function getNextMonday(now: Date = new Date()): Date {
  const m = getCurrentMonday(now)
  m.setDate(m.getDate() + 7)
  return m
}

// 예측 마감: 경기 당일 20:00 (한국 시간).
// 서버(place_prediction / cancel_prediction)는 DB 함수 prediction_deadline()으로 같은 시각을 검사한다.
// 바꿀 때는 두 곳을 함께 바꾼다. 브라우저 시간대와 무관하게 +09:00으로 계산
export const PREDICTION_DEADLINE_KST = '20:00'

export function getPredictionDeadline(matchDate: string): Date {
  return new Date(`${matchDate}T${PREDICTION_DEADLINE_KST}:00+09:00`)
}

export function isPredictionOpen(matchDate: string, now: Date = new Date()): boolean {
  return now < getPredictionDeadline(matchDate)
}

export function isInPredictionWindow(matchDate: string, now: Date = new Date()): boolean {
  const monday = getCurrentMonday(now)
  const nextMonday = getNextMonday(now)
  const match = new Date(`${matchDate}T00:00:00`)
  return match >= monday && match <= nextMonday
}

function matchTypeLabel(type: string, round: number): string {
  if (type === 'regular') return `${round}R`
  if (type === 'semifinal') return '4강'
  if (type === 'final_set1') return '결승 1세트'
  if (type === 'final_set2') return '결승 2세트'
  if (type === 'super_ace') return '슈퍼에이스'
  return type
}

export { matchTypeLabel }

// 라이브 배수 계산: pari-mutuel
// 본인이 X를 추가 베팅한다고 가정할 때, 그 팀의 예상 배수
export function previewMultiplier(
  myTotal: number,
  otherTotal: number,
  additionalBet: number,
): number {
  const myNew = myTotal + additionalBet
  const pot = myNew + otherTotal
  if (myNew === 0) return 0
  return Math.round((pot / myNew) * 1000) / 1000
}

// 현재 시점 배수 (베팅 없이)
export function currentMultiplier(myTotal: number, otherTotal: number): number {
  if (myTotal === 0) return 0
  const pot = myTotal + otherTotal
  return Math.round((pot / myTotal) * 1000) / 1000
}

function fillLivePool(m: PredictableMatch) {
  m.total_pot = m.total_bet_a + m.total_bet_b
  m.prob_a = m.total_pot > 0 ? m.total_bet_a / m.total_pot : 0.5
  m.prob_b = m.total_pot > 0 ? m.total_bet_b / m.total_pot : 0.5
  m.multiplier_a = currentMultiplier(m.total_bet_a, m.total_bet_b)
  m.multiplier_b = currentMultiplier(m.total_bet_b, m.total_bet_a)
}

export async function getPredictableMatches(userId: number, now: Date = new Date()): Promise<PredictableMatch[]> {
  const monday = getCurrentMonday(now)
  const nextMonday = getNextMonday(now)

  const { data: schedules, error } = await supabase
    .from('league_schedules')
    .select('id, league_id, round, match_date, team_a_captain_id, team_b_captain_id, match_type, is_completed, winner_captain_id')
    .gte('match_date', isoDateOnly(monday))
    .lte('match_date', isoDateOnly(nextMonday))
    .order('match_date', { ascending: true })
    .order('id', { ascending: true })
  if (error) throw error
  if (!schedules || !schedules.length) return []

  const leagueIds = [...new Set(schedules.map(s => s.league_id))]
  const captainIds = [...new Set(schedules.flatMap(s => [s.team_a_captain_id, s.team_b_captain_id]))]
  const scheduleIds = schedules.map(s => s.id)

  const [
    { data: leagues },
    { data: teamNames },
    { data: users },
    { data: myPredictions },
    { data: allPredictions },
  ] = await Promise.all([
    supabase.from('leagues').select('id, name').in('id', leagueIds),
    supabase.from('league_team_names').select('league_id, captain_player_id, team_name').in('league_id', leagueIds),
    supabase.from('users').select('id, nickname, race').in('id', captainIds),
    supabase.from('match_predictions').select('schedule_id, predicted_winner_captain_id, bet_amount, points_earned, locked_multiplier').eq('user_id', userId).in('schedule_id', scheduleIds),
    supabase.from('match_predictions').select('schedule_id, predicted_winner_captain_id, bet_amount').in('schedule_id', scheduleIds),
  ])

  const leagueById = new Map<string, string>((leagues ?? []).map(l => [l.id, l.name]))
  const userById = new Map<number, { nickname: string; race: string }>((users ?? []).map(u => [u.id, { nickname: u.nickname, race: u.race }]))
  const teamNameMap = new Map<string, string>()
  for (const tn of teamNames ?? []) teamNameMap.set(`${tn.league_id}-${tn.captain_player_id}`, tn.team_name)
  const myByScheduleId = new Map<number, { captainId: number; bet: number; points: number; mult: number }>()
  for (const p of myPredictions ?? []) myByScheduleId.set(p.schedule_id, { captainId: p.predicted_winner_captain_id, bet: p.bet_amount, points: p.points_earned, mult: Number(p.locked_multiplier) })

  const aggA = new Map<number, number>()
  const aggB = new Map<number, number>()
  const schedById = new Map<number, { a: number; b: number }>()
  for (const s of schedules) schedById.set(s.id, { a: s.team_a_captain_id, b: s.team_b_captain_id })
  for (const p of allPredictions ?? []) {
    const sched = schedById.get(p.schedule_id)
    if (!sched) continue
    if (p.predicted_winner_captain_id === sched.a) aggA.set(p.schedule_id, (aggA.get(p.schedule_id) ?? 0) + p.bet_amount)
    if (p.predicted_winner_captain_id === sched.b) aggB.set(p.schedule_id, (aggB.get(p.schedule_id) ?? 0) + p.bet_amount)
  }

  return schedules.map(s => {
    const leagueName = leagueById.get(s.league_id) ?? '리그'
    const aUser = userById.get(s.team_a_captain_id)
    const bUser = userById.get(s.team_b_captain_id)
    const teamA = teamNameMap.get(`${s.league_id}-${s.team_a_captain_id}`) ?? aUser?.nickname ?? '?'
    const teamB = teamNameMap.get(`${s.league_id}-${s.team_b_captain_id}`) ?? bUser?.nickname ?? '?'
    const deadline = getPredictionDeadline(s.match_date as string)
    const my = myByScheduleId.get(s.id) ?? null
    const m: PredictableMatch = {
      schedule_id: s.id,
      league_id: s.league_id,
      league_name: leagueName,
      match_date: s.match_date as string,
      match_type: s.match_type,
      round: s.round,
      team_a_captain_id: s.team_a_captain_id,
      team_b_captain_id: s.team_b_captain_id,
      team_a_name: teamA,
      team_b_name: teamB,
      team_a_race: aUser?.race ?? null,
      team_b_race: bUser?.race ?? null,
      is_completed: s.is_completed,
      winner_captain_id: s.winner_captain_id,
      user_prediction_captain_id: my?.captainId ?? null,
      user_bet_amount: my?.bet ?? null,
      user_points_earned: my?.points ?? null,
      user_final_multiplier: my && my.mult > 0 ? my.mult : null,
      deadline: deadline.toISOString(),
      is_open: !s.is_completed && now < deadline,
      in_window: true,
      total_bet_a: aggA.get(s.id) ?? 0,
      total_bet_b: aggB.get(s.id) ?? 0,
      total_pot: 0, prob_a: 0, prob_b: 0, multiplier_a: 0, multiplier_b: 0,
    }
    fillLivePool(m)
    return m
  })
}

export async function getMatchForPrediction(scheduleId: number, userId: number): Promise<PredictableMatch | null> {
  const { data: s, error } = await supabase
    .from('league_schedules')
    .select('id, league_id, round, match_date, team_a_captain_id, team_b_captain_id, match_type, is_completed, winner_captain_id')
    .eq('id', scheduleId)
    .single()
  if (error || !s) return null

  const [
    { data: league },
    { data: teamNames },
    { data: users },
    { data: myPred },
    { data: allPreds },
  ] = await Promise.all([
    supabase.from('leagues').select('id, name').eq('id', s.league_id).single(),
    supabase.from('league_team_names').select('captain_player_id, team_name').eq('league_id', s.league_id),
    supabase.from('users').select('id, nickname, race').in('id', [s.team_a_captain_id, s.team_b_captain_id]),
    supabase.from('match_predictions').select('predicted_winner_captain_id, bet_amount, points_earned, locked_multiplier').eq('user_id', userId).eq('schedule_id', scheduleId).maybeSingle(),
    supabase.from('match_predictions').select('predicted_winner_captain_id, bet_amount').eq('schedule_id', scheduleId),
  ])

  const userMap = new Map<number, { nickname: string; race: string }>((users ?? []).map(u => [u.id, { nickname: u.nickname, race: u.race }]))
  const tnMap = new Map<number, string>((teamNames ?? []).map(t => [t.captain_player_id, t.team_name]))
  const aUser = userMap.get(s.team_a_captain_id)
  const bUser = userMap.get(s.team_b_captain_id)
  const deadline = getPredictionDeadline(s.match_date as string)
  const now = new Date()

  let aBet = 0, bBet = 0
  for (const p of allPreds ?? []) {
    if (p.predicted_winner_captain_id === s.team_a_captain_id) aBet += p.bet_amount
    if (p.predicted_winner_captain_id === s.team_b_captain_id) bBet += p.bet_amount
  }
  const myMult = myPred ? Number(myPred.locked_multiplier) : 0

  const m: PredictableMatch = {
    schedule_id: s.id,
    league_id: s.league_id,
    league_name: league?.name ?? '리그',
    match_date: s.match_date as string,
    match_type: s.match_type,
    round: s.round,
    team_a_captain_id: s.team_a_captain_id,
    team_b_captain_id: s.team_b_captain_id,
    team_a_name: tnMap.get(s.team_a_captain_id) ?? aUser?.nickname ?? '?',
    team_b_name: tnMap.get(s.team_b_captain_id) ?? bUser?.nickname ?? '?',
    team_a_race: aUser?.race ?? null,
    team_b_race: bUser?.race ?? null,
    is_completed: s.is_completed,
    winner_captain_id: s.winner_captain_id,
    user_prediction_captain_id: myPred?.predicted_winner_captain_id ?? null,
    user_bet_amount: myPred?.bet_amount ?? null,
    user_points_earned: myPred?.points_earned ?? null,
    user_final_multiplier: myMult > 0 ? myMult : null,
    deadline: deadline.toISOString(),
    is_open: !s.is_completed && now < deadline,
    in_window: isInPredictionWindow(s.match_date as string, now),
    total_bet_a: aBet,
    total_bet_b: bBet,
    total_pot: 0, prob_a: 0, prob_b: 0, multiplier_a: 0, multiplier_b: 0,
  }
  fillLivePool(m)
  return m
}

// 베팅·취소는 로그인한 본인 기준이다(서버가 current_user_id()로 판단). 사용자 id를 넘기지 않는다
export async function placePrediction(scheduleId: number, captainId: number, betAmount: number): Promise<{ remaining_points: number }> {
  const { data, error } = await supabase.rpc('place_prediction', {
    p_schedule_id: scheduleId,
    p_captain_id: captainId,
    p_bet_amount: betAmount,
  })
  if (error) throw error
  return data as { remaining_points: number }
}

export async function cancelPrediction(scheduleId: number): Promise<{ cancelled: boolean; refunded?: number; remaining_points: number }> {
  const { data, error } = await supabase.rpc('cancel_prediction', { p_schedule_id: scheduleId })
  if (error) throw error
  return data as { cancelled: boolean; refunded?: number; remaining_points: number }
}

// ── 리그별 포인트 지갑 ─────────────────────────────────────
// 승부예측 포인트는 리그마다 따로다. 지갑(league_point_wallets)은 처음 베팅·출석할 때
// 서버가 그 리그의 시작 포인트(leagues.prediction_start_points)로 만든다.
// 아직 지갑이 없으면 시작 포인트를 그대로 보여준다(만들어지면 그 값에서 시작하므로 같다)
export interface LeagueWallet {
  league_id: string
  league_name: string
  points: number
}

export async function getMyLeagueWallets(userId: number, leagueIds: string[]): Promise<LeagueWallet[]> {
  const ids = [...new Set(leagueIds)]
  if (!ids.length) return []
  const [{ data: leagues, error: lErr }, { data: wallets, error: wErr }] = await Promise.all([
    supabase.from('leagues').select('id, name, prediction_start_points, start_date').in('id', ids),
    supabase.from('league_point_wallets').select('league_id, points').eq('user_id', userId).in('league_id', ids),
  ])
  if (lErr) throw lErr
  if (wErr) throw wErr
  const walletBy = new Map<string, number>((wallets ?? []).map(w => [w.league_id, w.points]))
  return (leagues ?? [])
    .sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)))
    .map(l => ({ league_id: l.id, league_name: l.name, points: walletBy.get(l.id) ?? l.prediction_start_points ?? 0 }))
}

export interface PredictionLeague {
  id: string
  name: string
  start_date: string
  end_date: string
}

/** 랭킹에서 고를 수 있는 리그(최근 시작 순)와 기본 선택(진행 중인 리그, 없으면 가장 최근 리그) */
export async function getPredictionLeagues(now: Date = new Date()): Promise<{ leagues: PredictionLeague[]; defaultId: string | null }> {
  const { data, error } = await supabase
    .from('leagues')
    .select('id, name, start_date, end_date')
    .order('start_date', { ascending: false })
  if (error) throw error
  const leagues = (data ?? []) as PredictionLeague[]
  const today = isoDateOnly(new Date(now.getTime() + (now.getTimezoneOffset() + 540) * 60000))
  const active = leagues.find(l => l.start_date <= today && today <= l.end_date)
  return { leagues, defaultId: active?.id ?? leagues[0]?.id ?? null }
}

// ── 랭킹 (리그별) ─────────────────────────────────────────
// 순위 = 그 리그 지갑 잔액(출석 보상 포함). 그 리그에 한 번이라도 예측한 사용자만 나온다.
// 맞힘/정확도는 정산된 예측 중 환불(적중자 없음)을 뺀 것 기준 — 예전엔 환불도 받은 금액이 있어 맞힘으로 셌다
export async function getRankings(leagueId: string): Promise<RankingRow[]> {
  const { data: schedules, error: sErr } = await supabase
    .from('league_schedules')
    .select('id')
    .eq('league_id', leagueId)
  if (sErr) throw sErr
  const scheduleIds = (schedules ?? []).map(s => s.id)
  if (!scheduleIds.length) return []

  const [{ data: predictions, error: pErr }, { data: wallets, error: wErr }, { data: league, error: lErr }] = await Promise.all([
    supabase.from('match_predictions').select('user_id, bet_amount, points_earned, locked_multiplier, settled_at').in('schedule_id', scheduleIds),
    supabase.from('league_point_wallets').select('user_id, points').eq('league_id', leagueId),
    supabase.from('leagues').select('prediction_start_points').eq('id', leagueId).single(),
  ])
  if (pErr) throw pErr
  if (wErr) throw wErr
  if (lErr) throw lErr

  const agg = new Map<number, { correct: number; resolved: number; pending: number }>()
  for (const p of predictions ?? []) {
    const cur = agg.get(p.user_id) ?? { correct: 0, resolved: 0, pending: 0 }
    if (!p.settled_at) cur.pending++
    else if (Number(p.locked_multiplier) > 0) { cur.resolved++; cur.correct++ }
    else if (p.points_earned === p.bet_amount) { /* 적중자 없어 환불 — 맞힘/틀림에 넣지 않는다 */ }
    else cur.resolved++
    agg.set(p.user_id, cur)
  }
  if (!agg.size) return []

  const { data: users, error: uErr } = await supabase
    .from('users')
    .select('id, nickname, race, tier')
    .in('id', [...agg.keys()])
  if (uErr) throw uErr

  const walletBy = new Map<number, number>((wallets ?? []).map(w => [w.user_id, w.points]))
  const startPoints = league?.prediction_start_points ?? 0
  const rows: RankingRow[] = (users ?? []).map(u => {
    const a = agg.get(u.id)!
    return {
      user_id: u.id,
      nickname: u.nickname,
      race: u.race,
      tier: u.tier,
      points: walletBy.get(u.id) ?? startPoints,
      correct_count: a.correct,
      resolved_count: a.resolved,
      pending_count: a.pending,
      accuracy: a.resolved > 0 ? (a.correct / a.resolved) * 100 : 0,
    }
  })
  return rows.sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || a.nickname.localeCompare(b.nickname))
}
