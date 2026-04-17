import { ref } from 'vue'

export function useToast(duration = 2500) {
  const toast = ref('')
  let timer: ReturnType<typeof setTimeout> | null = null

  function showToast(msg: string) {
    toast.value = msg
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { toast.value = '' }, duration)
  }

  function clearToast() {
    if (timer) clearTimeout(timer)
    toast.value = ''
  }

  return { toast, showToast, clearToast }
}
