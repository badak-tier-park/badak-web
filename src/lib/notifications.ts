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
