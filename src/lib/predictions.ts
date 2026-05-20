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
  total_points: number
  current_points: number
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

export function getPredictionDeadline(matchDate: string): Date {
  const d = new Date(`${matchDate}T00:00:00`)
  d.setDate(d.getDate() - 1)
  return d
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

export async function placePrediction(scheduleId: number, userId: number, captainId: number, betAmount: number): Promise<{ remaining_points: number }> {
  const { data, error } = await supabase.rpc('place_prediction', {
    p_schedule_id: scheduleId,
    p_user_id: userId,
    p_captain_id: captainId,
    p_bet_amount: betAmount,
  })
  if (error) throw error
  return data as { remaining_points: number }
}

export async function cancelPrediction(scheduleId: number, userId: number): Promise<{ cancelled: boolean; refunded?: number }> {
  const { data, error } = await supabase.rpc('cancel_prediction', {
    p_schedule_id: scheduleId,
    p_user_id: userId,
  })
  if (error) throw error
  return data as { cancelled: boolean; refunded?: number }
}

export async function getUserPoints(userId: number): Promise<number> {
  const { data, error } = await supabase.from('users').select('points').eq('id', userId).single()
  if (error) throw error
  return data?.points ?? 0
}

export async function getRankings(): Promise<RankingRow[]> {
  const [{ data: predictions }, { data: schedules }, { data: users }] = await Promise.all([
    supabase.from('match_predictions').select('user_id, points_earned, schedule_id, bet_amount'),
    supabase.from('league_schedules').select('id, is_completed, winner_captain_id'),
    supabase.from('users').select('id, nickname, race, tier, points'),
  ])

  const schedMap = new Map<number, { completed: boolean; winner: number | null }>(
    (schedules ?? []).map(s => [s.id, { completed: s.is_completed, winner: s.winner_captain_id }])
  )

  const agg = new Map<number, { points: number; correct: number; resolved: number; pending: number }>()
  for (const p of predictions ?? []) {
    const sched = schedMap.get(p.schedule_id)
    const cur = agg.get(p.user_id) ?? { points: 0, correct: 0, resolved: 0, pending: 0 }
    if (sched && sched.completed && sched.winner !== null) {
      cur.resolved++
      cur.points += p.points_earned
      if (p.points_earned > 0) cur.correct++
    } else {
      cur.pending++
    }
    agg.set(p.user_id, cur)
  }

  const rows: RankingRow[] = []
  for (const u of users ?? []) {
    const a = agg.get(u.id)
    if (!a) continue
    rows.push({
      user_id: u.id,
      nickname: u.nickname,
      race: u.race,
      tier: u.tier,
      total_points: a.points,
      current_points: u.points ?? 0,
      correct_count: a.correct,
      resolved_count: a.resolved,
      pending_count: a.pending,
      accuracy: a.resolved > 0 ? (a.correct / a.resolved) * 100 : 0,
    })
  }
  return rows.sort((a, b) => b.current_points - a.current_points || b.accuracy - a.accuracy || a.nickname.localeCompare(b.nickname))
}
