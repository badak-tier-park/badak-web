import { ref } from 'vue'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'badak-theme'
const theme = ref<Theme>('dark')

function applyTheme(t: Theme) {
  if (t === 'light') {
    document.documentElement.setAttribute('data-theme', 'light')
  } else {
    document.documentElement.removeAttribute('data-theme')
  }
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
