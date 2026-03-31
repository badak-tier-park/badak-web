import { supabase } from '@/lib/supabase'

export interface MapInsert {
  name: string
  aliases: string[]
  width: number
  height: number
  player_count: number
  tileset: string
  imageFile: File | null
}

export async function createMap(data: MapInsert) {
  let image_url: string | null = null

  // 1. 이미지 업로드
  if (data.imageFile) {
    const ext = data.imageFile.name.split('.').pop()
    const path = `${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('map-images')
      .upload(path, data.imageFile)

    if (uploadError) throw uploadError

    const { data: urlData } = supabase.storage
      .from('map-images')
      .getPublicUrl(path)

    image_url = urlData.publicUrl
  }

  // 2. maps 테이블에 저장
  const { data: map, error } = await supabase
    .from('maps')
    .insert({
      name: data.name,
      aliases: data.aliases,
      width: data.width,
      height: data.height,
      player_count: data.player_count,
      tileset: data.tileset,
      image_url,
    })
    .select()
    .single()

  if (error) throw error
  return map
}
