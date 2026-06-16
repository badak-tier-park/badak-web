import { supabase } from './supabase'

const DAILY_POINTS = 50

// 첫 달성 시에만 지급되는 마일스톤 보너스
const MILESTONES: Record<number, number> = {
  7: 500,
  14: 1000,
  30: 3000,
}

export interface AttendanceStatus {
  attendedToday: boolean
  streak: number
}

export interface CheckInResult {
  pointsEarned: number
  streak: number
  isMilestone: boolean
  milestoneBonus: number
}

function getTodayKST(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0]
}

function getYesterdayKST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000)
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
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

export async function checkIn(userId: number): Promise<CheckInResult> {
  const today = getTodayKST()
  const yesterday = getYesterdayKST()

  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('attendance_streak, last_attended_at, points')
    .eq('id', userId)
    .single()
  if (userErr) throw userErr

  if (user.last_attended_at === today) {
    throw new Error('오늘 이미 출석했습니다.')
  }

  const newStreak = user.last_attended_at === yesterday
    ? (user.attendance_streak ?? 0) + 1
    : 1

  // 마일스톤 해당 여부 — 이미 받은 적 없어야 지급
  let milestoneBonus = 0
  let isMilestone = false
  const milestoneReward = MILESTONES[newStreak]
  if (milestoneReward !== undefined) {
    const { count } = await supabase
      .from('attendance_logs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_milestone', true)
      .eq('milestone_days', newStreak)
    if ((count ?? 0) === 0) {
      milestoneBonus = milestoneReward
      isMilestone = true
    }
  }

  const totalPoints = DAILY_POINTS + milestoneBonus

  const { error: logErr } = await supabase.from('attendance_logs').insert({
    user_id: userId,
    attended_at: today,
    streak: newStreak,
    points_earned: totalPoints,
    is_milestone: isMilestone,
    milestone_days: isMilestone ? newStreak : null,
  })
  if (logErr) throw logErr

  const { error: updateErr } = await supabase
    .from('users')
    .update({
      attendance_streak: newStreak,
      last_attended_at: today,
      points: (user.points ?? 0) + totalPoints,
    })
    .eq('id', userId)
  if (updateErr) throw updateErr

  return { pointsEarned: totalPoints, streak: newStreak, isMilestone, milestoneBonus }
}
