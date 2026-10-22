# 바닥티어 (badak-web)

스타크래프트1 리마스터 커뮤니티 **바닥티어**의 웹앱입니다. 정규리그(팀장 지목식·엔트리·경기 결과·순위),
팀배틀, 개인 토너먼트, 선수 전적 대시보드, 맵 관리를 제공합니다. 휴대폰 홈 화면에 설치해 쓸 수 있습니다(PWA).

## 기술 스택
Vue 3 (`<script setup>`) · TypeScript · Vite · Pinia · Supabase(DB·인증·Realtime) · Vercel(배포·서버리스 `api/`)

## 시작하기
```bash
npm install
cp .env.example .env   # 값은 운영진에게 받는다 (dev 프로젝트를 바라본다)
npm run dev
```

| 명령 | 내용 |
|------|------|
| `npm run dev` | 개발 서버. `api/`(Vercel 함수)는 동작하지 않으므로 Vercel 프리뷰에서 확인 |
| `npm run build` | 타입 검사(vue-tsc) + 빌드. **커밋·PR 전에 통과해야 한다** (CI도 같은 명령) |
| `npm run preview` | 빌드 결과 확인. PWA(서비스워커)는 여기서만 동작 |

로그인은 Discord OAuth이며, 봇의 `/유저등록`으로 등록된 사용자만 들어올 수 있습니다.

## 브랜치와 배포
| 브랜치 | 배포 | DB |
|--------|------|----|
| `main` | Production | prod |
| `dev` (기본 브랜치) | Preview | dev |
| `feat/*` `fix/*` `style/*` `refactor/*` `docs/*` `chore/*` | Preview | dev |

작업 브랜치 → `dev`로 PR → 모아서 `dev` → `main` 배포 PR. 병합된 브랜치는 자동 삭제됩니다.

## 기여 방법
1. **이슈**를 만든다(템플릿 사용, 영역 라벨 `area:*`). 큰 작업은 하위 이슈로 나눈다
2. 브랜치를 만들어 작업하고 [Conventional Commits](https://www.conventionalcommits.org/ko/) 형식으로 커밋한다.
   본문에는 "무엇"보다 **"왜"**를 쓴다
3. `dev`로 PR을 연다. 제목은 커밋과 같은 형식(`feat: …`), 본문에 `Closes #이슈번호`
4. CI(빌드) 통과 + 리뷰 승인 1명 + 리뷰 코멘트 해결 후 병합

자세한 규칙(도메인 룰, DB 변경 방법, PR 작성법)은 [`CLAUDE.md`](./CLAUDE.md)에 있습니다.
