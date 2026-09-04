import { supabase } from './supabase'
import { tierPoint } from './constants'

export type TeamBattleStatus =
  | 'RECRUITING'
  | 'ASSIGNED'
  | 'ENTRY'
  | 'PLAYING'
  | 'ACE_WAITING'
  | 'ACE_ENTRY'
  | 'FINISHED'
  | 'CANCELLED'

export type AceMode = 'RANDOM' | 'CAPTAIN'

export const TEAM_BATTLE_STATUS_LABEL: Record<TeamBattleStatus, string> = {
  RECRUITING: '모집 중',
  ASSIGNED: '팀 배정 완료',
  ENTRY: '엔트리 제출 중',
  PLAYING: '경기 진행 중',
  ACE_WAITING: '에이스 결정전 대기',
  ACE_ENTRY: '에이스 선수 확정 중',
  FINISHED: '종료',
  CANCELLED: '취소됨',
}

export interface TeamBattleRow {
  id: string
  name: string
  host_user_id: number
  start_at: string
  status: TeamBattleStatus
  ace_mode: AceMode
  winner_team: 1 | 2 | null
  created_at: string
  updated_at: string
}

export interface TeamBattlePlayerRow {
  battle_id: string
  user_id: number
  race: 'T' | 'Z' | 'P'
  tier: string
  is_offrace: boolean
  team_no: 1 | 2 | null
  is_leader: boolean
}

export interface TeamBattleMapRow {
  battle_id: string
  order_index: number
  map_id: string
  is_ace: boolean
}

export interface TeamBattleEntryRow {
  battle_id: string
  team_no: 1 | 2
  order_index: number
  user_id: number | null
}

export interface TeamBattleMatchRow {
  battle_id: string
  order_index: number
  map_id: string
  team1_user_id: number | null
  team2_user_id: number | null
  winner_team: 1 | 2 | null
  is_ace: boolean
}

// ── 팀배틀 본체 ─────────────────────────────────────────────
export async function getTeamBattles(): Promise<TeamBattleRow[]> {
  const { data, error } = await supabase
    .from('team_battles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function getTeamBattle(id: string): Promise<TeamBattleRow> {
  const { data, error } = await supabase
    .from('team_battles')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** 팀배틀 생성 + 주최자를 참가자로 자동 등록 */
export async function createTeamBattle(
  payload: { name: string; start_at: string; ace_mode: AceMode },
  host: { id: number; race: 'T' | 'Z' | 'P'; tier: string },
): Promise<TeamBattleRow> {
  const { data: battle, error } = await supabase
    .from('team_battles')
    .insert({ ...payload, host_user_id: host.id })
    .select()
    .single()
  if (error) throw error

  const { error: joinError } = await supabase.from('team_battle_players').insert({
    battle_id: battle.id,
    user_id: host.id,
    race: host.race,
    tier: host.tier,
    is_offrace: false,
  })
  if (joinError) throw joinError

  return battle
}

/** 주최자 강제 종료 */
export async function cancelTeamBattle(id: string): Promise<void> {
  const { error } = await supabase
    .from('team_battles')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

async function updateStatus(id: string, status: TeamBattleStatus): Promise<void> {
  const { error } = await supabase
    .from('team_battles')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

// ── 참가자 ──────────────────────────────────────────────────
export async function getTeamBattlePlayers(battleId: string): Promise<TeamBattlePlayerRow[]> {
  const { data, error } = await supabase
    .from('team_battle_players')
    .select('*')
    .eq('battle_id', battleId)
  if (error) throw error
  return data
}

/**
 * 참가 신청. race가 본인 주종족과 다르면 부종족 참가로 간주해 is_offrace=true —
 * 이 경우 티어는 항상 주종족 티어를 그대로 쓰고(host 파라미터의 tier), 전적은 반영하지 않는다.
 */
export async function joinTeamBattle(
  battleId: string,
  player: { id: number; race: 'T' | 'Z' | 'P'; tier: string },
  selectedRace: 'T' | 'Z' | 'P',
): Promise<void> {
  const isOffrace = selectedRace !== player.race
  const { error } = await supabase.from('team_battle_players').upsert(
    {
      battle_id: battleId,
      user_id: player.id,
      race: selectedRace,
      tier: player.tier,
      is_offrace: isOffrace,
    },
    { onConflict: 'battle_id,user_id' },
  )
  if (error) throw error
}

export async function leaveTeamBattle(battleId: string, userId: number): Promise<void> {
  const { error } = await supabase
    .from('team_battle_players')
    .delete()
    .eq('battle_id', battleId)
    .eq('user_id', userId)
  if (error) throw error
}

// ── 팀 자동 배정 (밸런싱) ─────────────────────────────────────
export interface AssignResult {
  team1: TeamBattlePlayerRow[]
  team2: TeamBattlePlayerRow[]
  team1Score: number
  team2Score: number
}

/**
 * 그리디 밸런싱: 티어 점수(tierPoint) 내림차순 정렬(동점은 랜덤) 후,
 * 매번 점수 합이 더 낮은 팀에 배정하되, 인원수 차이가 1명을 넘지 않도록
 * 강제한다(한쪽이 목표 인원에 먼저 도달하면 남은 인원은 전부 반대 팀으로).
 * 순수 점수 기준으로만 배정하면 "고티어 1명 + 동티어 다수" 같은 조합에서
 * 2명 vs 4명처럼 인원수가 심하게 갈릴 수 있어 이를 방지한다.
 * 인원이 홀수면 한 팀이 1명 많아진다. 주최자가 몇 번이든 재실행 가능 —
 * 매번 team_no/is_leader를 덮어쓴다.
 */
export async function assignTeams(battleId: string): Promise<AssignResult> {
  const players = await getTeamBattlePlayers(battleId)
  if (players.length < 4) throw new Error('참가자가 4명 이상이어야 팀을 배정할 수 있습니다.')

  const sorted = [...players]
    .map(p => ({ p, point: tierPoint(p.tier), rand: Math.random() }))
    .sort((a, b) => b.point - a.point || a.rand - b.rand)
    .map(x => x.p)

  const targetSize1 = Math.ceil(sorted.length / 2)
  const targetSize2 = sorted.length - targetSize1

  const team1: TeamBattlePlayerRow[] = []
  const team2: TeamBattlePlayerRow[] = []
  let score1 = 0
  let score2 = 0
  for (const p of sorted) {
    const point = tierPoint(p.tier)
    if (team1.length >= targetSize1) { team2.push(p); score2 += point }
    else if (team2.length >= targetSize2) { team1.push(p); score1 += point }
    else if (score1 <= score2) { team1.push(p); score1 += point }
    else { team2.push(p); score2 += point }
  }

  const leader1 = team1[Math.floor(Math.random() * team1.length)]
  const leader2 = team2[Math.floor(Math.random() * team2.length)]

  const updates = [
    ...team1.map(p => ({ battle_id: battleId, user_id: p.user_id, race: p.race, tier: p.tier, is_offrace: p.is_offrace, team_no: 1, is_leader: p.user_id === leader1.user_id })),
    ...team2.map(p => ({ battle_id: battleId, user_id: p.user_id, race: p.race, tier: p.tier, is_offrace: p.is_offrace, team_no: 2, is_leader: p.user_id === leader2.user_id })),
  ]
  const { error } = await supabase.from('team_battle_players').upsert(updates, { onConflict: 'battle_id,user_id' })
  if (error) throw error

  await updateStatus(battleId, 'ASSIGNED')

  return {
    team1: updates.filter(u => u.team_no === 1) as unknown as TeamBattlePlayerRow[],
    team2: updates.filter(u => u.team_no === 2) as unknown as TeamBattlePlayerRow[],
    team1Score: score1,
    team2Score: score2,
  }
}

/** 팀장 재지정 — 같은 팀 내에서 기존 팀장을 내리고 새 팀장을 세운다 */
export async function reassignLeader(battleId: string, teamNo: 1 | 2, newLeaderUserId: number): Promise<void> {
  const { error: clearError } = await supabase
    .from('team_battle_players')
    .update({ is_leader: false })
    .eq('battle_id', battleId)
    .eq('team_no', teamNo)
  if (clearError) throw clearError

  const { error } = await supabase
    .from('team_battle_players')
    .update({ is_leader: true })
    .eq('battle_id', battleId)
    .eq('user_id', newLeaderUserId)
  if (error) throw error
}

// ── 맵 ──────────────────────────────────────────────────────
export async function getTeamBattleMaps(battleId: string): Promise<TeamBattleMapRow[]> {
  const { data, error } = await supabase
    .from('team_battle_maps')
    .select('*')
    .eq('battle_id', battleId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data
}

/** 일반 경기 맵 전체 교체 (에이스 맵은 건드리지 않음). 중복 맵 허용. */
export async function setTeamBattleMaps(battleId: string, mapIds: string[]): Promise<void> {
  const { error: delError } = await supabase
    .from('team_battle_maps')
    .delete()
    .eq('battle_id', battleId)
    .eq('is_ace', false)
  if (delError) throw delError

  if (mapIds.length === 0) return

  const rows = mapIds.map((map_id, i) => ({ battle_id: battleId, order_index: i, map_id, is_ace: false }))
  const { error } = await supabase.from('team_battle_maps').insert(rows)
  if (error) throw error
}

// ── 엔트리 ──────────────────────────────────────────────────
export async function getTeamBattleEntries(battleId: string): Promise<TeamBattleEntryRow[]> {
  const { data, error } = await supabase
    .from('team_battle_entries')
    .select('*')
    .eq('battle_id', battleId)
    .order('team_no', { ascending: true })
    .order('order_index', { ascending: true })
  if (error) throw error
  return data
}

/** 팀별 출전 순서 제출 (중복 출전 허용 — 같은 user_id가 여러 order_index에 올 수 있음) */
export async function submitEntry(battleId: string, teamNo: 1 | 2, userIds: number[]): Promise<void> {
  const { error: delError } = await supabase
    .from('team_battle_entries')
    .delete()
    .eq('battle_id', battleId)
    .eq('team_no', teamNo)
  if (delError) throw delError

  const rows = userIds.map((user_id, i) => ({ battle_id: battleId, team_no: teamNo, order_index: i, user_id }))
  const { error } = await supabase.from('team_battle_entries').insert(rows)
  if (error) throw error
}

/** 양 팀 엔트리 공개 → 맵×엔트리로 경기(team_battle_matches) 생성 → PLAYING 전환 */
export async function publishEntries(battleId: string): Promise<void> {
  const [maps, entries] = await Promise.all([
    getTeamBattleMaps(battleId),
    getTeamBattleEntries(battleId),
  ])
  const regularMaps = maps.filter(m => !m.is_ace)
  const team1Entries = entries.filter(e => e.team_no === 1)
  const team2Entries = entries.filter(e => e.team_no === 2)

  if (team1Entries.length < regularMaps.length || team2Entries.length < regularMaps.length) {
    throw new Error('아직 엔트리를 제출하지 않은 팀이 있습니다.')
  }

  const { error: delError } = await supabase
    .from('team_battle_matches')
    .delete()
    .eq('battle_id', battleId)
    .eq('is_ace', false)
  if (delError) throw delError

  const rows = regularMaps.map((m, i) => ({
    battle_id: battleId,
    order_index: i,
    map_id: m.map_id,
    team1_user_id: team1Entries[i]?.user_id ?? null,
    team2_user_id: team2Entries[i]?.user_id ?? null,
    is_ace: false,
  }))
  const { error } = await supabase.from('team_battle_matches').insert(rows)
  if (error) throw error

  await updateStatus(battleId, 'PLAYING')
}

// ── 경기 결과 ────────────────────────────────────────────────
export async function getTeamBattleMatches(battleId: string): Promise<TeamBattleMatchRow[]> {
  const { data, error } = await supabase
    .from('team_battle_matches')
    .select('*')
    .eq('battle_id', battleId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return data
}

export async function setMatchWinner(battleId: string, orderIndex: number, winnerTeam: 1 | 2): Promise<void> {
  const { error } = await supabase
    .from('team_battle_matches')
    .update({ winner_team: winnerTeam })
    .eq('battle_id', battleId)
    .eq('order_index', orderIndex)
  if (error) throw error
}

// ── 에이스 결정전 ────────────────────────────────────────────
/**
 * 에이스 맵 무작위 추첨 → team_battle_maps/team_battle_matches에 is_ace=true 행 생성.
 * aceMode를 넘기면(생성 시점에 정하지 않고 이 시점에 정하는 경우) 배틀의 ace_mode를
 * 함께 갱신한다. RANDOM이면 양 팀 선수도 이 시점에 무작위로 함께 배정하고,
 * CAPTAIN이면 선수는 비워둔 채(팀장이 웹에서 직접 선택) ACE_ENTRY로 전환한다.
 */
export async function drawAceMatch(battleId: string, aceMode?: AceMode): Promise<void> {
  const [battle, players, existingMaps, mapsResult] = await Promise.all([
    getTeamBattle(battleId),
    getTeamBattlePlayers(battleId),
    getTeamBattleMaps(battleId),
    supabase.from('maps').select('id'),
  ])
  if (mapsResult.error) throw mapsResult.error
  const mapIds = (mapsResult.data ?? []).map((m: { id: string }) => m.id)
  if (mapIds.length === 0) throw new Error('등록된 맵이 없습니다.')
  const mapId = mapIds[Math.floor(Math.random() * mapIds.length)]
  const orderIndex = existingMaps.filter(m => !m.is_ace).length

  const effectiveMode = aceMode ?? battle.ace_mode
  if (aceMode && aceMode !== battle.ace_mode) {
    const { error: modeError } = await supabase
      .from('team_battles')
      .update({ ace_mode: aceMode, updated_at: new Date().toISOString() })
      .eq('id', battleId)
    if (modeError) throw modeError
  }

  const { error: delMapError } = await supabase
    .from('team_battle_maps')
    .delete()
    .eq('battle_id', battleId)
    .eq('is_ace', true)
  if (delMapError) throw delMapError

  const { error: mapError } = await supabase
    .from('team_battle_maps')
    .insert({ battle_id: battleId, order_index: orderIndex, map_id: mapId, is_ace: true })
  if (mapError) throw mapError

  let team1UserId: number | null = null
  let team2UserId: number | null = null
  if (effectiveMode === 'RANDOM') {
    const team1 = players.filter(p => p.team_no === 1)
    const team2 = players.filter(p => p.team_no === 2)
    team1UserId = team1[Math.floor(Math.random() * team1.length)]?.user_id ?? null
    team2UserId = team2[Math.floor(Math.random() * team2.length)]?.user_id ?? null
  }

  const { error: delMatchError } = await supabase
    .from('team_battle_matches')
    .delete()
    .eq('battle_id', battleId)
    .eq('is_ace', true)
  if (delMatchError) throw delMatchError

  const { error: matchError } = await supabase.from('team_battle_matches').insert({
    battle_id: battleId,
    order_index: orderIndex,
    map_id: mapId,
    team1_user_id: team1UserId,
    team2_user_id: team2UserId,
    winner_team: null,
    is_ace: true,
  })
  if (matchError) throw matchError

  await updateStatus(battleId, 'ACE_ENTRY')
}

/** 에이스전 선수 확정 (팀장 지정 모드) — 해당 팀의 출전 선수만 갱신 */
export async function setAcePlayer(battleId: string, orderIndex: number, teamNo: 1 | 2, userId: number): Promise<void> {
  const field = teamNo === 1 ? 'team1_user_id' : 'team2_user_id'
  const { error } = await supabase
    .from('team_battle_matches')
    .update({ [field]: userId })
    .eq('battle_id', battleId)
    .eq('order_index', orderIndex)
  if (error) throw error
}

export async function finishTeamBattle(battleId: string, winnerTeam: 1 | 2): Promise<void> {
  await recordTeamBattleGames(battleId)

  const { error } = await supabase
    .from('team_battles')
    .update({ status: 'FINISHED', winner_team: winnerTeam, updated_at: new Date().toISOString() })
    .eq('id', battleId)
  if (error) throw error
}

/**
 * 종료 시점에 결과가 확정된 매치(정규 + 에이스)를 games에 반영한다.
 * 두 선수 중 한 명이라도 부종족 참가(is_offrace)면 그 경기는 전적에 반영하지 않는다.
 */
async function recordTeamBattleGames(battleId: string): Promise<void> {
  const [matches, players, usersRes, mapsRes] = await Promise.all([
    getTeamBattleMatches(battleId),
    getTeamBattlePlayers(battleId),
    supabase.from('users').select('id, nickname'),
    supabase.from('maps').select('id, name'),
  ])
  if (usersRes.error) throw usersRes.error
  if (mapsRes.error) throw mapsRes.error

  const nicknameOf = new Map<number, string>(
    (usersRes.data ?? []).map((u: { id: number; nickname: string }) => [u.id, u.nickname]),
  )
  const mapNameOf = new Map<string, string>(
    (mapsRes.data ?? []).map((m: { id: string; name: string }) => [m.id, m.name]),
  )
  const playerOf = new Map<number, TeamBattlePlayerRow>(players.map(p => [p.user_id, p]))

  const rows = matches
    .filter(m => m.winner_team !== null && m.team1_user_id !== null && m.team2_user_id !== null)
    .filter(m => {
      const p1 = playerOf.get(m.team1_user_id!)
      const p2 = playerOf.get(m.team2_user_id!)
      return !!p1 && !!p2 && !p1.is_offrace && !p2.is_offrace
    })
    .map(m => {
      const p1 = playerOf.get(m.team1_user_id!)!
      const p2 = playerOf.get(m.team2_user_id!)!
      const winner = m.winner_team === 1 ? p1 : p2
      const loser = m.winner_team === 1 ? p2 : p1
      return {
        map_name: mapNameOf.get(m.map_id) ?? null,
        winner_name: nicknameOf.get(winner.user_id) ?? null,
        winner_race: winner.race,
        loser_name: nicknameOf.get(loser.user_id) ?? null,
        loser_race: loser.race,
        played_at: new Date().toISOString(),
        source: 'team_battle',
      }
    })

  if (rows.length === 0) return
  const { error } = await supabase.from('games').insert(rows)
  if (error) throw error
}

export { updateStatus as updateTeamBattleStatus }
