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
- DB 관련 함수는 `src/lib/maps.ts` 등 `src/lib/` 하위에 모아둠

## 주요 라우트
| path | name | 설명 |
|------|------|------|
| `/` | home | 맵 목록 |
| `/login` | login | Discord 로그인 |
| `/maps/register` | map-register | 맵 등록 |
| `/maps/:id/edit` | map-edit | 맵 수정 |
| `/auth/callback` | auth-callback | OAuth 콜백 |

## 바닥리그
- 정규리그
  - 썸머리그/윈터리그
  - 정규 리그는 4명의 팀장을 먼저 선발
  - 개막 전 팀원 지목식 시행
    - 4명의 팀장이 순서대로 한 명씩 자신의 팀원으로 데려오는 방식
    - 이 순서는 스네이크 방식을 따름
      - 1번 팀장 -> 2번 팀장 -> 3번 팀장 -> 4번 팀장 -> 4번 팀장 -> 3번 팀장 -> 2번 팀장 -> 1번 팀장 
    - 팀장 중 티어가 낮을수록 승률이 낮을 수록 앞 순번으로 배치하여 우선 선택권 획득
    - 팀원 지목식에는 시드권 이라는 룰이 존재
      - 시드권이란 시드권을 가진 사람이 상대방 팀원과 우리 팀원의 인원을 교체할 수 있는 권한
      - 각 팀장이 첫 번째로 뽑은 팀원은 시드권 적용이 불가
      - 두 티어 이상 차이나는 멤버는 시드권 적용이 불가
      - 세 픽 이상 차이날 경우 시드권 적용 불가 
        - 첫 번째 뽑은 사람을 1번 픽 두 번째 뽑은 사람을 2번 픽이라 칭함
        - 상대 팀의 3번 픽을 데려오고 싶으면 적어도 우리 팀의 4번픽 혹은 5번픽 이상의 멤버를 보내야 함을 의미
      - 시드권 적용할 수 있는 순서가 존재함 
        - 전 시즌 리그에서 1번 시드권을 획득한 멤버가 시드권자의 시드권 적용 순서를 정함
      - 시드권 적용되어 교체된 멤버는 더 이상 팀 이동이 불가
      - 시드권을 가지고 있는 멤버를 시드권 적용 하는 것은 불가
    - 정규리그는 맵의 가이드 라인이 존재
      - 1경기 맵 1개 고정
      - 2경기 2개 맵 혹은 3개 맵 중 택1
        - 양팀이 맵을 1개씩 밴
        - 낮은 티어의 맵 밴이 적용
        - 낮은 티어의 멤버의 밴이 적용됨에도 두 팀 모두 밴을 하는 이유는 경기 당일까지 엔트리가 공개되지 않기 때문 
        - 서로의 티어가 같고 서로 다른 맵을 밴 했을 시 사다리타기로 맵 선택
      - 3경기 2개 맵 혹은 3개 맵 중 택1
        - 2경기 룰과 동일
      - 4경기 맵 1개 고정
      - 5경기 맵 1개 고정
      - 6경기 맵 1개 고정
      - 7경기(에이스 결정전)