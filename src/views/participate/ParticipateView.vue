<template>
  <div class="participate-page">
    <AppHeader />

    <div class="participate-content">
      <button class="btn-back" @click="$router.push({ name: 'home' })">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <path d="M9 2L4 7L9 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        홈
      </button>

      <div class="page-title-row">
        <h1 class="page-title">리그 참여</h1>
      </div>

      <div v-if="loading" class="state-msg">불러오는 중...</div>
      <div v-else-if="!leagues.length" class="state-msg">현재 참여 가능한 리그가 없습니다.</div>

      <div v-else class="league-list">
        <div
          v-for="league in leagues"
          :key="league.id"
          class="league-card"
        >
          <div class="league-card-top">
            <span class="status-badge" :class="`status-badge--${getLeagueStatus(league)}`">
              {{ statusLabel(getLeagueStatus(league)) }}
            </span>
            <span class="eligibility-badge">{{ eligibilityLabel(league.eligibility_type) }}</span>
          </div>

          <p class="league-name">{{ league.name }}</p>

          <div class="league-meta">
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <rect x="1" y="2" width="10" height="9" rx="1.5" stroke="currentColor" stroke-width="1.1"/>
                <path d="M1 5h10" stroke="currentColor" stroke-width="1.1"/>
                <path d="M4 1v2M8 1v2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
              </svg>
              {{ league.start_date }} ~ {{ league.end_date }}
            </span>
          </div>
          <div class="league-meta">
            <span class="meta-item">
              <span
                  v-for="tier in league.eligible_tiers"
                  :key="tier"
                  class="tier-chip"
                  :class="`tier-chip--${tier.toLowerCase()}`"
                >{{ tier }}</span>
            </span>
            </div>

          <button
            v-if="league.description"
            class="btn-guide"
            @click="openGuide(league)"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="currentColor" stroke-width="1.3"/>
              <path d="M7 6.5v4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
              <circle cx="7" cy="4.5" r="0.7" fill="currentColor"/>
            </svg>
            리그 안내 확인
          </button>
          
        </div>
      </div>
    </div>

    <!-- ── 안내 모달 ─────────────────────────────────────── -->
    <Teleport to="body">
      <div v-if="guideModal.open" class="modal-overlay" @click.self="guideModal.open = false">
        <div class="modal">
          <div class="modal-header">
            <p class="modal-title">{{ guideModal.name }}</p>
            <button class="modal-close" @click="guideModal.open = false">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <EditorContent :editor="viewEditor" />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, watch } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import { getLeagues, getLeagueStatus, type LeagueRow, type LeagueStatus, type EligibilityType } from '@/lib/leagues'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { Color } from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import { TextAlign } from '@tiptap/extension-text-align'
import { Extension } from '@tiptap/core'

const FontSize = Extension.create({
  name: 'fontSize',
  addOptions: () => ({ types: ['textStyle'] }),
  addGlobalAttributes() {
    return [{ types: this.options.types, attributes: { fontSize: { default: null, parseHTML: el => el.style.fontSize || null, renderHTML: attrs => attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {} } } }]
  },
  addCommands() {
    return {
      setFontSize: (size: string) => ({ chain }: any) => chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize: () => ({ chain }: any) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    } as any
  },
})

const loading = ref(true)
const leagues = ref<LeagueRow[]>([])

const guideModal = reactive({ open: false, name: '' })

const viewEditor = useEditor({
  content: '',
  editable: false,
  extensions: [
    StarterKit,
    TextStyle,
    Color,
    FontSize,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
  ],
  editorProps: { attributes: { class: 'tiptap-editor' } },
})

function openGuide(league: LeagueRow) {
  guideModal.name = league.name
  viewEditor.value?.commands.setContent(league.description ?? '')
  guideModal.open = true
}

watch(() => guideModal.open, open => {
  if (!open) viewEditor.value?.commands.setContent('')
})

onMounted(async () => {
  const all = await getLeagues()
  leagues.value = all
    .filter(l => getLeagueStatus(l) === 'ongoing')
  loading.value = false
})

function statusLabel(status: LeagueStatus) {
  return { ongoing: '진행중', upcoming: '예정', preparing: '준비중', finished: '종료' }[status]
}

function eligibilityLabel(type: EligibilityType) {
  return { open: '누구나', application: '신청제', invitation: '초대제' }[type]
}
</script>

<style lang="scss" scoped>
@use './ParticipateView.scss';
</style>
