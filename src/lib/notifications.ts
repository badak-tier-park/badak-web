import { supabase } from '@/lib/supabase'

export async function notifyEntrySubmitted(params: {
  leagueName: string
  teamName: string
  matchRound: string
  matchDate: string | null
}) {
  try {
    await supabase.functions.invoke('notify-entry', {
      body: {
        leagueName: params.leagueName,
        teamName: params.teamName,
        matchRound: params.matchRound,
        matchDate: params.matchDate,
        submittedAt: new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      },
    })
  } catch {
    // 알림 실패는 사용자에게 노출하지 않음
  }
}

// ── In-app 알림 ───────────────────────────────────────────────
export type NotificationType =
  | 'prediction_win'
  | 'prediction_loss'
  | 'prediction_refund'
  | string

export interface NotificationRow {
  id: number
  user_id: number
  type: NotificationType
  title: string
  body: string | null
  is_read: boolean
  metadata: Record<string, unknown> | null
  created_at: string
}

export async function getNotifications(userId: number, limit = 20): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export async function getUnreadCount(userId: number): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
  return count ?? 0
}

export async function markNotificationRead(id: number): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id)
  if (error) throw error
}

export async function markAllRead(userId: number): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', userId)
    .eq('is_read', false)
  if (error) throw error
}
