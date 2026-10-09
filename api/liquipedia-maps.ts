import { setDefaultAutoSelectFamilyAttemptTimeout } from 'node:net'
import { createClient } from '@supabase/supabase-js'

// 리퀴피디아 서버는 프랑스에 있어 한국에서 TCP 연결에만 ~0.3초가 걸린다. Node 기본값은
// IPv6/IPv4 주소별 연결 시도를 0.25초 만에 포기해 fetch가 ETIMEDOUT으로 실패한다(curl은 됨).
// 함수 리전이 아시아면 프로덕션에서도 같은 일이 생기므로 넉넉히 늘린다.
setDefaultAutoSelectFamilyAttemptTimeout(2000)

/**
 * GET /api/liquipedia-maps — 리퀴피디아에서 현재 시즌 스타 리마스터 래더 맵 풀과 맵별 정보를 가져온다.
 * GET /api/liquipedia-maps?image=<리퀴피디아 이미지 주소> — 그 맵 이미지 파일을 대신 받아 돌려준다.
 *
 * 브라우저에서 리퀴피디아를 직접 부르지 않고 서버를 거치는 이유: 리퀴피디아 API 이용 규칙이
 * 연락처가 담긴 User-Agent를 요구하는데, 브라우저 fetch는 User-Agent를 바꿀 수 없다.
 * 이미지도 같은 이유 + 브라우저가 다른 출처 이미지를 canvas로 압축하려면 CORS가 필요해서
 * 같은 출처(/api)로 받는다.
 *
 * 읽기 전용 프록시다. DB에는 쓰지 않는다 — 관리자가 검토 화면에서 고른 결과만 웹앱이
 * 기존 RLS 아래에서 반영한다. 자동으로 반영하지 않는 이유는 리퀴피디아는 영문명,
 * 바닥티어는 한글명으로 등록돼 있어 그대로 넣으면 같은 맵이 중복 생성되기 때문.
 */

const LP_API = 'https://liquipedia.net/starcraft/api.php'
// 맵 이미지 파일과 그 설명(원작자·출처)은 위키들이 공유하는 commons에 있다
const COMMONS_API = 'https://liquipedia.net/commons/api.php'
const POOL_PAGE = 'Maps/Ladder_Maps'
const USER_AGENT = 'BadakTier-LadderSync/1.0 (+https://github.com/badak-tier-park/badak-web)'
// 리퀴피디아 규칙: 요청 사이 2초 이상. parse 액션은 제한이 훨씬 엄격해 query 액션만 쓴다.
const REQUEST_GAP_MS = 2100
// 관리자가 버튼을 연달아 눌러도 리퀴피디아를 반복해서 두드리지 않게 (웜 인스턴스 한정)
const CACHE_TTL_MS = 10 * 60 * 1000
// 리퀴피디아 맵 이미지는 원본이 2048px·2MB까지 있다. Vercel 함수 응답 한도(4.5MB)를
// 넘으면 우리 에러 대신 플랫폼 에러로 끊기므로 그 안쪽에서 먼저 거절한다
const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export interface LadderMapImage {
  url: string
  width: number | null
  height: number | null
  /** 리퀴피디아 파일 설명의 author — 보통 맵 제작자 */
  author: string | null
  /** 리퀴피디아 파일 설명의 source — 리퀴피디아가 가져온 원출처 (제작자 블로그 등) */
  source: string | null
}

export interface LadderMapInfo {
  /** 맵 풀 표에 적힌 이름. 다음 동기화 때 같은 맵을 알아보는 키로 maps.liquipedia_name에 저장된다 */
  liquipedia_name: string
  /** 정보 상자에 적힌 이름 (없으면 liquipedia_name) */
  name: string
  version: string | null
  width: number | null
  height: number | null
  player_count: number | null
  /** 바닥티어 타일셋 id. 리퀴피디아 표기를 알아보지 못하면 null — 관리자가 직접 고른다 */
  tileset: string | null
  tileset_raw: string | null
  /** 맵 개별 페이지가 없어 크기·타일셋 등을 못 가져온 경우 */
  missing_page: boolean
  /** 리퀴피디아에 등록된 맵 이미지. 없거나 못 가져왔으면 null */
  image: LadderMapImage | null
}

export interface LadderPool {
  season: string
  source_url: string
  fetched_at: string
  maps: LadderMapInfo[]
  /** 맵 풀은 가져왔지만 일부(이미지 정보 등)를 못 가져온 경우의 안내 */
  warnings: string[]
}

let cache: { at: number; pool: LadderPool } | null = null

export async function GET(request: Request): Promise<Response> {
  const denied = await rejectNonAdmin(request)
  if (denied) return denied

  const imageUrl = new URL(request.url).searchParams.get('image')
  if (imageUrl !== null) return proxyImage(imageUrl)

  try {
    if (!cache || Date.now() - cache.at > CACHE_TTL_MS) {
      cache = { at: Date.now(), pool: await loadLadderPool() }
    }
    return json(cache.pool)
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e)
    return json({ error: `리퀴피디아에서 래더 맵 풀을 읽지 못했습니다. (${reason})` }, 502)
  }
}

// ── 권한 ────────────────────────────────────────────────────────
// 앱 로그인 시(stores/auth.ts)와 같은 방식으로 관리자 여부를 확인한다 — 이미 매 로그인마다
// 실제로 쓰이는 경로라 현재 RLS 아래에서 동작이 보장된다. 토큰은 Supabase Auth 서버가
// 직접 검증하므로 클라이언트가 보낸 값을 그대로 믿지 않는다.
async function rejectNonAdmin(request: Request): Promise<Response | null> {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return json({ error: '서버 설정이 누락되었습니다. (Supabase 환경변수)' }, 500)

  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) return json({ error: '로그인이 필요합니다.' }, 401)

  const supabase = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return json({ error: '로그인 정보를 확인하지 못했습니다.' }, 401)

  const discordId = userData.user.identities?.find(i => i.provider === 'discord')?.id
  if (!discordId) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  const { data: me } = await supabase.from('users').select('is_admin').eq('discord_id', discordId).maybeSingle()
  if (me?.is_admin !== true) return json({ error: '관리자만 사용할 수 있습니다.' }, 403)

  return null
}

// ── 리퀴피디아 조회 ─────────────────────────────────────────────
export async function loadLadderPool(): Promise<LadderPool> {
  const poolPages = await fetchWikitexts([POOL_PAGE])
  const poolText = poolPages.get(POOL_PAGE)?.content
  if (!poolText) throw new Error(`${POOL_PAGE} 페이지를 찾지 못했습니다`)

  const { season, names } = parsePoolTable(poolText)

  await sleep(REQUEST_GAP_MS)
  // 맵 9개 내외라 한 번의 query로 묶는다 (titles는 최대 50개)
  const mapPages = await fetchWikitexts(names)

  const contents = names.map(n => mapPages.get(n)?.content ?? null)
  const maps = names.map((n, i) => toMapInfo(n, contents[i]))
  const warnings: string[] = []

  // 이미지 정보는 부가 정보라, 못 가져와도 맵 풀 동기화 자체는 진행한다
  const files = contents.map(c => (c ? infoboxImageFile(c) : null))
  const wanted = [...new Set(files.filter((f): f is string => !!f))]
  if (wanted.length > 0) {
    try {
      await sleep(REQUEST_GAP_MS)
      const images = await fetchCommonsImages(wanted)
      maps.forEach((m, i) => {
        const file = files[i]
        m.image = file ? images.get(file) ?? null : null
      })
    } catch (e) {
      warnings.push(`맵 이미지 정보를 가져오지 못했습니다. (${e instanceof Error ? e.message : String(e)})`)
    }
  }

  return {
    season,
    source_url: `https://liquipedia.net/starcraft/${POOL_PAGE}`,
    fetched_at: new Date().toISOString(),
    maps,
    warnings,
  }
}

interface RawPage {
  title: string
  missing?: boolean
  revisions?: { slots: { main: { content: string } } }[]
  imageinfo?: { url: string; width?: number; height?: number }[]
}

/**
 * MediaWiki query 한 번. 요청한 제목 → 실제 페이지. 제목 정규화(밑줄→공백)와 리다이렉트
 * (예: File:Silver_Wing.jpg → Fighting_Spirit_sc.jpg)를 따라가 원래 요청한 제목으로 돌려준다.
 */
async function queryPages(api: string, titles: string[], props: Record<string, string>): Promise<Map<string, RawPage | null>> {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    redirects: '1',
    titles: titles.join('|'),
    ...props,
  })
  const res = await fetch(`${api}?${params}`, {
    headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' },
  })
  if (!res.ok) throw new Error(`리퀴피디아 응답 ${res.status}`)

  const body = await res.json() as {
    query?: {
      normalized?: { from: string; to: string }[]
      redirects?: { from: string; to: string }[]
      pages?: RawPage[]
    }
  }
  const q = body.query
  if (!q?.pages) throw new Error('리퀴피디아 응답 형식이 예상과 다릅니다')

  const normalized = new Map((q.normalized ?? []).map(n => [n.from, n.to]))
  const redirects = new Map((q.redirects ?? []).map(r => [r.from, r.to]))
  const pages = new Map(q.pages.map(p => [p.title, p]))

  const result = new Map<string, RawPage | null>()
  for (const requested of titles) {
    const n = normalized.get(requested) ?? requested
    const page = pages.get(redirects.get(n) ?? n)
    result.set(requested, page && !page.missing ? page : null)
  }
  return result
}

interface WikiPage { title: string; content: string }

async function fetchWikitexts(titles: string[]): Promise<Map<string, WikiPage | null>> {
  const raw = await queryPages(LP_API, titles, { prop: 'revisions', rvprop: 'content', rvslots: 'main' })
  const result = new Map<string, WikiPage | null>()
  for (const [requested, page] of raw) {
    const content = page?.revisions?.[0]?.slots.main.content
    result.set(requested, page && content ? { title: page.title, content } : null)
  }
  return result
}

/** 파일 이름 → 이미지 주소·크기 + 파일 설명({{FileInfo}})의 원작자·출처. 한 번의 query로 묶는다 */
async function fetchCommonsImages(files: string[]): Promise<Map<string, LadderMapImage>> {
  const raw = await queryPages(COMMONS_API, files.map(f => `File:${f}`), {
    prop: 'imageinfo|revisions',
    iiprop: 'url|size',
    rvprop: 'content',
    rvslots: 'main',
  })
  const result = new Map<string, LadderMapImage>()
  for (const file of files) {
    const page = raw.get(`File:${file}`)
    const info = page?.imageinfo?.[0]
    if (!info?.url || !isAllowedImageUrl(info.url)) continue
    const description = page?.revisions?.[0]?.slots.main.content ?? ''
    const fileInfo = extractTemplate(description, 'FileInfo')
    const p = fileInfo ? templateParams(fileInfo) : {}
    // 원출처가 안 적힌 파일(예: 투혼)도 어디서 가져왔는지는 남도록 리퀴피디아 파일 페이지를 출처로 둔다
    const filePage = `https://liquipedia.net/commons/${encodeURI(page!.title.replace(/ /g, '_'))}`
    result.set(file, {
      url: info.url,
      width: info.width ?? null,
      height: info.height ?? null,
      author: p.author ? cleanWiki(p.author) || null : null,
      source: (p.source && cleanWiki(p.source)) || filePage,
    })
  }
  return result
}

// ── 이미지 대리 다운로드 ────────────────────────────────────────
/**
 * 리퀴피디아 이미지 저장소 주소만 받는다. 아무 주소나 받아주면 이 함수가 남의 서버를
 * 대신 두드리는 통로(SSRF)가 되므로, URL로 파싱한 뒤(../ 같은 경로 조작이 정리된 상태)
 * 호스트와 경로 접두사를 확인한다.
 */
export function isAllowedImageUrl(raw: string): boolean {
  let u: URL
  try { u = new URL(raw) } catch { return false }
  return u.protocol === 'https:'
    && u.hostname === 'liquipedia.net'
    && !u.port
    && !u.username && !u.password
    && u.pathname.startsWith('/commons/images/')
}

export async function proxyImage(raw: string): Promise<Response> {
  if (!isAllowedImageUrl(raw)) return json({ error: '리퀴피디아 이미지 주소만 받을 수 있습니다.' }, 400)

  let res: Response
  try {
    res = await fetch(raw, { headers: { 'User-Agent': USER_AGENT } })
  } catch (e) {
    return json({ error: `이미지를 받지 못했습니다. (${e instanceof Error ? e.message : String(e)})` }, 502)
  }
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !type.startsWith('image/')) return json({ error: `이미지를 받지 못했습니다. (${res.status})` }, 502)
  if (Number(res.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) return json({ error: '이미지가 너무 큽니다.' }, 413)

  const bytes = await res.arrayBuffer()
  if (bytes.byteLength > MAX_IMAGE_BYTES) return json({ error: '이미지가 너무 큽니다.' }, 413)
  return new Response(bytes, {
    status: 200,
    headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600' },
  })
}

// ── 위키 문법 파싱 ──────────────────────────────────────────────
/**
 * 맵 풀 페이지에는 시즌마다 {{MapPoolTable ...}}이 최신순으로 쌓여 있다.
 * 맨 위 블록이 진행 중인 시즌이다.
 */
export function parsePoolTable(wikitext: string): { season: string; names: string[] } {
  const template = extractTemplate(wikitext, 'MapPoolTable')
  if (!template) throw new Error('맵 풀 표(MapPoolTable)를 찾지 못했습니다 — 페이지 형식이 바뀌었을 수 있습니다')

  const params = templateParams(template)
  const names = Object.entries(params)
    .map(([key, value]) => ({ n: Number(key.match(/^map(\d+)$/)?.[1]), value: cleanWiki(value) }))
    .filter(e => Number.isFinite(e.n) && e.value)
    .sort((a, b) => a.n - b.n)
    .map(e => e.value)

  if (names.length === 0) throw new Error('맵 풀 표에 맵이 없습니다')
  return { season: cleanWiki(params.title ?? '현재 시즌'), names }
}

export function toMapInfo(liquipediaName: string, content: string | null): LadderMapInfo {
  const infobox = content ? extractTemplate(content, 'Infobox map') : null
  const p = infobox ? templateParams(infobox) : {}
  const tilesetRaw = p.tileset ? cleanWiki(p.tileset) : null

  return {
    liquipedia_name: liquipediaName,
    name: (p.name && cleanWiki(p.name)) || liquipediaName,
    version: lastVersion(p.versions),
    width: firstInt(p.width),
    height: firstInt(p.height),
    player_count: firstInt(p.players),
    tileset: tilesetRaw ? toTilesetId(tilesetRaw) : null,
    tileset_raw: tilesetRaw,
    missing_page: !infobox,
    image: null,
  }
}

/** 정보 상자의 `image=Radeon.jpg` → `Radeon.jpg`. 공백·`File:` 접두사가 섞여 있어도 파일 이름만 */
export function infoboxImageFile(content: string): string | null {
  const infobox = extractTemplate(content, 'Infobox map')
  const raw = infobox ? templateParams(infobox).image : undefined
  const file = raw ? cleanWiki(raw).replace(/^(file|image):/i, '').trim() : ''
  return file || null
}

/** `{{이름 ...}}` 템플릿 하나를, 안에 중첩된 템플릿까지 고려해 통째로 잘라낸다 */
function extractTemplate(wikitext: string, name: string): string | null {
  const start = wikitext.search(new RegExp(`\\{\\{\\s*${name}\\b`, 'i'))
  if (start < 0) return null
  let depth = 0
  for (let i = start; i < wikitext.length - 1; i++) {
    if (wikitext[i] === '{' && wikitext[i + 1] === '{') { depth++; i++ }
    else if (wikitext[i] === '}' && wikitext[i + 1] === '}') {
      depth--
      i++
      if (depth === 0) return wikitext.slice(start, i + 1)
    }
  }
  return null
}

/**
 * 템플릿의 `|키=값`을 최상위 `|` 기준으로 나눈다. 링크(`[[a|b]]`)나 중첩 템플릿 안의 `|`는
 * 구분자가 아니므로 괄호 깊이를 세며 건너뛴다. 키는 소문자로 맞춘다.
 */
function templateParams(template: string): Record<string, string> {
  const body = template.slice(2, -2)
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const two = body.slice(i, i + 2)
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue }
    if ((two === '}}' || two === ']]') && depth > 0) { depth--; cur += two; i++; continue }
    if (body[i] === '|' && depth === 0) { parts.push(cur); cur = ''; continue }
    cur += body[i]
  }
  parts.push(cur)

  const params: Record<string, string> = {}
  for (const part of parts.slice(1)) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    params[part.slice(0, eq).trim().toLowerCase()] = part.slice(eq + 1).trim()
  }
  return params
}

function cleanWiki(value: string): string {
  return value
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
    .replace(/<ref[^>]*\/>/gi, '')
    .replace(/<br\s*\/?>/gi, ' / ')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, '$1')
    .replace(/'{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function firstInt(value: string | undefined): number | null {
  const m = value ? cleanWiki(value).match(/\d+/) : null
  return m ? Number(m[0]) : null
}

/** `1.0, 1.1, 1.2`처럼 버전 이력이 나열돼 있으면 마지막(최신) 것을 쓴다 */
function lastVersion(value: string | undefined): string | null {
  const all = value ? cleanWiki(value).match(/\d+(?:\.\d+)*/g) : null
  return all?.length ? all[all.length - 1] : null
}

// 리퀴피디아는 맵마다 정식 명칭(Ice World)과 줄임말(Ice)을 섞어 쓴다
const TILESET_IDS: Record<string, string> = {
  badlands: 'badlands',
  spaceplatform: 'space',
  space: 'space',
  installation: 'install',
  install: 'install',
  ashworld: 'ashworld',
  ash: 'ashworld',
  jungleworld: 'jungle',
  jungle: 'jungle',
  desertworld: 'desert',
  desert: 'desert',
  iceworld: 'ice',
  ice: 'ice',
  twilightworld: 'twilight',
  twilight: 'twilight',
}

function toTilesetId(raw: string): string | null {
  return TILESET_IDS[raw.toLowerCase().replace(/[^a-z]/g, '')] ?? null
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
