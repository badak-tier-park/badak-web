<template>
  <div class="donut-wrap">
    <svg viewBox="0 0 100 100" class="donut-svg">
      <!-- 배경 트랙 -->
      <circle
        cx="50" cy="50" r="38"
        fill="none"
        class="donut-track"
        stroke-width="11"
      />
      <!-- 승률 호 -->
      <circle
        cx="50" cy="50" r="38"
        fill="none"
        :class="colorClass"
        stroke-width="11"
        stroke-linecap="round"
        :stroke-dasharray="`${animArc} ${CIRC}`"
        transform="rotate(-90 50 50)"
        style="transition: stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)"
      />
      <!-- 중앙 텍스트 -->
      <text x="50" y="50" text-anchor="middle" class="donut-pct">
        {{ total > 0 ? rate.toFixed(0) : '—' }}
      </text>
      <text x="50" y="65" text-anchor="middle" class="donut-pct-unit">
        {{ total > 0 ? '%' : '' }}
      </text>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'

const props = defineProps<{
  wins: number
  losses: number
  colorClass: string
}>()

const CIRC = 2 * Math.PI * 38

const total = computed(() => props.wins + props.losses)
const rate = computed(() => total.value > 0 ? (props.wins / total.value) * 100 : 0)
const arc = computed(() => total.value > 0 ? (rate.value / 100) * CIRC : 0)

const animArc = ref(0)

function playArc(target: number) {
  animArc.value = 0
  requestAnimationFrame(() => {
    requestAnimationFrame(() => { animArc.value = target })
  })
}

onMounted(() => playArc(arc.value))
watch(arc, playArc)
</script>

<style scoped>
.donut-wrap {
  width: 100px;
  height: 100px;
  flex-shrink: 0;
}

.donut-svg { width: 100%; height: 100%; }

.donut-track {
  stroke: var(--c-border-strong);
}

.donut-t { stroke: var(--race-t); }
.donut-z { stroke: var(--race-z); }
.donut-p { stroke: var(--race-p); }

.donut-pct {
  font-size: 20px;
  font-weight: 800;
  fill: var(--c-text-bright);
  dominant-baseline: auto;
}

.donut-pct-unit {
  font-size: 11px;
  font-weight: 600;
  fill: var(--c-text-muted);
  dominant-baseline: auto;
}
</style>
