import { supabase } from '@/lib/supabase'
import { aliasesWith, droppedAfter, type LadderMapInfo, type LadderPool, type LadderSyncPreview } from './ladderMatch'

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

export async function updateMap(
  id: string,
  data: MapInsert,
  existingImageUrl: string | null,
  existingThumbnailUrl: string | null,
) {
  let image_url = existingImageUrl
  let thumbnail_url = existingThumbnailUrl

  if (data.imageFile) {
    const base = crypto.randomUUID()
    const [compressed, thumb] = await Promise.all([
      compressImage(data.imageFile),
      generateThumbnail(data.imageFile),
    ])
    const [origUrl, thumbUrl] = await Promise.all([
      uploadImage(compressed, `${base}.jpg`),
      uploadImage(thumb, `${base}_thumb.jpg`),
    ])
    image_url = origUrl
    thumbnail_url = thumbUrl
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
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return map
}

export async function createMap(data: MapInsert) {
  let image_url: string | null = null
  let thumbnail_url: string | null = null

  if (data.imageFile) {
    const base = crypto.randomUUID()
    const [compressed, thumb] = await Promise.all([
      compressImage(data.imageFile),
      generateThumbnail(data.imageFile),
    ])
    const [origUrl, thumbUrl] = await Promise.all([
      uploadImage(compressed, `${base}.jpg`),
      uploadImage(thumb, `${base}_thumb.jpg`),
    ])
    image_url = origUrl
    thumbnail_url = thumbUrl
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
    })
    .select()
    .single()

  if (error) throw error
  return map
}

// ── 래더 맵 동기화 (리퀴피디아) ──────────────────────────────────
// 가져오기는 /api/ladder-maps(서버)가 하고, 반영은 관리자가 검토 화면에서 고른 대로
// 여기서 한다. 매칭 규칙은 ladderMatch.ts.

export async function fetchLadderPool(): Promise<LadderPool> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('로그인이 필요합니다.')

  const res = await fetch('/api/ladder-maps', { headers: { Authorization: `Bearer ${token}` } })
  // Vite 개발 서버에는 /api 함수가 없어 index.html(HTML)이 돌아온다
  if (!(res.headers.get('content-type') ?? '').includes('application/json')) {
    throw new Error('동기화 API에 연결하지 못했습니다. 로컬 개발 서버(npm run dev)에서는 동작하지 않으니 Vercel 프리뷰에서 확인해주세요.')
  }
  const body = await res.json()
  if (!res.ok) throw new Error(body.error ?? `동기화 API 오류 (${res.status})`)
  return body as LadderPool
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

/**
 * 검토 결과를 반영한다. 실패한 항목이 있어도 나머지는 계속 진행하고 실패 목록을 돌려준다 —
 * 다음 동기화 때 전부 다시 계산되므로 일부만 반영된 상태도 안전하다.
 */
export async function applyLadderSync(
  preview: LadderSyncPreview,
  decisions: LadderDecision[],
): Promise<{ failed: { label: string; message: string }[] }> {
  const now = new Date().toISOString()
  const failed: { label: string; message: string }[] = []
  const run = async (label: string, op: () => PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op()
    if (error) failed.push({ label, message: error.message })
  }

  for (const { info, map } of preview.linked) {
    await run(info.liquipedia_name, () =>
      supabase.from('maps').update({ is_ladder: true, version: info.version, ladder_synced_at: now }).eq('id', map.id),
    )
  }

  for (const d of decisions) {
    if (d.kind === 'create') {
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
      await run(d.info.liquipedia_name, () =>
        supabase.from('maps')
          .update({
            liquipedia_name: d.info.liquipedia_name,
            is_ladder: true,
            version: d.info.version,
            ladder_synced_at: now,
            // 새 이름과 버전업 전 이름(이전 liquipedia_name)을 별칭에 남겨 옛 리플레이 전적도 계속 매칭되게
            aliases: aliasesWith(target, [d.info.liquipedia_name, d.info.name, target.liquipedia_name]),
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

  return { failed }
}
