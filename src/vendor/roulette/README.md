# 마블 룰렛 (vendored)

- 원본: https://github.com/lazygyu/roulette — 커밋 `87298bf174e10aa4f3a7cd8b9d9faa8d9c6ef505` (2026-11-22에 가져옴)
- 라이선스: MIT, 같은 폴더의 `LICENSE`(원본 그대로). 물리 엔진 `box2d-wasm`(Zlib)은 npm 의존성
- 쓰는 곳: `roulette.html` + `src/roulette-embed/main.ts`(iframe 페이지) ← `src/components/RouletteModal.vue`

## 가져온 것
룰렛 동작에 필요한 파일만(엔진·물리·렌더러·맵 데이터·순위/미니맵/빨리 감기 UI)과 `assets/ff.svg`(빨리 감기 아이콘).

## 뺀 것 (외부 네트워크 호출이 남지 않게)
- 광고(`adService`, `adRenderer`, 광고 타입), 키워드 스프라이트(`keywordService`, 외부 API)
- 맵 공유마당(`communityMaps`, `mapBrowser`, `mapSelector`), 영상 녹화(`videoRecorder`)
- 다국어(`localization`, `languages`), 원본 앱 화면(`index.ts`, `index.html`), 서비스워커 빌드 스크립트
- 특정 이름에 붙던 사진(`assets/images/*.png`)

## 원본에서 바꾼 곳 (`[badak]` 주석)
- `@bound` 데코레이터 → 화살표 함수 필드(우리 빌드는 레거시 데코레이터를 쓰지 않는다)
- `RouletteRenderer.init(container)` / `new Roulette(container)`: 캔버스를 `document.body` 대신 넘겨받은 곳에 붙인다
- 렌더러·룰렛에서 광고·녹화·키워드 관련 코드 제거, 결과 팝업 닫기 버튼 도우미만 `adRenderer`에서 옮김
- `ff.svg` 경로

이 폴더는 타입 검사(`tsconfig.app.json`)에서 제외한다 — 원본 코드를 우리 strict 설정에 맞춰 고치지 않으려고.
원본을 새로 받을 때는 위 목록대로 다시 빼고 바꾼다.
