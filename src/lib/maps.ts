import { supabase } from '@/lib/supabase'

export interface MapRow {
  id: string
  name: string
  aliases: string[]
  image_url: string | null
  thumbnail_url: string | null
  width: number
  height: number
  player_count: number
  tileset: string
  created_at: string
  updated_at: string
}

const THUMBNAIL_MAX_SIZE = 320
const IMAGE_MAX_SIZE = 1280

function resizeToCanvas(img: HTMLImageElement, maxSize: number): HTMLCanvasElement {
  const scale = Math.min(maxSize / img.width, maxSize / img.height, 1)
  const w = Math.round(img.width * scale)
  const h = Math.round(img.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
  return canvas
}

function canvasToFile(canvas: HTMLCanvasElement, name: string, quality: number): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('blob conversion failed'))
        resolve(new File([blob], name, { type: 'image/jpeg' }))
      },
      'image/jpeg',
      quality,
    )
  })
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(img.src); resolve(img) }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

async function compressImage(file: File): Promise<File> {
  const img = await loadImage(file)
  const canvas = resizeToCanvas(img, IMAGE_MAX_SIZE)
  return canvasToFile(canvas, 'image.jpg', 0.85)
}

async function generateThumbnail(file: File): Promise<File> {
  const img = await loadImage(file)
  const canvas = resizeToCanvas(img, THUMBNAIL_MAX_SIZE)
  return canvasToFile(canvas, 'thumb.jpg', 0.75)
}

export interface MapInsert {
  name: string
  aliases: string[]
  width: number
  height: number
  player_count: number
  tileset: string
  imageFile: File | null
}

export async function getMaps(): Promise<MapRow[]> {
  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getMap(id: string): Promise<MapRow> {
  const { data, error } = await supabase
    .from('maps')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

async function uploadImage(file: File, path: string): Promise<string> {
  const { error } = await supabase.storage.from('map-images').upload(path, file)
  if (error) throw error
  return supabase.storage.from('map-images').getPublicUrl(path).data.publicUrl
}

export async function updateMap(
  id: string,
  data: MapInsert,
  existingImageUrl: string | null,
  existingThumbnailUrl: string | null,
) {
  let image_url = existingImageUrl
  let thumbnail_url = existingThumbnailUrl

  if (data.imageFile) {
    const base = crypto.randomUUID()
    const [compressed, thumb] = await Promise.all([
      compressImage(data.imageFile),
      generateThumbnail(data.imageFile),
    ])
    const [origUrl, thumbUrl] = await Promise.all([
      uploadImage(compressed, `${base}.jpg`),
      uploadImage(thumb, `${base}_thumb.jpg`),
    ])
    image_url = origUrl
    thumbnail_url = thumbUrl
  }

  const { data: map, error } = await supabase
    .from('maps')
    .update({
      name: data.name,
      aliases: data.aliases,
      width: data.width,
      height: data.height,
      player_count: data.player_count,
      tileset: data.tileset,
      image_url,
      thumbnail_url,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return map
}

export async function createMap(data: MapInsert) {
  let image_url: string | null = null
  let thumbnail_url: string | null = null

  if (data.imageFile) {
    const base = crypto.randomUUID()
    const [compressed, thumb] = await Promise.all([
      compressImage(data.imageFile),
      generateThumbnail(data.imageFile),
    ])
    const [origUrl, thumbUrl] = await Promise.all([
      uploadImage(compressed, `${base}.jpg`),
      uploadImage(thumb, `${base}_thumb.jpg`),
    ])
    image_url = origUrl
    thumbnail_url = thumbUrl
  }

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
      thumbnail_url,
    })
    .select()
    .single()

  if (error) throw error
  return map
}
