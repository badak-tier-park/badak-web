<template>
  <span v-if="label" class="race-pill" :class="[`race-pill--${label.toLowerCase()}`, { 'race-pill--sm': size === 'sm' }]" :title="title">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// random: 팀전에서 랜덤 종족으로 출전하는 선수 → 'R'
const props = withDefaults(defineProps<{ race?: string | null; random?: boolean; size?: 'md' | 'sm' }>(), { size: 'md' })

const label = computed(() => (props.random ? 'R' : (props.race ?? '').trim().toUpperCase()))
const title = computed(() => ({ T: '테란', Z: '저그', P: '프로토스', R: '랜덤' } as Record<string, string>)[label.value] ?? '')
</script>
