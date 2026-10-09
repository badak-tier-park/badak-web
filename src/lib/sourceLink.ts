/**
 * 이미지 출처(리퀴피디아 위키에서 누구나 편집할 수 있는 값)를 화면에 보여줄 링크로 바꾼다.
 * javascript:·data: 같은 주소를 href에 그대로 넣으면 클릭 시 스크립트가 실행되므로
 * (Vue는 href를 걸러주지 않음) http(s)일 때만 링크로 만들고, 나머지는 글자로만 둔다.
 */
export function safeSourceLink(source: string): { href: string | null; label: string } {
  try {
    const u = new URL(source)
    if (u.protocol === 'https:' || u.protocol === 'http:') return { href: u.href, label: u.hostname }
  } catch {
    // 주소가 아니면 글자로만 보여준다
  }
  return { href: null, label: source }
}
