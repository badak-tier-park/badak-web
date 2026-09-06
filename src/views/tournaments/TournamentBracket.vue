<template>
  <div class="bracket-scroll">
    <div class="bracket-tree" :style="{ width: `${bracketWidth}px`, height: `${bracketHeight + HEADER_OFFSET}px` }">
      <span
        v-for="round in roundNumbers"
        :key="`h-${round}`"
        class="bracket-round-label"
        :style="{ left: `${round * (MATCH_WIDTH + COLUMN_GAP)}px`, width: `${MATCH_WIDTH}px` }"
      >{{ roundLabelFor(round) }}</span>

      <div
        v-for="c in connectors"
        :key="`${c.type}-${c.x}-${c.y}`"
        :class="c.type === 'vertical' ? 'bracket-connector-v' : 'bracket-connector-h'"
        :style="{
          left: `${c.x}px`,
          top: `${c.y + HEADER_OFFSET}px`,
          width: c.width ? `${c.width}px` : undefined,
          height: c.height ? `${c.height}px` : undefined,
        }"
      />

      <div
        v-for="m in positionedMatches"
        :key="`${m.round}-${m.slot}`"
        class="bracket-match"
        :class="{
          'bracket-match--decided': m.winner_user_id,
          'bracket-match--saving': interactive && reportingKey === `${m.round}-${m.slot}`,
        }"
        :style="{ left: `${m.x}px`, top: `${m.y + HEADER_OFFSET}px`, width: `${MATCH_WIDTH}px` }"
      >
        <div
          class="bracket-row"
          :class="{
            'bracket-row--winner': !!m.winner_user_id && m.winner_user_id === m.player1_user_id,
            'bracket-row--clickable': interactive && canPick?.(m),
          }"
          @click="interactive && canPick?.(m) && m.player1_user_id && $emit('pick', m, m.player1_user_id)"
        >{{ m.player1_user_id === null ? '-' : nicknameOf(m.player1_user_id) }}</div>
        <div class="bracket-row-divider"></div>
        <div
          class="bracket-row"
          :class="{
            'bracket-row--winner': !!m.winner_user_id && m.winner_user_id === m.player2_user_id,
            'bracket-row--clickable': interactive && canPick?.(m),
            'bracket-row--bye': m.player2_user_id === null && m.player1_user_id !== null,
          }"
          @click="interactive && canPick?.(m) && m.player2_user_id && $emit('pick', m, m.player2_user_id)"
        >{{ m.player2_user_id === null ? (m.player1_user_id === null ? '-' : '부전승') : nicknameOf(m.player2_user_id) }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TournamentMatchRow } from '@/lib/tournaments'

const props = withDefaults(defineProps<{
  matches: TournamentMatchRow[]
  nicknameOf: (userId: number | null) => string
  interactive?: boolean
  canPick?: (m: TournamentMatchRow) => boolean
  reportingKey?: string | null
}>(), {
  interactive: false,
  canPick: undefined,
  reportingKey: null,
})

defineEmits<{ pick: [match: TournamentMatchRow, userId: number] }>()

// ── 좌→우 트리 레이아웃 ────────────────────────────────────
// 항상 완전 이진트리(부전승으로 패딩된 size = 2^ceil(log2(n)))라
// round/slot만으로 y좌표를 수식으로 바로 계산할 수 있다(DOM 측정 불필요).
// y(r, s) = (s * 2^r + (2^r - 1) / 2) * LEAF_SPACING — 표준 이진트리 배치 공식.
const MATCH_WIDTH = 150
const COLUMN_GAP = 56
const LEAF_SPACING = 56
// 매치 박스는 CSS의 translateY(-50%)로 y좌표에 중심을 맞추므로, 라운드
// 라벨이 들어갈 헤더 영역은 "라벨 높이 + 매치 박스 절반 높이"보다 커야
// 겹치지 않는다 (라벨 높이 ~18px + 매치 절반 ~22px 기준으로 여유있게 44px).
const HEADER_OFFSET = 44

const maxRound = computed(() =>
  props.matches.length > 0 ? Math.max(...props.matches.map(m => m.round)) : 0,
)
const roundNumbers = computed(() => [...new Set(props.matches.map(m => m.round))].sort((a, b) => a - b))

function roundLabelFor(round: number): string {
  if (round === maxRound.value) return '결승'
  if (round === maxRound.value - 1) return '준결승'
  return `${round + 1}라운드`
}

interface PositionedMatch extends TournamentMatchRow { x: number; y: number }

const positionedMatches = computed<PositionedMatch[]>(() =>
  props.matches.map(m => ({
    ...m,
    x: m.round * (MATCH_WIDTH + COLUMN_GAP),
    y: (m.slot * 2 ** m.round + (2 ** m.round - 1) / 2) * LEAF_SPACING,
  })),
)

const bracketWidth = computed(() => (maxRound.value + 1) * MATCH_WIDTH + maxRound.value * COLUMN_GAP)
const bracketHeight = computed(() => {
  const numPairs0 = props.matches.filter(m => m.round === 0).length
  return numPairs0 * LEAF_SPACING
})

interface Connector { type: 'stub-out' | 'stub-in' | 'vertical'; x: number; y: number; width?: number; height?: number }

const connectors = computed<Connector[]>(() => {
  const result: Connector[] = []
  const bySlot = new Map<string, PositionedMatch>()
  for (const m of positionedMatches.value) bySlot.set(`${m.round}-${m.slot}`, m)

  for (const m of positionedMatches.value) {
    if (m.round === maxRound.value) continue
    const xMid = m.x + MATCH_WIDTH + COLUMN_GAP / 2
    result.push({ type: 'stub-out', x: m.x + MATCH_WIDTH, y: m.y, width: COLUMN_GAP / 2 })

    if (m.slot % 2 === 0) {
      const partner = bySlot.get(`${m.round}-${m.slot + 1}`)
      if (partner) {
        result.push({
          type: 'vertical', x: xMid, y: Math.min(m.y, partner.y), height: Math.abs(partner.y - m.y),
        })
      }
    }
  }
  for (const m of positionedMatches.value) {
    if (m.round === 0) continue
    result.push({ type: 'stub-in', x: m.x - COLUMN_GAP / 2, y: m.y, width: COLUMN_GAP / 2 })
  }
  return result
})
</script>

<style lang="scss" scoped>
.bracket-scroll {
  overflow-x: auto;
  padding-bottom: 4px;
}

.bracket-tree {
  position: relative;
}

.bracket-round-label {
  position: absolute;
  top: 0;
  height: 16px;
  line-height: 16px;
  overflow: hidden;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--c-text-faint);
}

.bracket-connector-h {
  position: absolute;
  height: 2px;
  background: var(--c-border-strong);
}

.bracket-connector-v {
  position: absolute;
  width: 2px;
  background: var(--c-border-strong);
}

.bracket-match {
  position: absolute;
  transform: translateY(-50%);
  border-radius: 8px;
  border: 1px solid var(--c-border);
  background: var(--c-surface-raised);
  overflow: hidden;
  transition: opacity 0.15s;

  &--decided { border-color: var(--c-border-strong); }
  &--saving { opacity: 0.6; }
}

.bracket-row {
  height: 21px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  box-sizing: border-box;

  &--winner { background: rgba(74, 222, 128, 0.1); color: #4ade80; font-weight: 700; }
  &--bye { color: var(--c-text-faint); font-style: italic; }

  &--clickable {
    cursor: pointer;

    &:hover { background: rgba(170, 59, 255, 0.12); color: #c084fc; }
  }
}

.bracket-row-divider {
  height: 1px;
  background: var(--c-border-faint);
}
</style>
