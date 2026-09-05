import { supabase } from './supabase'

export type TournamentStatus = 'RECRUITING' | 'PLAYING' | 'FINISHED' | 'CANCELLED'

export const TOURNAMENT_STATUS_LABEL: Record<TournamentStatus, string> = {
  RECRUITING: '모집 중',
  PLAYING: '경기 진행 중',
  FINISHED: '종료',
  CANCELLED: '취소됨',
}

export interface TournamentRow {
  id: string
  name: string
  host_user_id: number
  start_at: string
  map_id: string | null
  status: TournamentStatus
  winner_user_id: number | null
  created_at: string
  updated_at: string
}

export interface TournamentPlayerRow {
  tournament_id: string
  user_id: number
  race: 'T' | 'Z' | 'P'
  tier: string
  is_offrace: boolean
  seed: number | null
}

export interface TournamentMatchRow {
  tournament_id: string
  round: number
  slot: number
  player1_user_id: number | null
  player2_user_id: number | null
  winner_user_id: number | null
}

// ── 토너먼트 본체 ────────────────────────────────────────────
export interface TournamentListRow extends TournamentRow {
  player_count: number
}

export async function getTournaments(): Promise<TournamentListRow[]> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*, tournament_players(count)')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((row: any) => {
    const { tournament_players, ...t } = row
    return { ...t, player_count: tournament_players?.[0]?.count ?? 0 }
  })
}

export async function getTournament(id: string): Promise<TournamentRow> {
  const { data, error } = await supabase
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/** 토너먼트 생성 + 주최자를 참가자로 자동 등록 (맵은 아직 미지정 — 별도 setTournamentMap) */
export async function createTournament(
  payload: { name: string; start_at: string },
  host: { id: number; race: 'T' | 'Z' | 'P'; tier: string },
): Promise<TournamentRow> {
  const { data: tournament, error } = await supabase
    .from('tournaments')
    .insert({ ...payload, host_user_id: host.id })
    .select()
    .single()
  if (error) throw error

  const { error: joinError } = await supabase.from('tournament_players').insert({
    tournament_id: tournament.id,
    user_id: host.id,
    race: host.race,
    tier: host.tier,
    is_offrace: false,
  })
  if (joinError) throw joinError

  return tournament
}

/** 주최자 강제 종료 */
export async function cancelTournament(id: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

async function updateStatus(id: string, status: TournamentStatus): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** 공통 맵 지정 — 대진 생성 전까지 주최자가 자유롭게 변경 가능 */
export async function setTournamentMap(tournamentId: string, mapId: string): Promise<void> {
  const { error } = await supabase
    .from('tournaments')
    .update({ map_id: mapId, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
  if (error) throw error
}

// ── 참가자 ──────────────────────────────────────────────────
export async function getTournamentPlayers(tournamentId: string): Promise<TournamentPlayerRow[]> {
  const { data, error } = await supabase
    .from('tournament_players')
    .select('*')
    .eq('tournament_id', tournamentId)
  if (error) throw error
  return data
}

/**
 * 참가 신청. race가 본인 주종족과 다르면 부종족 참가로 간주해 is_offrace=true —
 * 이 경우 티어는 항상 주종족 티어를 그대로 쓰고(player 파라미터의 tier),
 * 전적은 반영하지 않는다. (팀배틀과 동일 정책)
 */
export async function joinTournament(
  tournamentId: string,
  player: { id: number; race: 'T' | 'Z' | 'P'; tier: string },
  selectedRace: 'T' | 'Z' | 'P',
): Promise<void> {
  const isOffrace = selectedRace !== player.race
  const { error } = await supabase.from('tournament_players').upsert(
    {
      tournament_id: tournamentId,
      user_id: player.id,
      race: selectedRace,
      tier: player.tier,
      is_offrace: isOffrace,
    },
    { onConflict: 'tournament_id,user_id' },
  )
  if (error) throw error
}

/** 목록에서 카드를 펼칠 때 필요한 상세(참가자 + 대진)를 한 번에 */
export async function getTournamentSummary(
  tournamentId: string,
): Promise<{ players: TournamentPlayerRow[]; matches: TournamentMatchRow[] }> {
  const [players, matches] = await Promise.all([
    getTournamentPlayers(tournamentId),
    getTournamentMatches(tournamentId),
  ])
  return { players, matches }
}

export async function leaveTournament(tournamentId: string, userId: number): Promise<void> {
  const { error } = await supabase
    .from('tournament_players')
    .delete()
    .eq('tournament_id', tournamentId)
    .eq('user_id', userId)
  if (error) throw error
}

// ── 대진 생성 ────────────────────────────────────────────────
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandomSlots(totalSlots: number, count: number): Set<number> {
  return new Set(shuffle(Array.from({ length: totalSlots }, (_, i) => i)).slice(0, count))
}

interface BracketMatchDraft {
  round: number
  slot: number
  player1_user_id: number | null
  player2_user_id: number | null
  winner_user_id: number | null
}

/**
 * 단일 엘리미네이션 대진표 생성.
 * size = n 이상인 최소 2의 거듭제곱, 부전승 수 = size - n.
 * 라운드0의 부전승 자리는 무작위로 고르고(비정기 리그라 시드 의미가 없어
 * 순수 랜덤 배정), 그 즉시 승자를 확정해둔다. 라운드1 이상은 승자 미정 상태로
 * 슬롯만 만들어두고, 실제 경기 결과가 들어올 때(setTournamentMatchWinner)
 * 다음 라운드 슬롯에 전파된다.
 * 인원이 홀수거나 2의 거듭제곱이 아니어도 인원수 하드코딩 없이 동일 로직으로 처리.
 */
function buildBracket(seedOrderedPlayerIds: number[]): BracketMatchDraft[] {
  const n = seedOrderedPlayerIds.length
  const size = 2 ** Math.ceil(Math.log2(n))
  const rounds = Math.log2(size)
  const numPairs0 = size / 2
  const byes = size - n
  const byeSlots = pickRandomSlots(numPairs0, byes)

  const matches: BracketMatchDraft[] = []
  let cursor = 0
  let prevWinners: (number | null)[] = new Array(numPairs0).fill(null)

  for (let slot = 0; slot < numPairs0; slot++) {
    if (byeSlots.has(slot)) {
      const p1 = seedOrderedPlayerIds[cursor++]
      matches.push({ round: 0, slot, player1_user_id: p1, player2_user_id: null, winner_user_id: p1 })
      prevWinners[slot] = p1
    } else {
      const p1 = seedOrderedPlayerIds[cursor++]
      const p2 = seedOrderedPlayerIds[cursor++]
      matches.push({ round: 0, slot, player1_user_id: p1, player2_user_id: p2, winner_user_id: null })
    }
  }

  for (let r = 1; r < rounds; r++) {
    const numSlots = numPairs0 / 2 ** r
    const nextWinners: (number | null)[] = new Array(numSlots).fill(null)
    for (let slot = 0; slot < numSlots; slot++) {
      const player1 = prevWinners[slot * 2]
      const player2 = prevWinners[slot * 2 + 1]
      matches.push({ round: r, slot, player1_user_id: player1, player2_user_id: player2, winner_user_id: null })
    }
    prevWinners = nextWinners
  }

  return matches
}

/** 대진 생성 (+ 참가자 순서를 랜덤 시드로 기록) → PLAYING 전환. 주최자가 재생성 가능. */
export async function generateBracket(tournamentId: string): Promise<TournamentMatchRow[]> {
  const [tournament, players] = await Promise.all([
    getTournament(tournamentId),
    getTournamentPlayers(tournamentId),
  ])
  if (players.length < 4) throw new Error('참가자가 4명 이상이어야 대진을 생성할 수 있습니다.')
  if (!tournament.map_id) throw new Error('맵을 먼저 지정해주세요.')

  const seeded = shuffle(players)
  const seedUpdates = seeded.map((p, i) => ({
    tournament_id: tournamentId,
    user_id: p.user_id,
    race: p.race,
    tier: p.tier,
    is_offrace: p.is_offrace,
    seed: i + 1,
  }))
  const { error: seedError } = await supabase
    .from('tournament_players')
    .upsert(seedUpdates, { onConflict: 'tournament_id,user_id' })
  if (seedError) throw seedError

  const draft = buildBracket(seeded.map(p => p.user_id))

  const { error: delError } = await supabase
    .from('tournament_matches')
    .delete()
    .eq('tournament_id', tournamentId)
  if (delError) throw delError

  const rows = draft.map(m => ({ tournament_id: tournamentId, ...m }))
  const { error } = await supabase.from('tournament_matches').insert(rows)
  if (error) throw error

  await updateStatus(tournamentId, 'PLAYING')

  return rows as unknown as TournamentMatchRow[]
}

// ── 경기 결과 ────────────────────────────────────────────────
export async function getTournamentMatches(tournamentId: string): Promise<TournamentMatchRow[]> {
  const { data, error } = await supabase
    .from('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true })
  if (error) throw error
  return data
}

/**
 * 경기 승자 기록 + 다음 라운드 해당 슬롯에 자동 반영.
 * 결승(마지막 라운드)은 다음 라운드가 없으니 승자만 기록하고 끝 —
 * 우승 확정은 별도 finishTournament()에서 명시적으로 처리한다.
 */
export async function setTournamentMatchWinner(
  tournamentId: string, round: number, slot: number, winnerUserId: number,
): Promise<void> {
  const { error } = await supabase
    .from('tournament_matches')
    .update({ winner_user_id: winnerUserId })
    .eq('tournament_id', tournamentId)
    .eq('round', round)
    .eq('slot', slot)
  if (error) throw error

  const matches = await getTournamentMatches(tournamentId)
  const maxRound = Math.max(...matches.map(m => m.round))
  if (round >= maxRound) return

  const nextRound = round + 1
  const nextSlot = Math.floor(slot / 2)
  const field = slot % 2 === 0 ? 'player1_user_id' : 'player2_user_id'
  const { error: advanceError } = await supabase
    .from('tournament_matches')
    .update({ [field]: winnerUserId })
    .eq('tournament_id', tournamentId)
    .eq('round', nextRound)
    .eq('slot', nextSlot)
  if (advanceError) throw advanceError
}

/**
 * 결승 결과를 기반으로 우승 확정 + games 반영.
 * 두 선수 중 한 명이라도 부종족 참가(is_offrace)였던 경기는 전적에서 제외.
 * 부전승(상대 없음)은 player2_user_id가 null이라 자동으로 제외된다.
 */
export async function finishTournament(tournamentId: string): Promise<void> {
  const matches = await getTournamentMatches(tournamentId)
  if (matches.length === 0) throw new Error('대진이 아직 생성되지 않았습니다.')
  const maxRound = Math.max(...matches.map(m => m.round))
  const final = matches.find(m => m.round === maxRound)
  if (!final?.winner_user_id) throw new Error('결승 결과가 아직 입력되지 않았습니다.')

  await recordTournamentGames(tournamentId, matches)

  const { error } = await supabase
    .from('tournaments')
    .update({ status: 'FINISHED', winner_user_id: final.winner_user_id, updated_at: new Date().toISOString() })
    .eq('id', tournamentId)
  if (error) throw error
}

async function recordTournamentGames(tournamentId: string, matches: TournamentMatchRow[]): Promise<void> {
  const [tournament, players, usersRes] = await Promise.all([
    getTournament(tournamentId),
    getTournamentPlayers(tournamentId),
    supabase.from('users').select('id, nickname'),
  ])
  if (usersRes.error) throw usersRes.error
  if (!tournament.map_id) throw new Error('맵이 지정되지 않았습니다.')

  const mapRes = await supabase.from('maps').select('name').eq('id', tournament.map_id).single()
  if (mapRes.error) throw mapRes.error
  const mapName: string = mapRes.data.name

  const nicknameOf = new Map<number, string>(
    (usersRes.data ?? []).map((u: { id: number; nickname: string }) => [u.id, u.nickname]),
  )
  const playerOf = new Map<number, TournamentPlayerRow>(players.map(p => [p.user_id, p]))

  const rows = matches
    .filter(m => m.winner_user_id !== null && m.player1_user_id !== null && m.player2_user_id !== null)
    .filter(m => {
      const p1 = playerOf.get(m.player1_user_id!)
      const p2 = playerOf.get(m.player2_user_id!)
      return !!p1 && !!p2 && !p1.is_offrace && !p2.is_offrace
    })
    .map(m => {
      const p1 = playerOf.get(m.player1_user_id!)!
      const p2 = playerOf.get(m.player2_user_id!)!
      const winner = m.winner_user_id === p1.user_id ? p1 : p2
      const loser = winner === p1 ? p2 : p1
      return {
        map_name: mapName,
        winner_name: nicknameOf.get(winner.user_id) ?? null,
        winner_race: winner.race,
        loser_name: nicknameOf.get(loser.user_id) ?? null,
        loser_race: loser.race,
        played_at: new Date().toISOString(),
        source: 'tournament',
      }
    })

  if (rows.length === 0) return
  const { error } = await supabase.from('games').insert(rows)
  if (error) throw error
}
