<template>
  <span class="tier-pill" :class="[`tier-pill--${letter}`, { 'tier-pill--sm': size === 'sm' }]">{{ label }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { normalizeTier } from '@/lib/constants'

// 티어는 글자 칩으로만 보여준다. 색은 알파벳(S·A·B·C·D·E) 단위, +/-는 글자로 구분
const props = withDefaults(defineProps<{ tier?: string | null; size?: 'md' | 'sm' }>(), { size: 'md' })

const label = computed(() => normalizeTier(props.tier) || '?')
const letter = computed(() => label.value.charAt(0).toLowerCase())
</script>
