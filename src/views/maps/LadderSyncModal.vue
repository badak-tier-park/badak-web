<template>
  <Teleport to="body">
    <div class="modal-backdrop" @click.self="close">
      <div class="modal modal--lg ladder-modal">
        <div class="modal-header">
          <div>
            <p class="modal-title">래더 맵 동기화</p>
            <p class="modal-subtitle">
              <template v-if="preview">
                {{ preview.pool.season }} ·
                <a :href="preview.pool.source_url" target="_blank" rel="noopener noreferrer" class="source-link">리퀴피디아</a> 기준
              </template>
              <template v-else>리퀴피디아에서 현재 래더 맵 풀을 가져옵니다</template>
            </p>
          </div>
          <button class="modal-close" :disabled="applying" aria-label="닫기" @click="close">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="modal-body">
          <p v-if="loading" class="sync-state">리퀴피디아에서 맵 풀을 가져오는 중...</p>
          <p v-else-if="loadError" class="sync-state sync-state--error">{{ loadError }}</p>

          <template v-else-if="preview">
            <p v-if="nothingToDo" class="sync-state">이미 최신 상태입니다. 바뀐 맵이 없습니다.</p>

            <!-- ── 처음 보는 맵: 관리자가 결정 ── -->
            <section v-if="rows.length" class="sync-group">
              <p class="sync-group-title">새로 발견된 맵 <span class="sync-count">{{ rows.length }}</span></p>
              <p class="sync-group-hint">
                이미 등록된 맵과 같은 맵이면 <b>연결</b>하세요. 리퀴피디아 이름이 별칭으로 추가돼
                리플레이 전적도 그 맵으로 잡힙니다.
              </p>

              <div v-for="row in rows" :key="row.info.liquipedia_name" class="sync-row">
                <div class="sync-row-head">
                  <div class="sync-row-info">
                    <span class="sync-name">{{ row.info.liquipedia_name }}</span>
                    <span v-if="row.info.version" class="sync-version">v{{ row.info.version }}</span>
                    <span class="sync-meta">{{ metaLabel(row.info) }}</span>
                  </div>
                  <select v-model="row.choice" class="sync-select" :disabled="applying || done">
                    <option value="create">새 맵으로 등록</option>
                    <optgroup v-if="linkTargets.length" label="기존 맵에 연결">
                      <option v-for="m in linkTargets" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </optgroup>
                    <option value="later">나중에 결정</option>
                  </select>
                </div>

                <p v-if="row.suggestion && row.choice === row.suggestion.id" class="sync-suggest">
                  이름이 같아 '{{ row.suggestion.name }}'에 연결하도록 골라뒀어요. 다른 맵이면 바꿔주세요.
                </p>

                <div v-if="row.choice === 'create'" class="sync-create" :class="{ 'sync-create--simple': !row.needsDetail }">
                  <label class="sync-field">
                    <span>이름</span>
                    <input v-model="row.name" class="field-input" type="text" maxlength="50" :disabled="applying || done" />
                  </label>
                  <template v-if="row.needsDetail">
                    <label class="sync-field">
                      <span>가로</span>
                      <input v-model.number="row.width" class="field-input" type="number" min="32" max="256" :disabled="applying || done" />
                    </label>
                    <label class="sync-field">
                      <span>세로</span>
                      <input v-model.number="row.height" class="field-input" type="number" min="32" max="256" :disabled="applying || done" />
                    </label>
                    <label class="sync-field">
                      <span>인원</span>
                      <input v-model.number="row.player_count" class="field-input" type="number" min="2" max="8" :disabled="applying || done" />
                    </label>
                    <label class="sync-field sync-field--tileset">
                      <span>타일셋</span>
                      <select v-model="row.tileset" class="field-input" :disabled="applying || done">
                        <option :value="null" disabled>선택</option>
                        <option v-for="t in TILESETS" :key="t.id" :value="t.id">{{ t.name }}</option>
                      </select>
                    </label>
                  </template>
                </div>
                <p v-if="row.choice === 'create' && row.needsDetail" class="sync-detail-hint">
                  리퀴피디아에 정보가 없어 직접 채워야 하는 항목이 있어요.
                </p>
              </div>
            </section>

            <!-- ── 이미 연결된 맵: 자동 갱신 ── -->
            <section v-if="preview.linked.length" class="sync-group">
              <p class="sync-group-title">이미 연결된 맵 <span class="sync-count">{{ preview.linked.length }}</span></p>
              <p class="sync-group-hint">버전과 래더 표시만 자동으로 갱신됩니다.</p>
              <div class="sync-chips">
                <span v-for="l in preview.linked" :key="l.map.id" class="sync-chip">
                  {{ l.map.name }}
                  <span v-if="l.info.version" class="sync-chip-sub">v{{ l.info.version }}</span>
                </span>
              </div>
            </section>

            <!-- ── 래더에서 빠진 맵: 표시만 해제 ── -->
            <section v-if="dropped.length" class="sync-group">
              <p class="sync-group-title">래더에서 빠지는 맵 <span class="sync-count">{{ dropped.length }}</span></p>
              <p class="sync-group-hint">맵과 지난 기록은 그대로 두고 래더 표시만 해제합니다.</p>
              <div class="sync-chips">
                <span v-for="m in dropped" :key="m.id" class="sync-chip sync-chip--dropped">{{ m.name }}</span>
              </div>
            </section>
          </template>
        </div>

        <div class="modal-footer">
          <p v-if="applyError" class="save-error">{{ applyError }}</p>
          <div class="modal-actions">
            <button class="btn-cancel" :disabled="applying" @click="close">{{ done ? '닫기' : '취소' }}</button>
            <button
              v-if="!done"
              class="btn-save"
              :disabled="!preview || applying || nothingToDo"
              @click="handleApply"
            >
              {{ applying ? '반영 중...' : '반영' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  TILESETS, fetchLadderPool, applyLadderSync,
  type MapRow, type LadderDecision,
} from '@/lib/maps'
import { buildLadderSyncPreview, droppedAfter, type LadderMapInfo, type LadderSyncPreview } from '@/lib/ladderMatch'

const props = defineProps<{ maps: MapRow[] }>()
const emit = defineEmits<{ close: []; applied: [] }>()

interface Row {
  info: LadderMapInfo
  suggestion: MapRow | null
  /** 'create' | 'later' | 연결할 맵 id */
  choice: string
  name: string
  width: number | null
  height: number | null
  player_count: number | null
  tileset: string | null
  /** 리퀴피디아에 정보가 비어 있어 직접 채워야 하는 항목이 있는지 */
  needsDetail: boolean
}

const loading = ref(true)
const loadError = ref<string | null>(null)
const preview = ref<LadderSyncPreview | null>(null)
const rows = ref<Row[]>([])
const applying = ref(false)
const applyError = ref<string | null>(null)
const done = ref(false)

onMounted(async () => {
  try {
    const pool = await fetchLadderPool()
    preview.value = buildLadderSyncPreview(pool, props.maps)
    rows.value = preview.value.fresh.map(({ info, suggestion }) => ({
      info,
      suggestion,
      choice: suggestion?.id ?? 'create',
      name: info.name,
      width: info.width,
      height: info.height,
      player_count: info.player_count,
      tileset: info.tileset,
      needsDetail: [info.width, info.height, info.player_count, info.tileset].some(v => v === null),
    }))
  } catch (e: any) {
    loadError.value = e.message ?? '래더 맵 풀을 가져오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

/** 이번 풀의 다른 맵에 이미 연결된 맵은 연결 대상에서 뺀다 (한 맵에 두 래더 맵이 붙지 않게) */
const linkTargets = computed(() => {
  const taken = new Set(preview.value?.linked.map(l => l.map.id) ?? [])
  return props.maps.filter(m => !taken.has(m.id)).sort((a, b) => a.name.localeCompare(b.name, 'ko'))
})

const chosenLinkIds = computed(() =>
  rows.value.filter(r => r.choice !== 'create' && r.choice !== 'later').map(r => r.choice),
)

// 반영과 같은 기준(droppedAfter)으로 보여준다 — 버전업으로 연결한 맵은 빠지는 맵이 아니다
const dropped = computed(() => (preview.value ? droppedAfter(preview.value, chosenLinkIds.value) : []))

const nothingToDo = computed(() =>
  !!preview.value && rows.value.length === 0 && dropped.value.length === 0
  && preview.value.linked.every(l => l.map.is_ladder && l.map.version === l.info.version),
)

function metaLabel(info: LadderMapInfo): string {
  if (info.missing_page) return '리퀴피디아에 맵 정보 페이지 없음'
  const parts: string[] = []
  if (info.width && info.height) parts.push(`${info.width}×${info.height}`)
  if (info.player_count) parts.push(`${info.player_count}인`)
  const tileset = TILESETS.find(t => t.id === info.tileset)?.name ?? info.tileset_raw
  if (tileset) parts.push(tileset)
  return parts.length ? parts.join(' · ') : '크기·인원·타일셋 정보 없음'
}

function validate(): string | null {
  const seen = new Map<string, string>()
  for (const r of rows.value) {
    if (r.choice === 'later') continue
    if (r.choice === 'create') {
      if (!r.name.trim()) return `${r.info.liquipedia_name}: 이름을 입력해주세요.`
      if (![r.width, r.height, r.player_count].every(v => Number.isInteger(v) && (v as number) > 0)) {
        return `${r.info.liquipedia_name}: 가로·세로·인원을 입력해주세요.`
      }
      if (!r.tileset) return `${r.info.liquipedia_name}: 타일셋을 선택해주세요.`
      continue
    }
    const prev = seen.get(r.choice)
    if (prev) {
      const name = props.maps.find(m => m.id === r.choice)?.name ?? ''
      return `'${name}'에 ${prev}와 ${r.info.liquipedia_name}를 둘 다 연결할 수 없습니다.`
    }
    seen.set(r.choice, r.info.liquipedia_name)
  }
  return null
}

function toDecision(r: Row): LadderDecision {
  if (r.choice === 'later') return { kind: 'later', info: r.info }
  if (r.choice === 'create') {
    return {
      kind: 'create',
      info: r.info,
      name: r.name.trim(),
      width: r.width!,
      height: r.height!,
      player_count: r.player_count!,
      tileset: r.tileset!,
    }
  }
  return { kind: 'link', info: r.info, mapId: r.choice }
}

async function handleApply() {
  if (!preview.value) return
  const invalid = validate()
  if (invalid) { applyError.value = invalid; return }

  applying.value = true
  applyError.value = null
  try {
    const { failed } = await applyLadderSync(preview.value, rows.value.map(toDecision))
    emit('applied')
    if (failed.length === 0) { emit('close'); return }
    // 일부 실패 — 미리보기가 이미 낡았으니 다시 반영하지 못하게 닫기만 남긴다
    done.value = true
    applyError.value = `일부 항목을 반영하지 못했습니다: ${failed.map(f => `${f.label} (${f.message})`).join(', ')}`
  } catch (e: any) {
    applyError.value = e.message ?? '반영 중 오류가 발생했습니다.'
  } finally {
    applying.value = false
  }
}

function close() {
  if (applying.value) return
  emit('close')
}
</script>

<style lang="scss" scoped>
@use './LadderSyncModal.scss';
</style>
