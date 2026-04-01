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
