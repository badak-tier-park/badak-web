# 바닥티어 (badak-web) — Claude 작업 지침

스타크래프트1 리마스터 커뮤니티 웹앱. Vue 3(script setup) + Vite + TS + Supabase + Pinia, PWA.
**이 문서에는 코드에서 확인할 수 없는 내용만 적는다.** 파일 목록·라우트·스키마는 직접 읽을 것.

## 문서 지도
이 파일은 매 세션 로드된다. 기능별 상세는 하위 CLAUDE.md에 있고, **그 디렉토리 파일을 열 때만
자동 로드된다.** `src/lib/`·`src/composables/`에서 해당 기능을 건드릴 때는 아래 문서를 직접 읽을 것.

| 작업 | 문서 |
|------|------|
| 화면·스타일·반응형·모달·헤더 | `src/styles/CLAUDE.md` |
| 리그(지목식·엔트리·승패·순위·핸디) | `src/views/leagues/CLAUDE.md` |
| 맵(삭제 금지·별칭·래더 동기화·이미지 라이선스) | `src/views/maps/CLAUDE.md` |

## 작업 완료 기준
**"적용됐다"와 "동작한다"는 다르다.** 마이그레이션이 `success`를 반환하거나 코드가 컴파일되는 것은
완료 근거가 아니다. 의도한 동작이 실제로 일어나는지 확인한 뒤에 완료라고 말한다.

- 특히 **권한·인증·검증 로직은 실패가 조용하다.** 조건이 항상 거짓이어도 에러 없이 통과하므로,
  반드시 막혀야 할 시도가 실제로 막히는지 실행해서 확인한다
- RLS·정책 변경은 `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)`로
  사용자 컨텍스트를 흉내 낸 뒤 마지막에 `RAISE EXCEPTION`으로 롤백시키는 `DO` 블록으로 검증한다
  (데이터를 건드리지 않고 확인 가능)
- 화면은 로그인 없이는 볼 수 없다. 배치만 확인할 때는 `@/stores/auth`를 가짜 로그인 상태로
  바꿔 끼운 임시 vite 설정으로 띄워 headless Chrome으로 찍는다(데이터는 비어 보인다).
  임시 설정 파일은 커밋하지 않는다
- 확인하지 못했으면 "확인하지 못했다"고 말한다. 추측을 완료로 보고하지 않는다

## 문서 유지 규칙
대화 중 **코드에서 유추할 수 없는 새 정보**(도메인 룰, 운영 정책, 왜 그렇게 했는지)가 나오면
그 작업에서 끝내지 말고 CLAUDE.md에 반영한다.

- 특정 기능 안에서만 쓰이면 해당 디렉토리의 CLAUDE.md에, 전역이면 이 파일에 적는다
  (하위 문서가 없으면 새로 만들고 위 **문서 지도**에 한 줄 추가한다)
- 하위 문서에 적더라도, 놓치면 버그가 되는 제약은 이 파일에 한 줄 요약을 남긴다
  — 하위 CLAUDE.md는 그 디렉토리에서 작업할 때만 로드되기 때문
- 이 파일은 매 세션 통째로 읽힌다. 한 기능에서만 필요한 상세는 하위 문서로 내려 길이를 지킨다
- 코드·스키마·git 이력에서 확인 가능한 것은 적지 않는다. 기존 서술이 실제와 달라졌으면 고친다
- 공개 저장소다. 자격증명·project ID·취약점 등 민감한 내용은 문서에 적지 않는다

## 권한 구조
- Discord OAuth 로그인 → `isRegistered`(등록 사용자) / `isAdmin`(관리자) 두 축
- 라우터(`src/router/index.ts`)에서 `meta.requiresAuth` / `meta.requiresAdmin`으로 적용
- 맵·선수·리그 운영·시즌·이벤트는 관리자 전용. 홈, 대시보드, 리그참여, 팀배틀, 토너먼트,
  명예의전당, 팀장 지목식은 일반 사용자도 사용
- 등록 여부 조회(`users`)가 **실패하면 미등록으로 판정하지 않는다** — 마지막으로 확인한 값을 쓴다.
  예전엔 불안정한 모바일 망에서 '접근 불가'로 튕겨 로그아웃된 것처럼 보였다(`src/stores/auth.ts`)

## PWA · 로그인 유지
- 홈 화면에 설치되는 PWA다(`vite.config.ts`의 VitePWA). 새 배포는 **자동 새로고침하지 않고**
  안내만 띄운다 — 지목식·엔트리 입력 중 새로고침되면 입력이 날아간다
- 서비스워커는 앱 껍데기만 캐시한다. **Supabase 응답을 캐시하지 않는다**(오래된 리그 데이터로
  판정이 틀어진다). `api/`는 SPA 폴백에서 제외해야 한다
- 로그인 유지는 Supabase 세션(localStorage의 리프레시 토큰)이 한다. `flowType`은 implicit 유지 —
  PKCE는 로그인을 시작한 저장소에서만 코드를 교환할 수 있어 iOS 홈 화면 앱에서 실패할 수 있다
- 디스코드 로그인은 `prompt=none` — 이미 승인한 사용자는 동의 화면 없이 돌아온다
- 휴대폰 첫 방문 시 설치 안내(`PwaInstallPrompt.vue`): Android는 `beforeinstallprompt`로 설치 버튼,
  **iOS는 설치 API가 없어** 공유 → 홈 화면에 추가 안내, 카카오톡 등 앱 내 브라우저는 외부 브라우저로
  열라고 안내한다. "나중에"는 14일간 다시 띄우지 않는다(매번 뜨면 그냥 닫는 버튼이 된다)
- **홈 화면 앱에는 브라우저 뒤로가기가 없다.** 화면 이동 버튼에 `router.back()`을 쓰지 말고
  상위 화면으로 직접 이동한다

## Supabase
- DB 변경은 **Supabase MCP로 직접 적용**한다. schema.sql 같은 파일은 두지 않는다
- DDL은 `apply_migration`, 조회/수정은 `execute_sql`. **dev → prod 순서로 양쪽 모두** 반영
- 프로젝트는 이름으로 지칭한다: dev=`badak-dev`, prod=`badak`.
  **공개 저장소이므로 project ID는 문서에 쓰지 말고** `list_projects`로 조회해 쓴다
- 로컬 env는 `.env` 하나(dev를 바라봄). 키 목록은 `.env.example` 참고
- Vercel: `main`→Production(prod DB), 그 외 브랜치→Preview(dev DB)
- `api/`는 Vercel 서버리스 함수다. Vite 개발 서버(`npm run dev`)에는 없으므로 Vercel 프리뷰에서
  확인한다. 함수도 웹과 같은 `VITE_SUPABASE_*` 환경변수를 런타임에 읽는다

### RLS 규칙
- 인증 확인은 `auth.uid()` 기반 (deprecated `auth.role()` 금지)
- **라우터 가드는 DB를 막지 못한다.** 관리자 전용 테이블의 쓰기는 정책에서 관리자를 직접 확인한다:
  `FOR SELECT USING (auth.uid() IS NOT NULL)` + `FOR ALL USING/WITH CHECK (public.current_user_is_admin())`
- `current_user_is_admin()`은 `SECURITY DEFINER`다. 정책 안에서 `users`를 직접 서브쿼리하면
  재귀가 나므로 반드시 이 함수를 쓴다
- 권한 필드는 사용자가 스스로 바꿀 수 없어야 한다 (`users.is_admin`은 트리거로 보호 중)
- 새 테이블은 RLS 활성화 + 정책을 같이 만든다. 정책 없이 RLS만 켜면 전면 차단, 끄면 전면 노출

## 화면(UI) 공통 — 상세는 `src/styles/CLAUDE.md`
놓치면 화면 간 통일성이 깨지는 것만:

- 색은 테마 토큰(`--c-*`)만 쓴다. `#c084fc`·`rgba(170, 59, 255, …)` 같은 값을 직접 쓰면
  라이트 테마에서 그 부분만 다크 색으로 남는다 — 투명도 변형은 `rgba(var(--c-brand-rgb), a)`
- 본문 폭·여백은 `--page-w-narrow / --page-w / --page-w-wide`, `--page-*` 토큰만 쓴다
- 휴대폰 기준은 640px. 모달은 공통 `_modal.scss`(휴대폰에서 하단 시트), 표는 `.table-scroll`

## 코드 컨벤션
- 스타일은 외부 분리: `<style lang="scss" scoped>@use './ComponentName.scss';</style>`
- 공통 헤더 `AppHeader.vue` — `#actions` slot으로 페이지별 버튼 주입
- DB 접근 함수는 `src/lib/` 하위에 기능별로 모은다
- 테이블명 주의: 선수 목록은 `players`가 아니라 **`users`** (코드상 `src/lib/players.ts`가 담당)

## 티어 체계
10단계 (2026 윈터리그부터 S 추가). 정의는 `src/lib/constants.ts`의 `TIER_POINTS` **한 곳뿐**이며,
비교·정렬은 `tierPoint()`, CSS 클래스는 `tierClass()`(전역 `$tierClass`)를 쓴다.
티어별 스타일은 `_tokens.scss` 외에 화면별 scss에도 있으니 티어를 추가할 땐 `--tier-e`로 검색해 전부 맞춘다.

| 티어 | S | A+ | A- | B+ | B- | C+ | C- | D+ | D- | E |
|------|---|----|----|----|----|----|----|----|----|---|
| 포인트 | 5 | 4.5 | 4 | 3.5 | 3 | 2.5 | 2 | 1.5 | 1 | 0.5 |

- **구 5단계 별칭(A5/B4/C3/D2)은 지우지 않는다.** 지난 시즌 스냅샷에 그 이름으로 남아 있어
  당시 점수를 보여주는 데 쓰인다. 지우면 지난 시즌 선수가 0점이 된다
- E만 신·구 이름이 겹쳐 지난 시즌 E는 0.5점으로 보인다 — 운영진 합의로 감수
- 선수는 **닉네임 · 종족 · 티어 · (핸디)** 순서, 닉네임에 티어색을 칠하지 않는다
  (`RaceBadge` / `TierBadge` / `HpBadge`. 배경은 `src/styles/CLAUDE.md`)

## 맵 작업 시 주의 — 상세는 `src/views/maps/CLAUDE.md`
- **맵은 삭제하지 않는다.** 리그·팀배틀·토너먼트가 FK로 참조한다. 래더에서 빠지면 `is_ladder`만 끈다
- **맵 이름을 바꿀 땐 옛 이름을 별칭에 남긴다.** 전적(`games`)은 맵 이름 텍스트로 매칭되므로
  옛 이름이 사라지면 지난 전적이 그 맵에서 떨어져 나간다

## 리그 작업 시 주의 — 상세는 `src/views/leagues/CLAUDE.md`
- **엔트리 포인트 한도는 상수가 아니다.** `leagues.entry_solo_max` / `entry_team_max` /
  `entry_total_max` / `entry_team_min`(팀전 최소, null=제한 없음) 리그별 설정값이며
  관리자가 리그마다 입력한다 — 하드코딩 금지. 0.5 단위라 컬럼은 `numeric(4,1)`
- **팀장 수도 설정값**이다 (`leagues.captain_count`, 기본 4) — 4로 하드코딩 금지
- **리그 진행 중 선수 정보는 `users`가 아니라 `league_player_snapshots`를 우선 참조**한다.
  지목식 최종 저장 시점의 티어/종족/군인여부가 박제되며, 이후 티어가 재산정돼도
  그 리그의 판정이 흔들리지 않아야 하기 때문
- 티어 비교는 반드시 `tierPoint()` (문자열 대소 비교 금지)
- 지목은 드래그든 탭이든 `useDraftDnD`의 `assignToTeam()` 한 경로로만 넣는다

## Git
- `feat/`, `fix/`, `refactor/`, `style/`, `docs/`, `chore/` 접두사로 작은 단위 브랜치 → `dev` 병합
- 브랜치는 일회용. 병합된 브랜치는 로컬/원격 모두 즉시 삭제 (재사용 금지, 원격은 자동 삭제 설정됨)
- **기본 브랜치는 `dev`**다. `Closes #n`은 기본 브랜치에 병합될 때만 이슈를 닫기 때문 —
  기본이 `main`이던 때는 PR이 이슈를 하나도 닫지 못했다. Vercel 운영 배포는 여전히 `main`
- 보호 규칙(ruleset): `dev`·`main` 모두 승인 1명, **푸시하면 기존 승인 무효**, **리뷰 코멘트를
  해결해야 병합**. `main` 규칙의 대상은 `refs/heads/main`으로 고정돼 있다(`~DEFAULT_BRANCH`로 두면
  기본 브랜치를 바꿀 때 main 보호가 풀린다)

### 이슈
- 템플릿을 쓰고 종류 라벨 + 영역 라벨(`area:*`) + 필요하면 `priority:*`를 붙인다
- 큰 작업은 하위 이슈(sub-issue)로 나눈다. 상위 이슈는 **하위가 모두 닫힌 뒤에** 닫는다
  (`gh api repos/{owner}/{repo}/issues/{n}/sub_issues`)
- 해결 근거를 코드·커밋에서 확인하지 못한 이슈는 닫지 말고 묻는다. 하지 않기로 한 이슈는
  "not planned"로 닫는다(완료 통계가 흐려지지 않게)

### 커밋 메시지
**무엇을 바꿨는지는 diff에 있다. 커밋 메시지에는 "왜"를 쓴다.**
어떤 문제·요구 때문에 바꿨는지, 다른 방법을 버렸다면 그 이유가 무엇인지를 남긴다.
AI가 작성하는 커밋일수록 이 맥락이 유실되기 쉬우므로 의식적으로 적는다.

- 한 커밋은 한 가지 목적만 담는다. 리팩터링·버그픽스·기능추가를 섞지 않는다
  (AI 작업은 한 번에 많은 양이 나오므로 의식적으로 잘라야 한다)
- 함정을 피해 간 구현이라면 그 함정을 한 줄 남긴다 — 같은 곳을 다시 건드릴 때를 위해
- 제목은 간결하게, 배경 설명은 본문에

### 커밋 전 검증
lint·test 스크립트는 없다. **`npm run build`(vue-tsc 타입 검사 + 빌드)가 통과해야 커밋한다.**
PR에서는 CI(`.github/workflows/ci.yml`)가 같은 명령을 돌린다.

### PR 생성
조직 공통 PR 템플릿을 따른다. 템플릿은 이 저장소가 아니라 **`badak-tier-park/.github`** 에 있고,
`gh pr create --body`로 만들면 **자동 적용되지 않으므로** 직접 구조를 맞춰야 한다.

PR을 만들기 전에 현재 템플릿을 가져와 그 섹션 구성을 그대로 쓴다:
```
gh api repos/badak-tier-park/.github/contents/.github/PULL_REQUEST_TEMPLATE.md --jq '.content' | base64 -d
```

- **제목은 커밋과 같은 형식**(`feat: …`). 브랜치 이름("Feat/handicap")을 그대로 두지 않는다 —
  병합 커밋 메시지가 되어 이력에 남는다
- 본문 '관련 이슈'에 `Closes #n`을 쓴다. 이슈가 없는 작업이면 "없음"
- 작업 중인 PR은 Draft로 연다. 앞 PR에 의존하는 PR은 앞 브랜치를 base로 쌓고 병합 순서를 본문에 적는다
  (앞 PR이 병합돼 브랜치가 지워지면 GitHub이 다음 PR의 base를 자동으로 dev로 바꾼다)
- 체크박스는 실제로 해당하는 항목만 채운다. 하지 않은 테스트를 체크하지 않는다
- PR 타입에 맞는 항목이 없으면(예: 문서 작업) 가장 가까운 것을 고르고 작업 내용에 명시한다
- **DB 변경은 코드 diff에 나타나지 않는다.** Supabase MCP로 적용한 스키마·정책 변경이 있으면
  템플릿의 DB 변경 칸에 dev·prod 적용 여부와 함께 반드시 적는다 — PR만 봐서는 알 수 없기 때문
- 배포 PR(`dev` → `main`)은 제목 `release: YYYY-MM-DD 요약`. 병합 후 `vYYYY.MM.DD` 태그로
  GitHub Release를 만든다(노트는 자동 생성) — 언제 무엇이 운영에 나갔는지 추적하기 위해

### 리뷰
- 승인은 "확인 버튼"이 아니다. 리뷰어는 최소한 ① 본문의 리뷰 포인트 ② Vercel 프리뷰 직접 열기
  (UI 변경은 휴대폰으로) ③ 권한·판정 로직(`auth`, `entries.ts`, RLS)은 라인 단위로 읽기
- 질문·제안은 라인 코멘트로 남긴다. 해결되지 않은 코멘트가 있으면 병합되지 않는다
- 리뷰어는 CODEOWNERS로 자동 지정된다. AI가 쓴 PR은 양이 많아 더 꼼꼼히 — 작성자가 먼저 스스로
  읽고, 확인하지 못한 것을 본문에 적는다

---

## 전역 개발 규칙 (사용자 전역 CLAUDE.md 복사본)
`~/.claude/CLAUDE.md`는 특정 PC에만 있어 다른 기기에서는 보이지 않으므로 여기에 복사해 둔다.
프로젝트에 국한되지 않는 새 규칙이 생기면 여기와 전역 파일 **양쪽에** 반영한다.
위 프로젝트 규칙과 겹치면 위(프로젝트) 서술이 우선한다.

### 커밋 컨벤션
**Conventional Commits**: `<type>(<scope>): <subject>` — scope는 선택.
- type: `feat` · `fix` · `docs` · `test` · `refactor` · `chore` · `style` · `perf`
- subject는 명령형 한 줄, 끝에 마침표 없음
- 본문은 "무엇"이 아니라 **"왜"**를 설명할 때만 쓴다

### 커밋 전 검증
typecheck·lint·test가 통과하는 상태에서 커밋한다. 명령은 프로젝트마다 다르니
CLAUDE.md·package.json scripts·CI에서 확인한다(이 프로젝트는 `npm run build`).

### 이슈 정리
이슈를 닫기 전에 하위 이슈(sub-issue) 상태를 확인한다. 하위가 하나라도 열려 있으면
상위는 닫지 않는다. 해결 근거를 코드·커밋에서 확인하지 못한 이슈는 닫지 말고 사용자에게 묻는다.

### 문서 계층
- 루트 CLAUDE.md는 매 세션 로드되므로 전역 규칙과 "놓치면 버그가 되는" 요약만 둔다
- 기능별 상세는 그 디렉토리의 CLAUDE.md에 두고, 루트의 **문서 지도**에 위치를 적는다
- 하위 문서는 그 디렉토리 파일을 열 때만 로드된다 — 다른 디렉토리(lib 등)에서 그 기능을
  건드릴 땐 직접 읽어야 하므로, 루트에 요약과 경로를 남긴다
