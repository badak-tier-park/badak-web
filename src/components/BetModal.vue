<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop">
      <div class="modal modal--sm bet-modal">
        <div class="modal-header">
          <p class="modal-title">{{ teamName }}에 베팅</p>
          <button class="modal-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <div class="bet-row">
            <span class="bet-row-label">현재 배수</span>
            <span class="bet-row-val">{{ formatMult(currentMult) }}</span>
          </div>
          <div class="bet-row">
            <span class="bet-row-label">베팅 후 예상 배수</span>
            <span class="bet-row-val">{{ formatMult(previewMult) }}</span>
          </div>

          <div class="bet-amount-section">
            <span class="field-label">베팅 포인트 (100pt 단위)</span>
            <div class="bet-amount-row">
              <button class="btn-pill btn-pill--ghost btn-pill--md" @click="adjust(-100)" :disabled="amount <= 100">-100</button>
              <input v-model.number="amount" type="number" class="bet-amount-input" min="100" step="100" @blur="normalize" />
              <button class="btn-pill btn-pill--ghost btn-pill--md" @click="adjust(100)" :disabled="amount + 100 > availableBalance">+100</button>
            </div>
            <div class="bet-amount-quick">
              <button
                v-for="p in quickAmounts"
                :key="p"
                class="bet-quick"
                :class="{ active: amount === p }"
                :disabled="p > availableBalance"
                @click="amount = p"
              >{{ p.toLocaleString() }}pt</button>
              <button
                class="bet-quick"
                :class="{ active: amount === availableBalance }"
                :disabled="availableBalance < 100"
                @click="amount = availableBalance"
              >All</button>
            </div>
          </div>

          <div class="bet-summary">
            <div class="bet-summary-row">
              <span>예상 획득</span>
              <span class="bet-summary-payout">{{ Math.floor(amount * previewMult).toLocaleString() }}pt</span>
            </div>
            <p class="bet-disclaimer">※ 실시간 배수는 마감 시점까지 변동되며, 정산은 마감 시 적중자들이 베팅 비율대로 총 pot을 나눠가집니다.</p>
          </div>

          <p v-if="error" class="save-error">{{ error }}</p>
        </div>

        <div class="modal-footer">
          <div class="modal-actions">
            <button class="btn-cancel" @click="$emit('close')" :disabled="saving">취소</button>
            <button class="btn-confirm" :disabled="saving || amount < 100 || amount > availableBalance" @click="$emit('confirm', amount)">
              {{ saving ? '처리 중...' : '베팅 확정' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { previewMultiplier } from '@/lib/predictions'

const props = defineProps<{
  open: boolean
  teamName: string
  // 본인 베팅을 제외한 순수 양 팀 베팅 합
  myTotal: number
  otherTotal: number
  availableBalance: number
  initialAmount?: number
  saving?: boolean
  error?: string | null
}>()

defineEmits<{
  (e: 'close'): void
  (e: 'confirm', amount: number): void
}>()

const amount = ref(props.initialAmount ?? 100)

watch(() => props.open, (v) => {
  if (v) {
    amount.value = props.initialAmount ?? 100
  }
})

watch(() => props.initialAmount, (v) => {
  if (props.open && v) amount.value = v
})

const currentMult = computed(() => {
  const my = props.myTotal
  const other = props.otherTotal
  if (my === 0) return 0
  return Math.round(((my + other) / my) * 1000) / 1000
})

const previewMult = computed(() => previewMultiplier(props.myTotal, props.otherTotal, amount.value))

const quickAmounts = computed(() => [100, 300, 500, 1000].filter(p => p <= props.availableBalance))

function adjust(delta: number) {
  const next = amount.value + delta
  if (next < 100) return
  if (next > props.availableBalance) return
  amount.value = next
}

function normalize() {
  let v = Math.max(100, Math.floor(amount.value / 100) * 100)
  if (v > props.availableBalance) v = Math.max(100, Math.floor(props.availableBalance / 100) * 100)
  amount.value = v
}

function formatMult(v: number) {
  if (!v || v <= 0) return '—'
  return `${v.toFixed(2)}x`
}
</script>

<style lang="scss" scoped>
@use '@/styles/buttons';
@use '@/styles/modal';

.bet-modal { display: flex; flex-direction: column; }

.bet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
}

.bet-row-label {
  color: var(--c-text-sub);
  font-weight: 600;
}

.bet-row-val {
  color: var(--c-brand-text);
  font-weight: 800;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.bet-amount-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--c-border-faint);
}

.bet-amount-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bet-amount-input {
  flex: 1;
  padding: 9px 12px;
  border-radius: 8px;
  border: 1.5px solid var(--c-border);
  background: var(--c-overlay);
  color: var(--c-text-bright);
  font-size: 16px;
  font-weight: 800;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-family: inherit;

  &:focus { outline: none; border-color: var(--c-brand-border); }
}

.bet-amount-quick {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.bet-quick {
  flex: 1;
  min-width: 60px;
  padding: 6px 8px;
  border-radius: 6px;
  border: 1px solid var(--c-border);
  background: transparent;
  color: var(--c-text-sub);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-variant-numeric: tabular-nums;

  &:hover:not(:disabled) { color: var(--c-text-bright); border-color: var(--c-brand-border); }
  &:disabled { opacity: 0.4; cursor: not-allowed; }
  &.active {
    background: var(--c-brand-bg);
    border-color: var(--c-brand);
    color: var(--c-brand-text);
  }
}

.bet-summary {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--c-brand-bg-soft);
  border: 1px solid var(--c-brand-border);
}

.bet-summary-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--c-text-2);
}

.bet-summary-payout {
  font-size: 18px;
  font-weight: 800;
  color: var(--c-brand-text);
  font-variant-numeric: tabular-nums;
}

.bet-disclaimer {
  margin: 6px 0 0;
  font-size: 10px;
  color: var(--c-text-muted);
  line-height: 1.5;
}
</style>
