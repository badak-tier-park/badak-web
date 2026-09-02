import ExcelJS from 'exceljs'

/**
 * 범용 엑셀(.xlsx) 인코딩/디코딩 헬퍼. csv.ts와 같은 층위 —
 * 선수 등 도메인 지식 없이 string[][] 행렬만 다룬다.
 */

export interface ColumnValidation {
  /** 0-based 컬럼 인덱스 */
  col: number
  /** 드롭다운으로 노출할 허용값 목록 */
  values: readonly string[]
}

/**
 * string[][] → .xlsx 워크북 생성 후 다운로드한다.
 * rows[0]은 헤더 행으로 취급해 굵게 표시하고 고정한다.
 * validations로 지정한 컬럼은 데이터 행(2행부터)에 드롭다운 목록 검증을 건다.
 */
export async function downloadXlsx(
  filename: string,
  rows: string[][],
  validations: ColumnValidation[] = [],
): Promise<void> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet('players')

  sheet.addRows(rows)

  const header = sheet.getRow(1)
  header.font = { bold: true }
  sheet.views = [{ state: 'frozen', ySplit: 1 }]

  sheet.columns.forEach(col => { col.width = 14 })

  const lastRow = rows.length
  if (lastRow >= 2) {
    for (const { col, values } of validations) {
      const letter = sheet.getColumn(col + 1).letter
      for (let r = 2; r <= lastRow; r++) {
        sheet.getCell(`${letter}${r}`).dataValidation = {
          type: 'list',
          allowBlank: false,
          formulae: [`"${values.join(',')}"`],
          showErrorMessage: true,
          errorStyle: 'error',
          errorTitle: '잘못된 값',
          error: `${values.join(', ')} 중 하나를 선택하세요.`,
        }
      }
    }
  }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** .xlsx 파일(File) → string[][]. 첫 번째 워크시트를 읽는다. */
export async function readXlsx(file: File): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook()
  const buffer = await file.arrayBuffer()
  await workbook.xlsx.load(buffer)

  const sheet = workbook.worksheets[0]
  if (!sheet) return []

  const rows: string[][] = []
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as (ExcelJS.CellValue | undefined)[]
    // ExcelJS의 row.values는 1-based (인덱스 0은 비움) — 잘라내고 문자열로 변환
    const cells = values.slice(1).map(cellToString)
    rows.push(cells)
  })
  return rows
}

function cellToString(v: ExcelJS.CellValue | undefined): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'object') {
    // richText, formula 결과(result) 등
    if ('text' in v && typeof (v as any).text === 'string') return (v as any).text
    if ('result' in v) return cellToString((v as any).result)
    if ('richText' in v && Array.isArray((v as any).richText)) {
      return (v as any).richText.map((t: any) => t.text).join('')
    }
    return String(v)
  }
  return String(v)
}
