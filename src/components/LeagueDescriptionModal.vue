<template>
  <Teleport to="body">
    <div class="modal-backdrop">
      <div class="modal">
        <div class="modal-header">
          <span class="modal-title">{{ league.name }}</span>
          <button class="modal-close" @click="$emit('close')">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="editor-toolbar">
          <!-- 서식 -->
          <div class="toolbar-group">
            <button
              v-for="btn in formatButtons"
              :key="btn.label"
              class="toolbar-btn"
              :class="{ active: btn.isActive() }"
              type="button"
              :title="btn.label"
              @click="btn.action"
            >{{ btn.label }}</button>
          </div>

          <div class="toolbar-sep" />

          <!-- 글자 크기 -->
          <div class="toolbar-group">
            <button
              v-for="size in fontSizes"
              :key="size.value"
              class="toolbar-btn size-btn"
              :class="{ active: activeSize === size.value }"
              type="button"
              :title="size.label"
              @click="applySize(size.value)"
            >{{ size.label }}</button>
          </div>

          <div class="toolbar-sep" />

          <!-- 글자 색상 -->
          <div class="toolbar-group">
            <button
              class="toolbar-btn color-reset"
              :class="{ active: !activeColor }"
              type="button"
              title="기본색"
              @click="editor?.chain().focus().unsetColor().run()"
            >기본</button>
            <button
              v-for="color in colorPresets"
              :key="color.value"
              class="color-swatch"
              :class="{ active: activeColor === color.value }"
              :style="{ background: color.value }"
              :title="color.label"
              type="button"
              @click="applyColor(color.value)"
            />
          </div>
        </div>

        <div class="editor-wrap">
          <EditorContent :editor="editor" class="editor-content" />
        </div>

        <div class="modal-footer">
          <p v-if="saveError" class="save-error">{{ saveError }}</p>
          <div class="modal-actions">
            <button class="btn-cancel" :disabled="saving" @click="$emit('close')">취소</button>
            <button class="btn-save" :disabled="saving" @click="handleSave">
              {{ saving ? '저장 중...' : '저장' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { Extension } from '@tiptap/core'
import { updateLeagueDescription, type LeagueRow } from '@/lib/leagues'

// ── FontSize 커스텀 익스텐션 ─────────────────────────────
const FontSize = Extension.create({
  name: 'fontSize',
  addOptions: () => ({ types: ['textStyle'] }),
  addGlobalAttributes() {
    return [{
      types: this.options.types,
      attributes: {
        fontSize: {
          default: null,
          parseHTML: el => el.style.fontSize || null,
          renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {},
        },
      },
    }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) =>
        chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

// ── Props / Emits ─────────────────────────────────────────
const props = defineProps<{ league: LeagueRow }>()
const emit = defineEmits<{
  close: []
  saved: [description: string]
}>()

const saving = ref(false)
const saveError = ref<string | null>(null)

// ── 에디터 ────────────────────────────────────────────────
const editor = useEditor({
  content: props.league.description ?? '',
  extensions: [StarterKit, TextStyle, Color, FontSize],
  editorProps: { attributes: { class: 'tiptap-editor' } },
})

// ── 툴바 데이터 ───────────────────────────────────────────
const formatButtons = computed(() => [
  {
    label: 'B',
    isActive: () => editor.value?.isActive('bold') ?? false,
    action: () => editor.value?.chain().focus().toggleBold().run(),
  },
  {
    label: 'I',
    isActive: () => editor.value?.isActive('italic') ?? false,
    action: () => editor.value?.chain().focus().toggleItalic().run(),
  },
  {
    label: 'H2',
    isActive: () => editor.value?.isActive('heading', { level: 2 }) ?? false,
    action: () => editor.value?.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: 'H3',
    isActive: () => editor.value?.isActive('heading', { level: 3 }) ?? false,
    action: () => editor.value?.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    label: '• 목록',
    isActive: () => editor.value?.isActive('bulletList') ?? false,
    action: () => editor.value?.chain().focus().toggleBulletList().run(),
  },
  {
    label: '1. 목록',
    isActive: () => editor.value?.isActive('orderedList') ?? false,
    action: () => editor.value?.chain().focus().toggleOrderedList().run(),
  },
])

const fontSizes = [
  { label: '소', value: '12px' },
  { label: '중', value: '14px' },
  { label: '대', value: '18px' },
  { label: '특대', value: '24px' },
]

const colorPresets = [
  { label: '흰색',   value: '#ffffff' },
  { label: '빨강',   value: '#f87171' },
  { label: '주황',   value: '#fb923c' },
  { label: '노랑',   value: '#facc15' },
  { label: '초록',   value: '#4ade80' },
  { label: '민트',   value: '#34d399' },
  { label: '하늘',   value: '#38bdf8' },
  { label: '파랑',   value: '#60a5fa' },
  { label: '보라',   value: '#c084fc' },
  { label: '분홍',   value: '#f472b6' },
]

const activeColor = computed(() =>
  editor.value?.getAttributes('textStyle').color ?? null
)

const activeSize = computed(() =>
  editor.value?.getAttributes('textStyle').fontSize ?? null
)

function applyColor(color: string) {
  editor.value?.chain().focus().setColor(color).run()
}

function applySize(size: string) {
  if (activeSize.value === size) {
    ;(editor.value?.chain().focus() as any).unsetFontSize().run()
  } else {
    ;(editor.value?.chain().focus() as any).setFontSize(size).run()
  }
}

// ── 저장 ─────────────────────────────────────────────────
async function handleSave() {
  if (!editor.value) return
  saving.value = true
  saveError.value = null
  try {
    const html = editor.value.getHTML()
    await updateLeagueDescription(props.league.id, html)
    emit('saved', html)
  } catch (e: any) {
    saveError.value = e.message ?? '저장 중 오류가 발생했습니다.'
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => editor.value?.destroy())
</script>

<style lang="scss" scoped>
@use './LeagueDescriptionModal.scss';
</style>
