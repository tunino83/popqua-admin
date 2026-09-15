import { supabase, supabaseAdmin } from './supabase'

export type EventStatus = 'draft' | 'published' | 'cancelled'

export interface AdminEvent {
  id: string
  title: string
  description: string | null
  location_text: string | null
  location: string | null
  lat?: number | null
  lon?: number | null
  start_at: string | null
  end_at: string | null
  image_url: string | null
  link: string | null
  contact_email: string | null
  category: string | null
  status: EventStatus
  author_id: string | null
  created_at: string
  participant_count?: number
}

export async function getAllEvents(): Promise<AdminEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('start_at', { ascending: true })
  if (error) { console.error(error); return [] }
  return (data ?? []).map(ev => {
    const coords = parseEventCoords(ev.location)
    return { ...ev, lat: coords?.lat ?? null, lon: coords?.lng ?? null } as AdminEvent
  })
}

export async function getEventById(id: string): Promise<AdminEvent | null> {
  const { data, error } = await supabase.from('events').select('*').eq('id', id).maybeSingle()
  if (error) { console.error(error); return null }
  return data as AdminEvent | null
}

export async function getEventParticipantCount(id: string): Promise<number> {
  const { count } = await supabase
    .from('event_participations')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', id)
  return count ?? 0
}

// Campi scrivibili sulla tabella events (esclude computed/readonly)
const WRITABLE_FIELDS = [
  'title', 'description', 'location_text', 'location',
  'start_at', 'end_at', 'image_url', 'link', 'contact_email',
  'category', 'status', 'author_id',
] as const

function pickWritable(event: Partial<AdminEvent>) {
  return Object.fromEntries(
    WRITABLE_FIELDS.filter(k => k in event).map(k => [k, (event as any)[k]])
  )
}

export async function upsertEvent(event: Partial<AdminEvent> & { id?: string }): Promise<AdminEvent | null> {
  const { id } = event
  const payload = pickWritable(event)
  if (id) {
    const { data, error } = await supabaseAdmin.from('events').update(payload).eq('id', id).select().maybeSingle()
    if (error) { console.error(error); throw new Error(error.message) }
    if (!data) throw new Error('Nessuna riga aggiornata — controlla i permessi Supabase')
    return data as AdminEvent
  } else {
    const { data, error } = await supabaseAdmin.from('events').insert(payload).select().maybeSingle()
    if (error) { console.error(error); throw new Error(error.message) }
    return data as AdminEvent
  }
}

export async function deleteEvent(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
  if (error) { console.error(error); return false }
  return true
}

export async function uploadEventImage(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop()
  const path = `events/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabaseAdmin.storage.from('images').upload(path, file, { upsert: false })
  if (error) { console.error(error); return null }
  const { data } = supabaseAdmin.storage.from('images').getPublicUrl(path)
  return data.publicUrl
}

function hexToDouble(hex: string): number {
  const buf = new Uint8Array(8)
  for (let i = 0; i < 8; i++) buf[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return new DataView(buf.buffer).getFloat64(0, true)
}

export function parseEventCoords(location: any): { lat: number; lng: number } | null {
  if (!location) return null
  try {
    // GeoJSON object
    if (typeof location === 'object' && location.type === 'Point')
      return { lat: location.coordinates[1], lng: location.coordinates[0] }
    // GeoJSON string
    if (typeof location === 'string' && location.startsWith('{')) {
      const geo = JSON.parse(location)
      if (geo.type === 'Point') return { lat: geo.coordinates[1], lng: geo.coordinates[0] }
    }
    // WKT
    const wkt = typeof location === 'string' ? location.match(/POINT\(([^ ]+) ([^)]+)\)/) : null
    if (wkt) return { lng: parseFloat(wkt[1]), lat: parseFloat(wkt[2]) }
    // Hex WKB / EWKB (PostgREST default for geometry columns)
    if (typeof location === 'string' && /^[0-9a-fA-F]+$/.test(location) && location.length >= 34) {
      const hasSRID = location.slice(2, 10).toLowerCase() === '01000020' || location.slice(2, 4).toLowerCase() === '60'
      const offset = hasSRID ? 18 : 10
      const lng = hexToDouble(location.slice(offset, offset + 16))
      const lat = hexToDouble(location.slice(offset + 16, offset + 32))
      if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng }
    }
  } catch {}
  return null
}
