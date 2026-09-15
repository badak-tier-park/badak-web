import { ref } from 'vue'

/**
 * 포인터 기반 리스트 재정렬.
 *
 * HTML5 drag&drop은 모바일 터치에서 동작하지 않아, 이 프로젝트의 지목식 화면
 * (useDraftDnD)과 동일하게 pointer 이벤트로 구현한다. 드래그 중에는 항목의
 * 복제본을 커서에 붙여 따라다니게 하고, 놓은 지점 아래에 있는 항목의 인덱스를
 * onDrop으로 넘긴다.
 *
 * 재정렬 대상 항목에 `data-drag-index="<인덱스>"`를, 잡는 손잡이에
 * `@pointerdown="onPointerDown($event, 인덱스)"`를 달아 쓴다.
 */
export function useListDrag(onDrop: (from: number, to: number) => void) {
  const dragIndex = ref<number | null>(null)
  const overIndex = ref<number | null>(null)

  let clone: HTMLElement | null = null
  let offsetX = 0
  let offsetY = 0

  function indexFromPoint(x: number, y: number): number | null {
    const hit = document
      .elementsFromPoint(x, y)
      .find(el => (el as HTMLElement).dataset?.dragIndex !== undefined) as HTMLElement | undefined
    return hit ? Number(hit.dataset.dragIndex) : null
  }

  function onPointerDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return
    const row = (e.currentTarget as HTMLElement).closest('[data-drag-index]') as HTMLElement | null
    if (!row) return
    e.preventDefault()

    const rect = row.getBoundingClientRect()
    offsetX = e.clientX - rect.left
    offsetY = e.clientY - rect.top

    clone = row.cloneNode(true) as HTMLElement
    clone.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      margin: 0;
      pointer-events: none;
      z-index: 9999;
      opacity: 0.92;
      transform: scale(1.02);
      box-shadow: 0 10px 32px rgba(0, 0, 0, 0.45);
      border-radius: 8px;
    `
    document.body.appendChild(clone)

    dragIndex.value = index
    overIndex.value = index
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
  }

  function onMove(e: PointerEvent) {
    if (!clone) return
    clone.style.left = `${e.clientX - offsetX}px`
    clone.style.top = `${e.clientY - offsetY}px`
    overIndex.value = indexFromPoint(e.clientX, e.clientY) ?? overIndex.value
  }

  function onUp(e: PointerEvent) {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    clone?.remove()
    clone = null

    const from = dragIndex.value
    const to = indexFromPoint(e.clientX, e.clientY)
    dragIndex.value = null
    overIndex.value = null

    if (from !== null && to !== null && from !== to) onDrop(from, to)
  }

  return { dragIndex, overIndex, onPointerDown }
}
