# 바닥티어 (badak-web) — Claude 작업 지침

스타크래프트1 리마스터 커뮤니티 웹앱. Vue 3(script setup) + Vite + TS + Supabase + Pinia.
**이 문서에는 코드에서 확인할 수 없는 내용만 적는다.** 파일 목록·라우트·스키마는 직접 읽을 것.

## 작업 완료 기준
**"적용됐다"와 "동작한다"는 다르다.** 마이그레이션이 `success`를 반환하거나 코드가 컴파일되는 것은
완료 근거가 아니다. 의도한 동작이 실제로 일어나는지 확인한 뒤에 완료라고 말한다.

- 특히 **권한·인증·검증 로직은 실패가 조용하다.** 조건이 항상 거짓이어도 에러 없이 통과하므로,
  반드시 막혀야 할 시도가 실제로 막히는지 실행해서 확인한다
- RLS·정책 변경은 `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claims', ...)`로
  사용자 컨텍스트를 흉내 낸 뒤 마지막에 `RAISE EXCEPTION`으로 롤백시키는 `DO` 블록으로 검증한다
  (데이터를 건드리지 않고 확인 가능)
- 확인하지 못했으면 "확인하지 못했다"고 말한다. 추측을 완료로 보고하지 않는다

## 문서 유지 규칙
대화 중 **코드에서 유추할 수 없는 새 정보**(도메인 룰, 운영 정책, 왜 그렇게 했는지)가 나오면
그 작업에서 끝내지 말고 CLAUDE.md에 반영한다.

- 특정 기능 안에서만 쓰이면 해당 디렉토리의 CLAUDE.md에, 전역이면 루트에 적는다
  (하위 문서가 없으면 새로 만든다. 예: `src/views/leagues/CLAUDE.md`)
- 하위 문서에 적더라도, 놓치면 버그가 되는 제약은 루트에 한 줄 요약을 남긴다
  — 하위 CLAUDE.md는 그 디렉토리에서 작업할 때만 로드되기 때문
- 코드·스키마·git 이력에서 확인 가능한 것은 적지 않는다. 기존 서술이 실제와 달라졌으면 고친다
- 공개 저장소다. 자격증명·project ID·취약점 등 민감한 내용은 문서에 적지 않는다

## 권한 구조
- Discord OAuth 로그인 → `isRegistered`(등록 사용자) / `isAdmin`(관리자) 두 축
- 라우터(`src/router/index.ts`)에서 `meta.requiresAuth` / `meta.requiresAdmin`으로 적용
- 맵·선수·리그 운영·시즌·이벤트는 관리자 전용. 홈, 대시보드, 리그참여, 팀배틀, 토너먼트,
  명예의전당, 팀장 지목식은 일반 사용자도 사용

## Supabase
- DB 변경은 **Supabase MCP로 직접 적용**한다. schema.sql 같은 파일은 두지 않는다
- DDL은 `apply_migration`, 조회/수정은 `execute_sql`. **dev → prod 순서로 양쪽 모두** 반영
- 프로젝트는 이름으로 지칭한다: dev=`badak-dev`, prod=`badak`.
  **공개 저장소이므로 project ID는 문서에 쓰지 말고** `list_projects`로 조회해 쓴다
- 로컬 env는 `.env` 하나(dev를 바라봄). 키 목록은 `.env.example` 참고
- Vercel: `main`→Production(prod DB), 그 외 브랜치→Preview(dev DB)

### RLS 규칙
- 인증 확인은 `auth.uid()` 기반 (deprecated `auth.role()` 금지)
- **라우터 가드는 DB를 막지 못한다.** 관리자 전용 테이블의 쓰기는 정책에서 관리자를 직접 확인한다:
  `FOR SELECT USING (auth.uid() IS NOT NULL)` + `FOR ALL USING/WITH CHECK (public.current_user_is_admin())`
- `current_user_is_admin()`은 `SECURITY DEFINER`다. 정책 안에서 `users`를 직접 서브쿼리하면
  재귀가 나므로 반드시 이 함수를 쓴다
- 권한 필드는 사용자가 스스로 바꿀 수 없어야 한다 (`users.is_admin`은 트리거로 보호 중)
- 새 테이블은 RLS 활성화 + 정책을 같이 만든다. 정책 없이 RLS만 켜면 전면 차단, 끄면 전면 노출

## Git
- `feat/`, `fix/`, `refactor/`, `style/` 접두사로 작은 단위 브랜치 → `dev` 병합
- 브랜치는 일회용. 병합된 브랜치는 로컬/원격 모두 즉시 삭제 (재사용 금지)

### 커밋 메시지
**무엇을 바꿨는지는 diff에 있다. 커밋 메시지에는 "왜"를 쓴다.**
어떤 문제·요구 때문에 바꿨는지, 다른 방법을 버렸다면 그 이유가 무엇인지를 남긴다.
AI가 작성하는 커밋일수록 이 맥락이 유실되기 쉬우므로 의식적으로 적는다.

- 한 커밋은 한 가지 목적만 담는다. 리팩터링·버그픽스·기능추가를 섞지 않는다
  (AI 작업은 한 번에 많은 양이 나오므로 의식적으로 잘라야 한다)
- 함정을 피해 간 구현이라면 그 함정을 한 줄 남긴다 — 같은 곳을 다시 건드릴 때를 위해
- 제목은 간결하게, 배경 설명은 본문에

## 코드 컨벤션
- 스타일은 외부 분리: `<style lang="scss" scoped>@use './ComponentName.scss';</style>`
- 공통 헤더 `AppHeader.vue` — `#actions` slot으로 페이지별 버튼 주입
- DB 접근 함수는 `src/lib/` 하위에 기능별로 모은다
- 테이블명 주의: 선수 목록은 `players`가 아니라 **`users`** (코드상 `src/lib/players.ts`가 담당)

## 티어 체계
9단계. 정의는 `src/lib/constants.ts`의 `TIER_POINTS` **한 곳뿐**이며,
비교·정렬은 `tierPoint()`, CSS 클래스는 `tierClass()`(전역 `$tierClass`)를 쓴다.

| 티어 | A+ | A- | B+ | B- | C+ | C- | D+ | D- | E |
|------|----|----|----|----|----|----|----|----|---|
| 포인트 | 5 | 4.5 | 4 | 3.5 | 3 | 2.5 | 2 | 1.5 | 1 |

구 5단계(A/B/C/D)는 동일 점수의 레거시 별칭. DB 마이그레이션 완료 후 제거 가능.

## 리그 작업 시 주의
정규리그 룰(맵 가이드라인, 지목식, 시드권, 엔트리) 상세는 **`src/views/leagues/CLAUDE.md`** 에 있다.
`src/lib/`에서 리그 관련 로직을 건드릴 때는 그 파일이 자동 로드되지 않으니 직접 읽을 것.
아래는 놓치면 버그가 되는 항목만 추린 것:

- **엔트리 포인트 한도는 상수가 아니다.** `leagues.entry_solo_max` / `entry_team_max` /
  `entry_total_max` 리그별 설정값이며 16/7/23은 기본값일 뿐 — 하드코딩 금지
- **팀장 수도 설정값**이다 (`leagues.captain_count`, 기본 4) — 4로 하드코딩 금지
- **리그 진행 중 선수 정보는 `users`가 아니라 `league_player_snapshots`를 우선 참조**한다.
  지목식 최종 저장 시점의 티어/종족/군인여부가 박제되며, 이후 티어가 재산정돼도
  그 리그의 판정이 흔들리지 않아야 하기 때문
- 티어 비교는 반드시 `tierPoint()` (문자열 대소 비교 금지)
