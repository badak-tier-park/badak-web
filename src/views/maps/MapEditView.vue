<template>
  <div class="map-register-page">
    <AppHeader />

    <div class="page-inner">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <header class="page-header">
        <div class="page-header-title">
          <h1>맵 수정</h1>
          <p>등록된 맵 정보를 수정하세요</p>
        </div>
      </header>

      <div v-if="loadError" class="load-error">{{ loadError }}</div>

      <form v-else class="register-form" @submit.prevent="handleSubmit">

        <!-- 이미지 업로드 -->
        <section class="form-section">
          <h2 class="section-title">맵 이미지</h2>
          <div
            class="image-upload"
            :class="{ 'has-image': previewUrl, 'drag-over': isDragOver }"
            @dragover.prevent="isDragOver = true"
            @dragleave="isDragOver = false"
            @drop.prevent="onDrop"
            @click="fileInput?.click()"
          >
            <input
              ref="fileInput"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style="display:none"
              @change="onFileChange"
            />
            <img v-if="previewUrl" :src="previewUrl" class="image-preview" alt="맵 미리보기" />
            <div v-else class="upload-placeholder">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="rgba(170,59,255,0.1)"/>
                <path d="M13 28L19 18L23 23L26 19L32 28H13Z" stroke="rgba(170,59,255,0.6)" stroke-width="1.5" stroke-linejoin="round" fill="rgba(170,59,255,0.08)"/>
                <circle cx="16" cy="16" r="2.5" stroke="rgba(170,59,255,0.6)" stroke-width="1.5"/>
              </svg>
              <span class="upload-label">이미지를 드래그하거나 클릭하여 업로드</span>
              <span class="upload-hint">PNG, JPG, WebP</span>
            </div>
            <button v-if="previewUrl" type="button" class="image-remove" @click.stop="removeImage">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2L12 12M12 2L2 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </section>

        <!-- 기본 정보 -->
        <section class="form-section">
          <h2 class="section-title">기본 정보</h2>
          <div class="field-row">
            <div class="field">
              <label class="field-label">맵 이름</label>
              <input v-model="form.name" type="text" class="field-input" placeholder="예) 투혼, 폴리포이드, 버미어 ..." required />
            </div>
            <div class="field field--small">
              <label class="field-label">인원 수</label>
              <div class="player-selector">
                <button
                  v-for="n in 7"
                  :key="n + 1"
                  type="button"
                  class="player-btn"
                  :class="{ active: form.playerCount === n + 1 }"
                  @click="form.playerCount = n + 1"
                >{{ n + 1 }}</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Alias -->
        <section class="form-section">
          <h2 class="section-title">Alias</h2>
          <div class="field">
            <label class="field-label">다른 이름 (영문명, 버전명 등)</label>
            <div class="alias-input-row">
              <input
                v-model="aliasInput"
                type="text"
                class="field-input"
                placeholder="예) Fight Spirit, 투혼 1.4 ..."
                @keydown.enter.prevent="addAlias"
              />
              <button type="button" class="alias-add-btn" @click="addAlias">추가</button>
            </div>
            <div v-if="form.aliases.length" class="alias-tags">
              <span v-for="(alias, i) in form.aliases" :key="i" class="alias-tag">
                {{ alias }}
                <button type="button" class="alias-tag-remove" @click="removeAlias(i)">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                  </svg>
                </button>
              </span>
            </div>
          </div>
        </section>

        <!-- 맵 크기 -->
        <section class="form-section">
          <h2 class="section-title">맵 크기</h2>
          <div class="size-presets">
            <button
              v-for="preset in sizePresets"
              :key="preset.label"
              type="button"
              class="size-btn"
              :class="{ active: isSizeActive(preset) }"
              @click="applyPreset(preset)"
            >
              <span class="size-label">{{ preset.label }}</span>
              <span class="size-value">{{ preset.w }}×{{ preset.h }}</span>
            </button>
            <button type="button" class="size-btn" :class="{ active: isCustomSize }" @click="setCustom">
              <span class="size-label">직접 입력</span>
              <span class="size-value">Custom</span>
            </button>
          </div>
          <div v-if="isCustomSize" class="size-custom">
            <div class="field">
              <label class="field-label">가로 (W)</label>
              <input v-model.number="form.width" type="number" class="field-input" min="32" max="256" />
            </div>
            <span class="size-cross">×</span>
            <div class="field">
              <label class="field-label">세로 (H)</label>
              <input v-model.number="form.height" type="number" class="field-input" min="32" max="256" />
            </div>
          </div>
        </section>

        <!-- 타일 셋 -->
        <section class="form-section">
          <h2 class="section-title">타일 셋</h2>
          <div class="tileset-grid">
            <button
              v-for="tileset in tilesets"
              :key="tileset.id"
              type="button"
              class="tileset-btn"
              :class="{ active: form.tileset === tileset.id }"
              :style="{ '--tileset-color': tileset.color, '--tileset-bg': tileset.bg }"
              @click="form.tileset = tileset.id"
            >
              <span class="tileset-dot"></span>
              <span class="tileset-name">{{ tileset.name }}</span>
            </button>
          </div>
        </section>

        <!-- 제출 -->
        <div class="form-footer">
          <p v-if="submitError" class="submit-error">{{ submitError }}</p>
          <button type="button" class="btn-cancel" @click="router.back()">취소</button>
          <button type="submit" class="btn-submit" :disabled="submitting">
            <svg v-if="!submitting" width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8L6 12L14 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 16 16" fill="none" class="spin">
              <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2" stroke-dasharray="28" stroke-dashoffset="10" stroke-linecap="round"/>
            </svg>
            {{ submitting ? '저장 중...' : '수정 완료' }}
          </button>
        </div>

      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import { getMap, updateMap } from '@/lib/maps'

const router = useRouter()
const route = useRoute()
const mapId = route.params.id as string

// --- 기존 이미지 URL ---
const existingImageUrl = ref<string | null>(null)
const existingThumbnailUrl = ref<string | null>(null)
const loadError = ref<string | null>(null)

// --- 폼 상태 ---
const form = ref({
  name: '',
  playerCount: 2,
  width: 128,
  height: 128,
  tileset: '',
  imageFile: null as File | null,
  aliases: [] as string[],
})

// --- Alias ---
const aliasInput = ref('')

function addAlias() {
  const val = aliasInput.value.trim()
  if (val && !form.value.aliases.includes(val)) {
    form.value.aliases.push(val)
  }
  aliasInput.value = ''
}

function removeAlias(i: number) {
  form.value.aliases.splice(i, 1)
}

// --- 이미지 ---
const fileInput = ref<HTMLInputElement | null>(null)
const previewUrl = ref<string | null>(null)
const isDragOver = ref(false)

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) setImage(file)
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && ['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) setImage(file)
}

function setImage(file: File) {
  form.value.imageFile = file
  previewUrl.value = URL.createObjectURL(file)
}

function removeImage() {
  form.value.imageFile = null
  previewUrl.value = null
  existingImageUrl.value = null
  if (fileInput.value) fileInput.value.value = ''
}

// --- 맵 크기 ---
const sizePresets = [
  { label: '소형',   w: 64,  h: 64  },
  { label: '중형',   w: 96,  h: 96  },
  { label: '표준',   w: 128, h: 128 },
  { label: '대형',   w: 192, h: 192 },
  { label: '초대형', w: 256, h: 256 },
]

const isCustomSize = ref(false)

function isSizeActive(preset: typeof sizePresets[0]) {
  return !isCustomSize.value && form.value.width === preset.w && form.value.height === preset.h
}

function applyPreset(preset: typeof sizePresets[0]) {
  isCustomSize.value = false
  form.value.width = preset.w
  form.value.height = preset.h
}

function setCustom() {
  isCustomSize.value = true
}

// --- 타일 셋 ---
const tilesets = [
  { id: 'badlands',  name: '황무지',     color: '#c97d3a', bg: 'rgba(201,125,58,0.1)'  },
  { id: 'space',     name: '우주 정거장', color: '#4a8fcc', bg: 'rgba(74,143,204,0.1)'  },
  { id: 'install',   name: '설치물',     color: '#7a8a9a', bg: 'rgba(122,138,154,0.1)' },
  { id: 'ashworld',  name: '화산 지대',  color: '#cc4a2f', bg: 'rgba(204,74,47,0.1)'   },
  { id: 'jungle',    name: '정글',       color: '#3a9a4a', bg: 'rgba(58,154,74,0.1)'   },
  { id: 'desert',    name: '사막',       color: '#c9a83a', bg: 'rgba(201,168,58,0.1)'  },
  { id: 'ice',       name: '얼음',       color: '#7aaed4', bg: 'rgba(122,174,212,0.12)'},
  { id: 'twilight',  name: '황혼',       color: '#9a4acc', bg: 'rgba(154,74,204,0.1)'  },
]

// --- 기존 데이터 로드 ---
onMounted(async () => {
  try {
    const map = await getMap(mapId)
    form.value.name = map.name
    form.value.aliases = map.aliases
    form.value.playerCount = map.player_count
    form.value.width = map.width
    form.value.height = map.height
    form.value.tileset = map.tileset
    existingImageUrl.value = map.image_url
    existingThumbnailUrl.value = map.thumbnail_url

    if (map.image_url) previewUrl.value = map.image_url

    const matched = sizePresets.find(p => p.w === map.width && p.h === map.height)
    if (!matched) isCustomSize.value = true
  } catch (e: any) {
    loadError.value = e.message ?? '맵 정보를 불러올 수 없습니다.'
  }
})

// --- 제출 ---
const submitting = ref(false)
const submitError = ref<string | null>(null)

async function handleSubmit() {
  if (!form.value.tileset) {
    submitError.value = '타일 셋을 선택해주세요.'
    return
  }

  submitting.value = true
  submitError.value = null

  try {
    await updateMap(mapId, {
      name: form.value.name,
      aliases: form.value.aliases,
      width: form.value.width,
      height: form.value.height,
      player_count: form.value.playerCount,
      tileset: form.value.tileset,
      imageFile: form.value.imageFile,
    }, existingImageUrl.value, existingThumbnailUrl.value)
    router.push({ name: 'home' })
  } catch (e: any) {
    submitError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    submitting.value = false
  }
}
</script>

<style lang="scss" scoped>
@use './MapEditView.scss';
</style>
