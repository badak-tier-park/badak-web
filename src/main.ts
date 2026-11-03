import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import './styles/theme.scss'
import './styles/_tokens.scss'
import App from './App.vue'
import router from './router'
import { tierClass } from './lib/constants'

const app = createApp(App)

// 티어 문자열('A+')을 CSS 클래스용 letter('a')로 변환 — 템플릿에서 $tierClass()로 사용
app.config.globalProperties.$tierClass = tierClass

app.use(createPinia())
app.use(router)

app.mount('#app')

// 저장 공간이 부족할 때 브라우저가 localStorage(로그인 세션)를 지우지 않도록 요청한다.
// 설치된 홈 화면 앱에서는 대부분 묻지 않고 허용된다
navigator.storage?.persist?.().catch(() => {})
