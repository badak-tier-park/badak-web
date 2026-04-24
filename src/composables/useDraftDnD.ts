import { ref, type Ref, type ComputedRef } from 'vue'
import type { PlayerRow } from '@/lib/players'

export function useDraftDnD(
  allPlayers: Ref<PlayerRow[]>,
  teams: Ref<Record<number, PlayerRow[]>>,
  currentCaptainId: ComputedRef<number | null>,
  onDropped?: (captainId: number, player: PlayerRow, pickOrder: number) => void,
  onRemoved?: (memberId: number) => void,
) {
  const draggedPlayerId = ref<number | null>(null)
  const dragSource = ref<'pool' | number>('pool')
  const dragOverTeam = ref<number | null>(null)
  const dragOverPool = ref(false)
  const draggingId = ref<number | null>(null)

  let _dragClone: HTMLElement | null = null
  let _dragOffsetX = 0
  let _dragOffsetY = 0

  function onPointerDown(e: PointerEvent, playerId: number, source: 'pool' | number) {
    if (e.button !== 0) return
    e.preventDefault()

    const el = e.currentTarget as HTMLElement
    const rect = el.getBoundingClientRect()
    _dragOffsetX = e.clientX - rect.left
    _dragOffsetY = e.clientY - rect.top

    const clone = el.cloneNode(true) as HTMLElement
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

    draggedPlayerId.value = playerId
    dragSource.value = source
    draggingId.value = playerId

    document.addEventListener('pointermove', _onPointerMove)
    document.addEventListener('pointerup', _onPointerUp)
  }

  function _onPointerMove(e: PointerEvent) {
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
    document.removeEventListener('pointermove', _onPointerMove)
    document.removeEventListener('pointerup', _onPointerUp)

    if (_dragClone) {
      _dragClone.remove()
      _dragClone = null
    }

    const pid = draggedPlayerId.value
    if (pid) {
      const els = document.elementsFromPoint(e.clientX, e.clientY)
      const teamCol = els.find(el => (el as HTMLElement).dataset.captainId) as HTMLElement | undefined
      const pool = els.find(el => el.hasAttribute('data-drop-pool'))

      if (teamCol) {
        const cid = Number(teamCol.dataset.captainId)
        if (cid === currentCaptainId.value && !(teams.value[cid] ?? []).find(p => p.id === pid)) {
          if (dragSource.value !== 'pool') {
            const prev = dragSource.value as number
            teams.value[prev] = (teams.value[prev] ?? []).filter(p => p.id !== pid)
          }
          const player = allPlayers.value.find(p => p.id === pid)
          if (player) {
            if (!teams.value[cid]) teams.value[cid] = []
            const pickOrder = Object.values(teams.value).reduce((s, m) => s + m.length, 0) + 1
            teams.value[cid] = [...teams.value[cid], player]
            onDropped?.(cid, player, pickOrder)
          }
        }
      } else if (pool && dragSource.value !== 'pool') {
        const prev = dragSource.value as number
        teams.value[prev] = (teams.value[prev] ?? []).filter(p => p.id !== pid)
        onRemoved?.(pid)
      }
    }

    draggingId.value = null
    draggedPlayerId.value = null
    dragOverTeam.value = null
    dragOverPool.value = false
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
    removeFromTeam,
  }
}
