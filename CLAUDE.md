# 바닥티어 (badak-web) — Claude 작업 지침

## 프로젝트 개요
스타크래프트1 리마스터 어드민 웹앱. Discord OAuth로 로그인한 관리자만 사용 가능.

## 기술 스택
- Vue 3 (Composition API, script setup)
- Vite + TypeScript
- SCSS (컴포넌트 스타일은 `.scss` 파일로 분리)
- Supabase (Auth, Storage, DB)
- Pinia (auth store)
- Vue Router

## Supabase 환경
DB 변경은 **Supabase MCP를 통해 직접 적용**한다. schema.sql 같은 별도 파일은 관리하지 않는다.

| 환경 | Project ID |
|------|-----------|
| dev  | `wtzfekruohdxchjpefdj` |
| prod | `vydawdpzfpmwqmvymwsi` |

- env 파일: `.env.development` / `.env.production`
- DDL 변경은 `apply_migration`, 데이터 조회/수정은 `execute_sql` 사용
- dev → prod 순서로 양쪽 모두 적용

## 인증 / RLS
- Discord OAuth → Supabase 세션 발급
- RLS 조건: `auth.uid() IS NOT NULL` (deprecated `auth.role()` 사용 금지)

## 코드 컨벤션
- 컴포넌트 스타일은 `<style lang="scss" scoped>@use './ComponentName.scss';</style>` 형태로 외부 분리
- 공통 헤더: `AppHeader.vue` — `#actions` slot으로 페이지별 버튼 주입
- DB 관련 함수는 `src/lib/` 하위에 기능별로 모아둠
  - `src/lib/maps.ts` — 맵 CRUD
  - `src/lib/players.ts` — 선수 CRUD
  - `src/lib/leagues.ts` — 리그 CRUD, 상태 계산
  - `src/lib/leagueDetail.ts` — 팀장, 시드권자, 맵 배정 CRUD
  - `src/lib/draft.ts` — 지목식 픽, 시드권 교체 로그 CRUD
  - `src/lib/schedules.ts` — 경기 일정 CRUD
  - `src/lib/entries.ts` — 엔트리 제출 CRUD, 티어 포인트 상수, 최종 로스터 계산

## 주요 라우트
| path | name | 설명 |
|------|------|------|
| `/` | home | 맵 목록 |
| `/login` | login | Discord 로그인 |
| `/maps/register` | map-register | 맵 등록 |
| `/maps/:id/edit` | map-edit | 맵 수정 |
| `/players` | players | 선수 관리 (닉네임, 종족, 티어) |
| `/leagues` | leagues | 정규리그 목록/관리 |
| `/leagues/:id` | league-detail | 리그 상세 데이터 입력 (팀장, 시드권자, 맵 배정) |
| `/leagues/:id/draft` | league-draft | 팀원 지목식 진행 |
| `/auth/callback` | auth-callback | OAuth 콜백 |

## 주요 DB 테이블
| 테이블 | 설명 |
|--------|------|
| `leagues` | 리그 기본 정보. `draft_completed` 컬럼으로 지목식 완료 여부 관리 |
| `players` | 선수 목록 (닉네임, 종족, 티어) |
| `league_captains` | 리그별 팀장 및 순번 |
| `league_seed_holders` | 리그별 시드권자 및 순번 |
| `league_match_maps` | 경기별 맵 배정 |
| `league_draft_picks` | 팀원 지목식 결과 (팀장별 픽 순서) |
| `league_swap_log` | 시드권 교체 기록 (시드권자, 교체된 양쪽 선수) |
| `league_schedules` | 경기 일정 (라운드, 날짜, 팀A/팀B 팀장 ID, 승자) |
| `league_match_entries` | 팀장별 엔트리 제출 (경기별 출전 선수 배정) |

## 리그 상세 데이터 입력 탭 구성
`LeagueDetailView.vue` 의 탭 순서: **설명 → 팀장 선출 → 시드권자 → 맵 배정**
- **시드권자 탭**: 선수 선택 + 순번 조정만 가능 (룰 적용은 지목식 화면에서)

## 팀원 지목식 (DraftView) 동작
1. **지목식 모드**: 스네이크 드래프트 방식으로 선수 풀에서 팀에 드래그 앤 드롭
2. **시드권 교체 모드**: 모든 픽이 끝난 후 "시드권 교체" 버튼으로 진입
   - 1번 시드권자가 적용 순서를 결정하는 모달 표시
   - **시드권 행사 순서**: 시드권 보유 팀의 멤버를 먼저 선택 → 상대 팀 멤버 선택 → 교체
   - 교체 완료 후 우측 로그 패널에 기록 표시
3. **저장 시 완전 종료**: 저장하면 `draft_completed = true` 설정 → 이후 재진입해도 읽기 전용
   - 리그 목록 뱃지가 "지목식 완료"로 변경

### 시드권 규칙
- 시드권을 행사하는 팀의 멤버를 **먼저** 선택해야 함
- 시드권 보유자 본인은 교체 불가
- 각 팀의 1번 픽(첫 번째로 뽑은 멤버)은 교체 불가
- 두 티어 이상 차이나는 멤버는 교체 불가
- 세 픽 이상 차이나는 멤버는 교체 불가 (예: 상대 3번 픽을 가져오려면 우리 4번 픽 이상을 내보내야 함)
- 교체된 멤버는 이후 추가 이동 불가 (잠금)

## 바닥리그 정규리그 룰
- 썸머리그 / 윈터리그
- 4명의 팀장 선발 후 팀원 지목식 진행
- 팀장 순번: 티어가 낮을수록, 승률이 낮을수록 앞 순번 (우선 선택권)
- 스네이크 드래프트: 1→2→3→4→4→3→2→1→1→… 반복

### 맵 가이드라인
| 경기 | 맵 수 | 비고 |
|------|-------|------|
| 1경기 | 1개 고정 | |
| 2경기 | 2~3개 중 택1 | 양팀 각 1개 밴, 낮은 티어 팀의 밴 적용, 동티어 다른 밴 → 사다리타기 |
| 3경기 | 2~3개 중 택1 | 2경기 룰과 동일 |
| 4경기 | 1개 고정 | |
| 5경기 | 1개 고정 | |
| 6경기 | 1개 고정 | |
| 7경기 | — | 에이스 결정전 |

## 엔트리 제출 룰
상위티어만 출전하는 것을 방지하기 위해 티어마다 포인트를 부여한다.

### 티어별 포인트
| 티어 | 포인트 |
|------|--------|
| A    | 5      |
| B    | 4      |
| C    | 3      |
| D    | 2      |
| E    | 1      |

### 경기 구성 및 포인트 한도
| 경기 | 유형 | 출전 인원 | 비고 |
|------|------|---------|------|
| 1, 2, 3, 5, 6경기 | 개인전 | 1명 | 합산 최대 16포인트 |
| 4경기 | 팀전 | 2명 | 합산 최대 7포인트 |
| 7경기 | 에이스 결정전 | — | 엔트리 미포함 |

- 개인전 + 팀전 합산 최대 23포인트
- 엔트리 제출은 **리그참여(사용자 메뉴)** 에서 팀장이 직접 제출