import { supabase } from '@/lib/supabase'
import {
  aliasesWith, droppedAfter,
  type LadderMapImage, type LadderMapInfo, type LadderPool, type LadderSyncPreview,
} from './ladderMatch'

export interface MapRow {
  id: string
  name: string
  aliases: string[]
  image_url: string | null
  thumbnail_url: string | null
  width: number
  height: number
  player_count: number
  tileset: string
  /** 리퀴피디아 래더 맵 풀의 이름. 다음 동기화 때 같은 맵을 알아보는 키 (래더 동기화로 연결된 적 없으면 null) */
  liquipedia_name: string | null
  /** 현재 래더 맵 풀에 있는지. 래더에서 빠져도 맵은 지우지 않고 이 값만 끈다 */
  is_ladder: boolean
  version: string | null
  ladder_synced_at: string | null
  /** 리퀴피디아에서 가져온 이미지의 원작자·원출처. 관리자가 직접 올린 이미지면 null */
  image_author: string | null
  image_source: string | null
  created_at: string
  updated_at: string
}

export const TILESETS = [
  { id: 'badlands', name: '황무지' },
  { id: 'space', name: '우주 정거장' },
  { id: 'install', name: '설치물' },
  { id: 'ashworld', name: '화산 지대' },
  { id: 'jungle', name: '정글' },
  { id: 'desert', name: '사막' },
  { id: 'ice', name: '얼음' },
  { id: 'twilight', name: '황혼' },
] as const

const THUMBNAIL_MAX_SIZE = 320
const IMAGE_MAX_SIZE = 1280

function resizeToCanvas(img: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return canvas
}

function canvasToFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('blob conversion failed'))
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      quality,
    )
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img) }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file)
  const canvas = resizeToCanvas(img, IMAGE_MAX_SIZE)
  return canvasToFile(canvas, 'image.jpg', 0.85)
}

async function generateThumbnail(file: File): Promise<File> {
  const img = await loadImage(file)
  const canvas = resizeToCanvas(img, THUMBNAIL_MAX_SIZE)
  return canvasToFile(canvas, 'thumb.jpg', 0.75)
}

export interface MapInsert {
  name: string
  aliases: string[]
  width: number
  height: number
  player_count: number
  tileset: string
  imageFile: File | null
}

/** 리퀴피디아에서 불러와 등록할 때만 붙는 정보 */
export interface MapLiquipediaFields {
  liquipedia_name: string
  version: string | null
  /** 불러온 리퀴피디아 이미지를 그대로 등록할 때만. 관리자가 이미지를 바꿨으면 넘기지 않는다 */
  image_author?: string | null
  image_source?: string | null
}

export async function getMaps(): Promise<MapRow[]> {
  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getMap(id: string): Promise<MapRow> {
  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function uploadImage(file: File, path: string): Promise<string> {
  const { error } = await supabase.storage.from('map-images').upload(path, file)
  if (error) throw error
  return supabase.storage.from('map-images').getPublicUrl(path).data.publicUrl
}

/** 원본을 압축본(1280px)과 썸네일(320px)로 만들어 저장소에 올린다 */
async function storeMapImage(file: File): Promise<{ image_url: string; thumbnail_url: string }> {
  const base = crypto.randomUUID()
  const [compressed, thumb] = await Promise.all([compressImage(file), generateThumbnail(file)])
  const [image_url, thumbnail_url] = await Promise.all([
    uploadImage(compressed, `${base}.jpg`),
    uploadImage(thumb, `${base}_thumb.jpg`),
  ])
  return { image_url, thumbnail_url }
}

export async function updateMap(
  id: string,
  data: MapInsert,
  existingImageUrl: string | null,
  existingThumbnailUrl: string | null,
) {
  let image_url = existingImageUrl
  let thumbnail_url = existingThumbnailUrl

  if (data.imageFile) {
    const stored = await storeMapImage(data.imageFile)
    image_url = stored.image_url
    thumbnail_url = stored.thumbnail_url
  }

  const { data: map, error } = await supabase
    .from('maps')
    .update({
      name: data.name,
      aliases: data.aliases,
      width: data.width,
      height: data.height,
      player_count: data.player_count,
      tileset: data.tileset,
      image_url,
      thumbnail_url,
      // 이미지를 새로 올리거나 지웠으면 더 이상 리퀴피디아 이미지가 아니므로 원작자 표기도 지운다
      ...(data.imageFile || !existingImageUrl ? { image_author: null, image_source: null } : {}),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return map
}

export async function createMap(data: MapInsert, liquipedia?: MapLiquipediaFields) {
  let image_url: string | null = null
  let thumbnail_url: string | null = null

  if (data.imageFile) {
    const stored = await storeMapImage(data.imageFile)
    image_url = stored.image_url
    thumbnail_url = stored.thumbnail_url
  }

  const { data: map, error } = await supabase
    .from('maps')
    .insert({
      name: data.name,
      aliases: data.aliases,
      width: data.width,
      height: data.height,
      player_count: data.player_count,
      tileset: data.tileset,
      image_url,
      thumbnail_url,
      // 리퀴피디아에서 불러온 맵은 그 이름을 같이 저장해 두면, 나중에 래더에 들어왔을 때
      // 동기화가 같은 맵으로 알아보고 자동으로 연결한다
      ...(liquipedia ?? {}),
    })
    .select()
    .single()

  if (error) throw error
  return map
}

// ── 래더 맵 동기화 (리퀴피디아) ──────────────────────────────────
// 가져오기는 /api/liquipedia-maps(서버)가 하고, 반영은 관리자가 검토 화면에서 고른 대로
// 여기서 한다. 매칭 규칙은 ladderMatch.ts.

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')
  return { Authorization: `Bearer ${token}` }
}

async function getLiquipediaApi<T>(query: string): Promise<T> {
  const res = await fetch(`/api/liquipedia-maps${query}`, { headers: await authHeader() })
  // Vite 개발 서버에는 /api 함수가 없어 index.html(HTML)이 돌아온다
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('리퀴피디아 API에 연결하지 못했습니다. 로컬 개발 서버(npm run dev)에서는 동작하지 않으니 Vercel 프리뷰에서 확인해주세요.')
  }
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `리퀴피디아 API 오류 (${res.status})`)
  return body as T
}

export function fetchLadderPool(): Promise<LadderPool> {
  return getLiquipediaApi<LadderPool>('')
}

/** 래더와 무관하게 리퀴피디아 맵을 검색한다. 영문 이름만 걸린다 (영어 위키라) */
export async function searchLiquipediaMaps(query: string): Promise<LadderMapInfo[]> {
  const body = await getLiquipediaApi<{ results: LadderMapInfo[] }>(`?search=${encodeURIComponent(query)}`)
  return body.results
}

/** 리퀴피디아 이미지를 /api를 거쳐 받는다 (같은 출처라 canvas 압축이 막히지 않는다) */
export async function fetchLiquipediaImage(url: string): Promise<File> {
  const res = await fetch(`/api/liquipedia-maps?image=${encodeURIComponent(url)}`, { headers: await authHeader() })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) {
    const body = type.includes('application/json') ? await res.json() : null
    throw new Error(body?.error ?? `이미지를 받지 못했습니다. (${res.status})`)
  }
  return new File([await res.blob()], url.split('/').pop() || 'map.jpg', { type })
}

/**
 * 리퀴피디아 이미지를 우리 저장소로 복사한다. 링크를 걸지 않는 이유: 리퀴피디아 트래픽을
 * 끌어다 쓰게 되고, 파일 이름이 바뀌면 이미지가 깨진다.
 */
async function importLadderImage(image: LadderMapImage) {
  const stored = await storeMapImage(await fetchLiquipediaImage(image.url))
  return { ...stored, image_author: image.author, image_source: image.source }
}

export type LadderDecision =
  | {
      kind: 'create'
      info: LadderMapInfo
      name: string
      width: number
      height: number
      player_count: number
      tileset: string
    }
  | { kind: 'link'; info: LadderMapInfo; mapId: string }
  | { kind: 'later'; info: LadderMapInfo }

export interface LadderSyncResult {
  failed: { label: string; message: string }[]
  /** 맵은 반영됐지만 이미지만 못 가져온 경우 — 맵 반영 실패와 구분해 알린다 */
  imageFailed: string[]
}

/**
 * 검토 결과를 반영한다. 실패한 항목이 있어도 나머지는 계속 진행하고 실패 목록을 돌려준다 —
 * 다음 동기화 때 전부 다시 계산되므로 일부만 반영된 상태도 안전하다.
 *
 * withImages면 이미지가 없는 맵에만 리퀴피디아 이미지를 넣는다. 관리자가 직접 올린
 * 이미지는 절대 덮어쓰지 않는다.
 */
export async function applyLadderSync(
  preview: LadderSyncPreview,
  decisions: LadderDecision[],
  options: { withImages: boolean },
): Promise<LadderSyncResult> {
  const now = new Date().toISOString()
  const failed: LadderSyncResult['failed'] = []
  const imageFailed: string[] = []
  const run = async (label: string, op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op()
    if (error) failed.push({ label, message: error.message })
  }
  // 이미지는 부가 정보라, 못 가져와도 맵 반영은 계속한다
  const imageFields = async (info: LadderMapInfo, hasImage: boolean) => {
    if (!options.withImages || hasImage || !info.image) return {}
    try {
      return await importLadderImage(info.image)
    } catch (e: any) {
      imageFailed.push(`${info.liquipedia_name} (${e.message ?? '오류'})`)
      return {}
    }
  }

  for (const { info, map } of preview.linked) {
    const image = await imageFields(info, !!map.thumbnail_url)
    await run(info.liquipedia_name, () =>
      supabase.from('maps')
        .update({ is_ladder: true, version: info.version, ladder_synced_at: now, ...image })
        .eq('id', map.id),
    )
  }

  for (const d of decisions) {
    if (d.kind === 'create') {
      const image = await imageFields(d.info, false)
      await run(d.info.liquipedia_name, () =>
        supabase.from('maps').insert({
          name: d.name,
          // 이름을 한글로 바꿔 등록해도 리플레이에 찍히는 영문명으로 전적이 매칭되게
          aliases: aliasesWith({ name: d.name, aliases: [] }, [d.info.liquipedia_name]),
          width: d.width,
          height: d.height,
          player_count: d.player_count,
          tileset: d.tileset,
          image_url: null,
          thumbnail_url: null,
          liquipedia_name: d.info.liquipedia_name,
          is_ladder: true,
          version: d.info.version,
          ladder_synced_at: now,
          ...image,
        }),
      )
    } else if (d.kind === 'link') {
      // 별칭을 옛 값으로 덮어쓰지 않도록 반영 직전에 최신 상태를 다시 읽는다
      let target: MapRow
      try {
        target = await getMap(d.mapId)
      } catch (e: any) {
        failed.push({ label: d.info.liquipedia_name, message: e.message ?? '연결할 맵을 찾지 못했습니다.' })
        continue
      }
      const image = await imageFields(d.info, !!target.thumbnail_url)
      await run(d.info.liquipedia_name, () =>
        supabase.from('maps')
          .update({
            liquipedia_name: d.info.liquipedia_name,
            is_ladder: true,
            version: d.info.version,
            ladder_synced_at: now,
            // 새 이름과 버전업 전 이름(이전 liquipedia_name)을 별칭에 남겨 옛 리플레이 전적도 계속 매칭되게
            aliases: aliasesWith(target, [d.info.liquipedia_name, d.info.name, target.liquipedia_name]),
            ...image,
          })
          .eq('id', d.mapId),
      )
    }
  }

  const linkTargets = decisions.flatMap(d => (d.kind === 'link' ? [d.mapId] : []))
  for (const map of droppedAfter(preview, linkTargets)) {
    await run(map.name, () =>
      supabase.from('maps').update({ is_ladder: false, ladder_synced_at: now }).eq('id', map.id),
    )
  }

  return { failed, imageFailed }
}
