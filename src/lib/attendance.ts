import { supabase } from './supabase'

export interface AttendanceStatus {
  attendedToday: boolean
  streak: number
}

export interface CheckInResult {
  pointsEarned: number
  streak: number
  isMilestone: boolean
  milestoneBonus: number
  /** 포인트가 들어간 리그. 진행 중인 리그가 없으면 null (포인트 없음) */
  leagueName: string | null
}

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

export async function getAttendanceStatus(userId: number): Promise<AttendanceStatus> {
  const { data, error } = await supabase
    .from('users')
    .select('attendance_streak, last_attended_at')
    .eq('id', userId)
    .single()
  if (error) throw error

  const today = getTodayKST()
  return {
    attendedToday: data.last_attended_at === today,
    streak: data.attendance_streak ?? 0,
  }
}

// 출석 처리는 서버 함수(check_in_attendance)가 한다 — 연속 계산, 기록, 포인트 지급까지.
// 포인트는 오늘(KST)이 기간 안에 있는 리그의 승부예측 지갑으로 들어가고, 그런 리그가 없으면
// 연속 기록만 이어진다. 예전엔 브라우저가 users.points를 직접 고쳐 누구나 포인트를 바꿀 수 있었다.
// 보상 금액(하루 50, 7·14·30일 첫 달성 보너스)도 서버 함수 안에 있다
export async function checkIn(): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc('check_in_attendance')
  if (error) throw error
  const r = data as { points_earned: number; streak: number; is_milestone: boolean; milestone_bonus: number; league_name: string | null }
  return {
    pointsEarned: r.points_earned,
    streak: r.streak,
    isMilestone: r.is_milestone,
    milestoneBonus: r.milestone_bonus,
    leagueName: r.league_name,
  }
}
