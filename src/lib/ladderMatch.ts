import type { MapRow } from './maps'

// ── 래더 맵 동기화: 리퀴피디아 맵 풀 ↔ 등록된 맵 매칭 ─────────────────
// DB에 손대지 않는 순수 로직만 둔다(테스트 가능하게). 조회·반영은 maps.ts.

/** api/ladder-maps.ts의 LadderMapInfo와 같은 모양 (api 쪽은 Node 전용이라 직접 import하지 않는다) */
export interface LadderMapInfo {
  liquipedia_name: string
  name: string
  version: string | null
  width: number | null
  height: number | null
  player_count: number | null
  tileset: string | null
  tileset_raw: string | null
  missing_page: boolean
}

export interface LadderPool {
  season: string
  source_url: string
  fetched_at: string
  maps: LadderMapInfo[]
}

export interface LadderSyncPreview {
  pool: LadderPool
  /** 이미 연결된 맵 — 래더 표시·버전만 자동 갱신 */
  linked: { info: LadderMapInfo; map: MapRow }[]
  /** 처음 보는 맵 — 관리자가 새로 등록할지 기존 맵에 연결할지 고른다 */
  fresh: { info: LadderMapInfo; suggestion: MapRow | null }[]
  /** 래더 표시가 켜져 있는데 이번 맵 풀엔 없는 맵 — 맵은 두고 래더 표시만 끈다 */
  dropped: MapRow[]
}

export function normalizeMapName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
}

/** 래더 시즌 교체 때 흔한 `Octagon` → `Octagon SE`, `투혼 1.3` → `1.4` 같은 버전 표기를 떼어낸다 */
function baseMapName(s: string): string {
  return normalizeMapName(s.replace(/\s+(se|re|le)$/i, '').replace(/\s*v?\d+(\.\d+)*$/i, ''))
}

/**
 * 처음 보는 래더 맵이 이미 등록된 맵과 같은 맵인지 추측한다. 관리자가 확인하는
 * 기본값일 뿐이라 틀려도 검토 화면에서 바로잡는다. 이름·별칭이 정확히 같으면 그 맵,
 * 아니면 버전 표기를 뗀 이름이 같은 맵을 고른다.
 */
function suggestMap(info: LadderMapInfo, candidates: MapRow[]): MapRow | null {
  const names = (m: MapRow) => [m.name, ...m.aliases]
  const exact = new Set([info.liquipedia_name, info.name].map(normalizeMapName))
  const hit = candidates.find(m => names(m).some(n => exact.has(normalizeMapName(n))))
  if (hit) return hit
  const base = baseMapName(info.liquipedia_name)
  return candidates.find(m => names(m).some(n => baseMapName(n) === base)) ?? null
}

export function buildLadderSyncPreview(pool: LadderPool, maps: MapRow[]): LadderSyncPreview {
  const poolNames = new Set(pool.maps.map(m => m.liquipedia_name))
  const byLiquipediaName = new Map(maps.filter(m => m.liquipedia_name).map(m => [m.liquipedia_name!, m]))
  // 이번 풀의 다른 맵에 이미 연결된 맵은 추천 대상에서 뺀다 (한 맵에 두 래더 맵이 붙지 않게)
  const linkable = maps.filter(m => !m.liquipedia_name || !poolNames.has(m.liquipedia_name))

  const linked: LadderSyncPreview['linked'] = []
  const fresh: LadderSyncPreview['fresh'] = []
  for (const info of pool.maps) {
    const map = byLiquipediaName.get(info.liquipedia_name)
    if (map) linked.push({ info, map })
    else fresh.push({ info, suggestion: suggestMap(info, linkable) })
  }
  const dropped = maps.filter(m => m.is_ladder && !(m.liquipedia_name && poolNames.has(m.liquipedia_name)))

  return { pool, linked, fresh, dropped }
}

/**
 * 실제로 래더 표시를 끌 맵. 지난 시즌 맵(Octagon)에 이번 시즌 버전(Octagon SE)을 연결하면
 * 그 맵은 dropped에도 들어 있는데, 끄면 방금 연결한 게 무효가 되므로 연결 대상은 뺀다.
 */
export function droppedAfter(preview: LadderSyncPreview, linkTargetIds: Iterable<string>): MapRow[] {
  const keep = new Set(linkTargetIds)
  return preview.dropped.filter(m => !keep.has(m.id))
}

/** 기존 별칭에 새 이름들을 더한다. 맵 이름이나 기존 별칭과 같은(대소문자·공백 무시) 것은 건너뛴다 */
export function aliasesWith(map: Pick<MapRow, 'name' | 'aliases'>, extra: (string | null | undefined)[]): string[] {
  const aliases = [...map.aliases]
  const taken = new Set([map.name, ...aliases].map(normalizeMapName))
  for (const a of extra) {
    if (!a || taken.has(normalizeMapName(a))) continue
    aliases.push(a)
    taken.add(normalizeMapName(a))
  }
  return aliases
}
