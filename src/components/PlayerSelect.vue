<template>
  <div class="ps-wrap" ref="wrapRef">
    <button
      class="ps-trigger"
      :class="{ 'ps-trigger--open': open, 'ps-trigger--empty': !modelValue }"
      type="button"
      @click="toggle"
    >
      <span class="ps-label">{{ selectedLabel }}</span>
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
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          class="ps-option"
          :class="{
            'ps-option--selected': opt.value === modelValue,
            'ps-option--disabled': opt.disabled,
          }"
          :disabled="opt.disabled"
          type="button"
          @click="select(opt)"
        >
          {{ opt.label }}
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
  disabled?: boolean
}

const props = defineProps<{
  modelValue: number
  options: SelectOption[]
  placeholder?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const open = ref(false)
const wrapRef = ref<HTMLElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedLabel = computed(() => {
  if (!props.modelValue) return props.placeholder ?? '선수 선택'
  return props.options.find(o => o.value === props.modelValue)?.label ?? props.placeholder ?? '선수 선택'
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

onMounted(() => document.addEventListener('mousedown', onClickOutside))
onUnmounted(() => document.removeEventListener('mousedown', onClickOutside))
</script>

<style scoped>
.ps-wrap {
  flex: 1;
  position: relative;
}

.ps-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid var(--c-border);
  background: var(--c-surface-raised);
  color: var(--c-text);
  font-size: 12px;
  font-family: system-ui, sans-serif;
  cursor: pointer;
  outline: none;
  transition: border-color 0.14s;
  text-align: left;
  gap: 6px;

  &:hover { border-color: var(--c-border-strong); }
  &--open { border-color: rgba(168, 85, 247, 0.5); }
  &--empty .ps-label { color: var(--c-text-faint); }
}

.ps-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ps-arrow {
  flex-shrink: 0;
  color: var(--c-text-muted);
  transition: transform 0.14s;

  .ps-trigger--open & { transform: rotate(180deg); }
}

.ps-dropdown {
  background: var(--c-surface);
  border: 1px solid var(--c-border-strong);
  border-radius: 8px;
  overflow-y: auto;
  max-height: 240px;
  padding: 4px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.ps-option {
  width: 100%;
  display: block;
  padding: 7px 10px;
  border: none;
  background: none;
  color: var(--c-text);
  font-size: 12px;
  font-family: system-ui, sans-serif;
  text-align: left;
  cursor: pointer;
  border-radius: 5px;
  transition: background 0.1s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  &:hover:not(:disabled) { background: var(--c-overlay); }
  &--selected { color: #c084fc; font-weight: 600; }
  &--disabled, &:disabled {
    color: var(--c-text-faint);
    cursor: not-allowed;
    text-decoration: line-through;
  }
}
</style>
