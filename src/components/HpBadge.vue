<template>
  <span
    class="hp-pill"
    :class="{ 'hp-pill--open': open }"
    :data-tip="tip"
    :aria-label="tip"
    role="note"
    @click.stop="open = !open"
    @mouseleave="open = false"
  >{{ label }}</span>
</template>

<script setup lang="ts">
import { ref } from 'vue'

// 핸디 배지: 칩에는 짧은 값(예: 75%)만, 전체 문구(체력 75% · 추가 핸디)는 툴팁으로.
// 휴대폰은 마우스가 없어 탭으로 툴팁을 연다. 경기 결과 화면에선 선수 칸 자체가
// 승자 선택 버튼이라, 탭이 승자 선택으로 번지지 않게 click.stop
defineProps<{ label: string; tip: string }>()

const open = ref(false)
</script>
