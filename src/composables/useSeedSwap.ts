import { ref, computed, type Ref } from 'vue'
import type { PlayerRow } from '@/lib/players'
import { TIER_RANK } from '@/lib/constants'

export interface SwapLogEntry {
  seedHolderName: string
  myName: string
  theirName: string
  myTeamCaptainName: string
  theirTeamCaptainName: string
  seedHolderPlayerId: number
  fromPlayerId: number
  toPlayerId: number
}

export function useSeedSwap(
  teams: Ref<Record<number, PlayerRow[]>>,
  captainIds: Ref<number[]>,
  seedHolderIds: Ref<Set<number>>,
  seedOrderIds: Ref<number[]>,
  playerById: (id: number) => PlayerRow | null,
  showToast: (msg: string) => void,
) {
  const seedSwapMode = ref(false)
  const seedSwapDone = ref(false)
  const preSeedTeams = ref<Record<number, PlayerRow[]> | null>(null)
  const currentSeedIdx = ref(0)
  const swapSel = ref<{ captainId: number; member: PlayerRow; pickIdx: number } | null>(null)
  const lockedIds = ref(new Set<number>())
  const swappedIds = ref(new Set<number>())
  const swapError = ref<string | null>(null)
  const swapErrorKey = ref(0)
  const swapLog = ref<SwapLogEntry[]>([])

  const currentSeedHolderId = computed(() => seedOrderIds.value[currentSeedIdx.value] ?? null)

  const currentSeedHolderCaptainId = computed((): number | null => {
    const pid = currentSeedHolderId.value
    if (pid === null) return null
    if (captainIds.value.includes(pid)) return pid
    for (const [cIdStr, members] of Object.entries(teams.value)) {
      if (members.find(m => m.id === pid)) return Number(cIdStr)
    }
    return null
  })

  // ── 시드권 순서 설정 ──────────────────────────────────────
  const seedOrderSetupMode = ref(false)
  const seedOrderDraft = ref<number[]>([])

  function openSeedOrderSetup() {
    seedOrderDraft.value = [...seedOrderIds.value]
    seedOrderSetupMode.value = true
  }

  function moveSeedOrder(i: number, dir: -1 | 1) {
    const arr = [...seedOrderDraft.value]
    const j = i + dir
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    seedOrderDraft.value = arr
  }

  function confirmSeedOrder() {
    seedOrderIds.value = [...seedOrderDraft.value]
    seedOrderSetupMode.value = false
    startSeedSwap()
  }

  function startSeedSwap() {
    preSeedTeams.value = Object.fromEntries(
      Object.entries(teams.value).map(([k, v]) => [Number(k), [...v]]),
    )
    seedSwapDone.value = false
    swappedIds.value = new Set()
    swapLog.value = []
    seedSwapMode.value = true
    currentSeedIdx.value = 0
    swapSel.value = null
    lockedIds.value = new Set()
    swapError.value = null
    swapErrorKey.value = 0
  }

  function resetSeedSwap() {
    if (preSeedTeams.value) {
      teams.value = Object.fromEntries(
        Object.entries(preSeedTeams.value).map(([k, v]) => [Number(k), [...v]]),
      )
    }
    seedSwapMode.value = false
    seedSwapDone.value = false
    currentSeedIdx.value = 0
    swappedIds.value = new Set()
    lockedIds.value = new Set()
    swapLog.value = []
    swapSel.value = null
    swapError.value = null
    swapErrorKey.value = 0
    preSeedTeams.value = null
    showToast('시드권 적용이 초기화되었습니다')
  }

  function validateFirstClick(_captainId: number, member: PlayerRow, pickIdx: number): string | null {
    if (lockedIds.value.has(member.id)) return `${member.nickname}은 이미 교체된 멤버입니다`
    if (seedHolderIds.value.has(member.id)) return `${member.nickname}은 시드권 보유자로 교체 불가합니다`
    if (pickIdx === 0) return `1번 픽(${member.nickname})은 시드권 적용 불가합니다`
    return null
  }

  function validateSwap(
    a: { captainId: number; member: PlayerRow; pickIdx: number },
    b: { captainId: number; member: PlayerRow; pickIdx: number },
  ): string | null {
    if (lockedIds.value.has(b.member.id)) return `${b.member.nickname}은 이미 교체된 멤버입니다`
    if (seedHolderIds.value.has(b.member.id)) return `${b.member.nickname}은 시드권 보유자로 교체 불가합니다`
    if (b.pickIdx === 0) return `1번 픽(${b.member.nickname})은 시드권 적용 불가합니다`

    const tierDiff = Math.abs((TIER_RANK[a.member.tier] ?? 0) - (TIER_RANK[b.member.tier] ?? 0))
    if (tierDiff >= 2) return '두 티어 이상 차이나는 멤버는 시드권 적용 불가합니다'

    const aNum = a.pickIdx + 1
    const bNum = b.pickIdx + 1
    if (Math.abs(aNum - bNum) >= 3) return '세 픽 이상 차이나는 멤버는 시드권 적용 불가합니다'

    return null
  }

  function onMemberClick(captainId: number, member: PlayerRow, idx: number) {
    if (!seedSwapMode.value) return

    const setError = (msg: string) => {
      swapError.value = msg
      swapErrorKey.value++
    }

    if (!swapSel.value) {
      if (captainId !== currentSeedHolderCaptainId.value) {
        setError('시드권 보유 팀의 멤버를 먼저 선택하세요')
        return
      }
      const err = validateFirstClick(captainId, member, idx)
      if (err) { setError(err); return }
      swapError.value = null
      swapSel.value = { captainId, member, pickIdx: idx }
      return
    }

    if (swapSel.value.member.id === member.id) {
      swapSel.value = null
      swapError.value = null
      return
    }

    if (swapSel.value.captainId === captainId) {
      const err = validateFirstClick(captainId, member, idx)
      if (err) { setError(err); return }
      swapError.value = null
      swapSel.value = { captainId, member, pickIdx: idx }
      return
    }

    const err = validateSwap(swapSel.value, { captainId, member, pickIdx: idx })
    if (err) { setError(err); return }

    const a = swapSel.value
    const b = { captainId, member, pickIdx: idx }
    const aMembers = [...(teams.value[a.captainId] ?? [])]
    const bMembers = [...(teams.value[b.captainId] ?? [])]
    aMembers[a.pickIdx] = b.member
    bMembers[b.pickIdx] = a.member
    teams.value[a.captainId] = aMembers
    teams.value[b.captainId] = bMembers

    lockedIds.value = new Set([...lockedIds.value, a.member.id, b.member.id])
    swappedIds.value = new Set([...swappedIds.value, a.member.id, b.member.id])
    swapLog.value.push({
      seedHolderName: playerById(currentSeedHolderId.value!)?.nickname ?? '',
      myName: a.member.nickname,
      theirName: b.member.nickname,
      myTeamCaptainName: playerById(a.captainId)?.nickname ?? '',
      theirTeamCaptainName: playerById(b.captainId)?.nickname ?? '',
      seedHolderPlayerId: currentSeedHolderId.value!,
      fromPlayerId: a.member.id,
      toPlayerId: b.member.id,
    })
    swapSel.value = null
    swapError.value = null
    showToast(`${a.member.nickname} ↔ ${b.member.nickname} 교체 완료`)
    advanceSeed()
  }

  function passSeed() {
    swapSel.value = null
    swapError.value = null
    showToast(`${playerById(currentSeedHolderId.value!)?.nickname} 시드권 패스`)
    advanceSeed()
  }

  function advanceSeed() {
    currentSeedIdx.value++
    if (currentSeedIdx.value >= seedOrderIds.value.length) {
      seedSwapMode.value = false
      seedSwapDone.value = true
      showToast('모든 시드권 적용이 완료되었습니다')
    }
  }

  return {
    seedSwapMode,
    seedSwapDone,
    currentSeedIdx,
    swapSel,
    lockedIds,
    swappedIds,
    swapError,
    swapErrorKey,
    swapLog,
    currentSeedHolderId,
    currentSeedHolderCaptainId,
    seedOrderSetupMode,
    seedOrderDraft,
    openSeedOrderSetup,
    moveSeedOrder,
    confirmSeedOrder,
    startSeedSwap,
    resetSeedSwap,
    onMemberClick,
    passSeed,
  }
}
