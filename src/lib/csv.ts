/**
 * 범용 CSV 인코딩/디코딩 헬퍼. 선수·리그 등 도메인 지식을 갖지 않는다.
 * RFC4180 스타일 — 필드에 콤마/따옴표/개행이 있으면 따옴표로 감싸고,
 * 내부 따옴표는 두 번 반복(""")해 이스케이프한다.
 */

function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/** string[][] → CSV 문자열 (UTF-8 BOM 포함, 행 구분자는 \r\n) */
export function toCsv(rows: string[][]): string {
  const body = rows.map(row => row.map(escapeCsvField).join(',')).join('\r\n')
  // 앞의 한 글자는 U+FEFF(BOM) 리터럴 — 에디터에 안 보여도 정상, 검증 완료
  return '﻿' + body
}

/**
 * CSV 문자열 → string[][]. 따옴표로 감싼 필드, 이스케이프된 큰따옴표(""),
 * 필드 내 콤마/개행을 문자 단위 상태기계로 처리한다. 선행 BOM은 제거한다.
 */
export function parseCsv(text: string): string[][] {
  const s = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]

    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++ }
        else { inQuotes = false }
      } else {
        field += c
      }
      continue
    }

    if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\r') {
      // \r\n 의 \r은 무시하고 다음 \n에서 행을 종료한다
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += c
    }
  }

  // 마지막 행 처리 (파일 끝에 개행이 없는 경우)
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

/** Blob + <a download>로 CSV 파일을 다운로드한다 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
