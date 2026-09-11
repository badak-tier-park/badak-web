import type { tierClass } from './lib/constants'

declare module 'vue' {
  interface ComponentCustomProperties {
    /** 티어 문자열('A+')을 CSS 클래스용 letter('a')로 변환 */
    $tierClass: typeof tierClass
  }
}

export {}
