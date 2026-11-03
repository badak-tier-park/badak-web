import { ref, type Ref, type ComputedRef } from 'vue'
import type { PlayerRow } from '@/lib/players'

export function useDraftDnD(
  allPlayers: Ref<PlayerRow[]>,
  teams: Ref<Record<number, PlayerRow[]>>,
  currentCaptainId: ComputedRef<number | null>,
  onDropped?: (captainId: number, player: PlayerRow, pickOrder: number) => void,
  onRemoved?: (memberId: number) => void,
  // 터치에서 끌지 않고 톡 누른 경우. 휴대폰에서는 풀과 팀 칸이 위아래로 쌓여
  // 끌어서 옮기기가 사실상 불가능하므로, 화면에서 눌러서 고르는 경로를 따로 둔다
  onTap?: (playerId: number, source: 'pool' | number) => void,
) {
  const draggedPlayerId = ref<number | null>(null)
  const dragSource = ref<'pool' | number>('pool')
  const dragOverTeam = ref<number | null>(null)
  const dragOverPool = ref(false)
  const draggingId = ref<number | null>(null)

  let _dragClone: HTMLElement | null = null
  let _dragOffsetX = 0
  let _dragOffsetY = 0
  let _sourceEl: HTMLElement | null = null
  let _startX = 0
  let _startY = 0
  let _pointerType = ''

  // 이만큼 움직여야 드래그로 본다. 그 전에 손을 떼면 탭이다
  const DRAG_THRESHOLD = 6

  function onPointerDown(e: PointerEvent, playerId: number, source: 'pool' | number) {
    if (e.button !== 0) return
    // 마우스는 텍스트 선택을 막는다. 터치는 막으면 목록 스크롤까지 막혀서 그대로 둔다
    if (e.pointerType === 'mouse') e.preventDefault()

    _sourceEl = e.currentTarget as HTMLElement
    _startX = e.clientX
    _startY = e.clientY
    _pointerType = e.pointerType

    draggedPlayerId.value = playerId
    dragSource.value = source

    document.addEventListener('pointermove', _onPointerMove)
    document.addEventListener('pointerup', _onPointerUp)
    // 터치로 스크롤이 시작되면 브라우저가 포인터를 취소한다. 이걸 듣지 않으면
    // 끌던 복제본이 화면에 그대로 남았다
    document.addEventListener('pointercancel', _cleanup)
  }

  function _startDrag() {
    if (!_sourceEl) return
    const rect = _sourceEl.getBoundingClientRect()
    _dragOffsetX = _startX - rect.left
    _dragOffsetY = _startY - rect.top

    const clone = _sourceEl.cloneNode(true) as HTMLElement
    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width - 25}px;
      height: ${rect.height - 10}px;
      pointer-events: none;
      z-index: 9999;
      margin: 0;
      opacity: 1;
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.5);
      transform: scale(1.05);
      transition: none;
      border-radius: 7px;
    `
    document.body.appendChild(clone)
    _dragClone = clone
    draggingId.value = draggedPlayerId.value
  }

  function _onPointerMove(e: PointerEvent) {
    if (!_dragClone) {
      if (Math.hypot(e.clientX - _startX, e.clientY - _startY) < DRAG_THRESHOLD) return
      _startDrag()
    }
    if (!_dragClone) return
    _dragClone.style.left = `${e.clientX - _dragOffsetX}px`
    _dragClone.style.top = `${e.clientY - _dragOffsetY}px`

    const els = document.elementsFromPoint(e.clientX, e.clientY)
    const teamCol = els.find(el => (el as HTMLElement).dataset.captainId) as HTMLElement | undefined
    const pool = els.find(el => el.hasAttribute('data-drop-pool'))

    if (teamCol) {
      const cid = Number(teamCol.dataset.captainId)
      dragOverTeam.value = cid === currentCaptainId.value ? cid : null
      dragOverPool.value = false
    } else if (pool && dragSource.value !== 'pool') {
      dragOverPool.value = true
      dragOverTeam.value = null
    } else {
      dragOverTeam.value = null
      dragOverPool.value = false
    }
  }

  function _onPointerUp(e: PointerEvent) {
    const wasDragging = _dragClone !== null
    const pid = draggedPlayerId.value
    const source = dragSource.value

    if (!wasDragging) {
      _cleanup()
      if (pid && _pointerType !== 'mouse') onTap?.(pid, source)
      return
    }

    if (pid) {
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const teamCol = els.find(el => (el as HTMLElement).dataset.captainId) as HTMLElement | undefined
      const pool = els.find(el => el.hasAttribute('data-drop-pool'))

      if (teamCol) {
        assignToTeam(Number(teamCol.dataset.captainId), pid, source)
      } else if (pool && dragSource.value !== 'pool') {
        const prev = dragSource.value as number
        teams.value[prev] = (teams.value[prev] ?? []).filter(p => p.id !== pid)
        onRemoved?.(pid)
      }
    }

    _cleanup()
  }

  function _cleanup() {
    document.removeEventListener('pointermove', _onPointerMove)
    document.removeEventListener('pointerup', _onPointerUp)
    document.removeEventListener('pointercancel', _cleanup)
    _dragClone?.remove()
    _dragClone = null
    _sourceEl = null
    draggingId.value = null
    draggedPlayerId.value = null
    dragOverTeam.value = null
    dragOverPool.value = false
  }

  /** 현재 차례인 팀에만 넣는다. 드래그로 떨어뜨린 경우와 탭 후 확인한 경우가 같은 경로를 탄다 */
  function assignToTeam(cid: number, pid: number, source: 'pool' | number = 'pool') {
    if (cid !== currentCaptainId.value || (teams.value[cid] ?? []).find(p => p.id === pid)) return
    if (source !== 'pool') {
      teams.value[source] = (teams.value[source] ?? []).filter(p => p.id !== pid)
    }
    const player = allPlayers.value.find(p => p.id === pid)
    if (!player) return
    if (!teams.value[cid]) teams.value[cid] = []
    const pickOrder = Object.values(teams.value).reduce((s, m) => s + m.length, 0) + 1
    teams.value[cid] = [...teams.value[cid], player]
    onDropped?.(cid, player, pickOrder)
  }

  function removeFromTeam(captainId: number, memberId: number) {
    teams.value[captainId] = (teams.value[captainId] ?? []).filter(p => p.id !== memberId)
  }

  return {
    draggedPlayerId,
    dragSource,
    dragOverTeam,
    dragOverPool,
    draggingId,
    onPointerDown,
    assignToTeam,
    removeFromTeam,
  }
}
