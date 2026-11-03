import { ref } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'badak-theme'
const theme = ref<Theme>('dark')

// 홈 화면 앱의 상태바/작업 전환 화면 색 — theme.scss의 --c-bg와 같은 값
const THEME_COLOR: Record<Theme, string> = { dark: '#0a0b10', light: '#f0f1f5' }

function applyTheme(t: Theme) {
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[t])
}

export function useTheme() {
  function init() {
    const saved = localStorage.getItem(STORAGE_KEY) as Theme | null
    theme.value = saved ?? 'dark'
    applyTheme(theme.value)
  }

  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, theme.value)
    applyTheme(theme.value)
  }

  return { theme, toggle, init }
}
