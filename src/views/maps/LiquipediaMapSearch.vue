<template>
  <section class="lp-search">
    <h2 class="lp-title">리퀴피디아에서 불러오기 <span class="lp-optional">선택</span></h2>
    <p class="lp-hint">
      영문 이름으로 검색하면 크기·인원·타일셋·이미지·원작자를 채워드려요.
      리퀴피디아가 영어 위키라 한글 이름으로는 찾을 수 없어요. (예: 투혼 → Fighting Spirit)
    </p>

    <!-- 등록 폼 바깥에 있어야 Enter가 등록 폼을 제출하지 않는다 -->
    <div class="lp-row">
      <input
        v-model="query"
        class="lp-input"
        type="text"
        maxlength="60"
        placeholder="Fighting Spirit, Polypoid ..."
        :disabled="searching"
        @keydown.enter.prevent="runSearch"
      />
      <button type="button" class="lp-search-btn" :disabled="searching || !query.trim()" @click="runSearch">
        {{ searching ? '찾는 중...' : '검색' }}
      </button>
    </div>

    <p v-if="error" class="lp-error">{{ error }}</p>
    <p v-else-if="searched && results.length === 0" class="lp-empty">
      검색 결과가 없어요. 영문 이름 철자를 확인해주세요.
    </p>

    <ul v-if="results.length" class="lp-results">
      <li v-for="r in results" :key="r.liquipedia_name" class="lp-result">
        <div class="lp-result-info">
          <div class="lp-result-name">
            {{ r.liquipedia_name }}
            <span v-if="r.version" class="lp-version">v{{ r.version }}</span>
            <span v-if="r.image" class="lp-has-image">이미지 있음</span>
          </div>
          <div class="lp-meta">{{ metaLabel(r) }}</div>
          <div v-if="existing(r)" class="lp-existing" :class="`lp-existing--${existing(r)!.kind}`">
            {{ existingLabel(existing(r)!) }}
          </div>
        </div>

        <RouterLink
          v-if="existing(r)?.kind === 'same-page'"
          :to="`/maps/${existing(r)!.map.id}/edit`"
          class="lp-pick lp-pick--ghost"
        >수정 화면으로</RouterLink>
        <button v-else type="button" class="lp-pick" :disabled="busy" @click="emit('select', r)">불러오기</button>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { TILESETS, searchLiquipediaMaps, type MapRow } from '@/lib/maps'
import { findExistingMap, type ExistingMatch, type LadderMapInfo } from '@/lib/ladderMatch'

const props = defineProps<{ maps: MapRow[]; busy?: boolean }>()
const emit = defineEmits<{ select: [info: LadderMapInfo] }>()

const query = ref('')
const searching = ref(false)
const searched = ref(false)
const error = ref<string | null>(null)
const results = ref<LadderMapInfo[]>([])

async function runSearch() {
  const q = query.value.trim()
  if (!q || searching.value) return
  // 서버도 한글을 걸러내지만, 왜 안 되는지 바로 알려주는 편이 낫다
  if (/[가-힣]/.test(q) && !/[A-Za-z]/.test(q)) {
    error.value = '리퀴피디아는 영어 위키라 영문 이름으로 검색해야 해요. (예: 투혼 → Fighting Spirit)'
    results.value = []
    return
  }
  searching.value = true
  error.value = null
  try {
    results.value = await searchLiquipediaMaps(q)
    searched.value = true
  } catch (e: any) {
    error.value = e.message ?? '검색에 실패했습니다.'
    results.value = []
  } finally {
    searching.value = false
  }
}

function existing(info: LadderMapInfo): ExistingMatch | null {
  return findExistingMap(info, props.maps)
}

function existingLabel(match: ExistingMatch): string {
  if (match.kind === 'same-page') return `이미 '${match.map.name}'(으)로 등록돼 있어요.`
  if (match.kind === 'same-name') return `이미 등록된 '${match.map.name}'와(과) 같은 맵 같아요.`
  return `버전만 다른 '${match.map.name}'이(가) 등록돼 있어요.`
}

function metaLabel(info: LadderMapInfo): string {
  const parts: string[] = []
  if (info.width && info.height) parts.push(`${info.width}×${info.height}`)
  if (info.player_count) parts.push(`${info.player_count}인`)
  const tileset = TILESETS.find(t => t.id === info.tileset)?.name ?? info.tileset_raw
  if (tileset) parts.push(tileset)
  return parts.length ? parts.join(' · ') : '크기·인원·타일셋 정보 없음'
}
</script>

<style lang="scss" scoped>
@use './LiquipediaMapSearch.scss';
</style>
