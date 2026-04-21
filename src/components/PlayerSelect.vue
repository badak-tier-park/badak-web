<template>
  <div class="ps-wrap" ref="wrapRef">
    <button
      class="ps-trigger"
      :class="[
        { 'ps-trigger--open': open, 'ps-trigger--empty': !modelValue, 'ps-trigger--disabled': disabled },
        selectedOpt?.tier ? `tier-badge--${selectedOpt.tier.toLowerCase()}` : '',
      ]"
      type="button"
      :disabled="disabled"
      @click="toggle"
    >
      <template v-if="selectedOpt?.tier">
        <span class="ps-sel-race" v-if="selectedOpt.race" :class="`race-badge--${selectedOpt.race.toLowerCase()}`">{{ selectedOpt.race }}</span>
        <span class="ps-label">{{ selectedOpt.label }}</span>
        <span class="ps-sel-pts" v-if="selectedOpt.points">{{ selectedOpt.points }}pt</span>
      </template>
      <span v-else class="ps-label">{{ selectedLabel }}</span>
      <svg class="ps-arrow" width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        class="ps-dropdown"
        :style="dropdownStyle"
        ref="dropdownRef"
        @dragstart.prevent
        @mousedown.stop
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          class="ps-option"
          :class="[
            { 'ps-option--selected': opt.value === modelValue, 'ps-option--disabled': opt.disabled },
            opt.tier ? `ps-option--tier-${opt.tier.toLowerCase()}` : '',
          ]"
          :disabled="opt.disabled"
          type="button"
          @click="select(opt)"
        >
          <template v-if="opt.tier">
            <span class="ps-opt-race" v-if="opt.race" :class="`race-badge--${opt.race.toLowerCase()}`">{{ opt.race }}</span>
            <span class="ps-opt-name" :class="`tier-color--${opt.tier.toLowerCase()}`">{{ opt.label }}</span>
            <span class="ps-opt-pts" :class="`tier-color--${opt.tier.toLowerCase()}`">{{ opt.points }}pt</span>
          </template>
          <template v-else>{{ opt.label }}</template>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

export interface SelectOption {
  value: number
  label: string
  tier?: string
  race?: string
  points?: number
  disabled?: boolean
}

const props = defineProps<{
  modelValue: number
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedOpt = computed(() =>
  props.modelValue ? props.options.find(o => o.value === props.modelValue) ?? null : null
)
const selectedLabel = computed(() => {
  if (!props.modelValue) return props.placeholder ?? '선수 선택'
  return selectedOpt.value?.label ?? props.placeholder ?? '선수 선택'
})

function calcPosition() {
  if (!wrapRef.value) return
  const rect = wrapRef.value.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom
  const dropdownH = Math.min(props.options.length * 34 + 8, 240)
  const above = spaceBelow < dropdownH && rect.top > dropdownH

  dropdownStyle.value = {
    position: 'fixed',
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '9999',
    ...(above
      ? { bottom: `${window.innerHeight - rect.top}px` }
      : { top: `${rect.bottom + 4}px` }),
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    await nextTick()
    calcPosition()
  }
}

function select(opt: SelectOption) {
  if (opt.disabled) return
  emit('update:modelValue', opt.value)
  open.value = false
}

function onClickOutside(e: MouseEvent) {
  if (
    wrapRef.value?.contains(e.target as Node) ||
    dropdownRef.value?.contains(e.target as Node)
  ) return
  open.value = false
}

function onScroll() {
  if (open.value) calcPosition()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutside)
  window.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
  window.removeEventListener('scroll', onScroll, true)
})
</script>

<style lang="scss" scoped>
@use './PlayerSelect.scss';
</style>
