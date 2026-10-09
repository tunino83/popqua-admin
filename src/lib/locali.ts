import { supabase } from './supabase'

/* Locali: posti che, quando ci si avvicina, propongono il loro stile
   nell'app. Tabella `locali` + vista `locali_admin` (lat, lon, aperto_ora)
   e la vetrina in `vetrina_voci`. Migrazioni nel repository dell'app. */

export const SKIN = [
  { id: 'locali', nome: 'Locali (bar, pub)' },
  { id: 'ristorante', nome: 'Ristorante / pizzeria' },
  { id: 'palestra', nome: 'Palestra' },
  { id: 'sport', nome: 'Sport (campo, stadio)' },
  { id: 'barsport', nome: 'Bar sport' },
  { id: 'campus', nome: 'Campus / scuola' },
  { id: 'diesis', nome: 'Diesis (disegnata a mano)' },
  { id: 'custom', nome: '★ Su misura (la componi qui)' },
] as const

export const GIORNI = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export interface Fascia { giorni: number[]; dalle: string; alle: string }

export interface TemaLocale {
  colori?: { signal?: string; time?: string }
  emoji?: string
  motto?: string
  testi?: { lascia?: string; vuoto?: string; invia?: string }
  frasi?: string[]
  /** Solo per la skin 'custom'. */
  aspetto?: import('../components/EditorSuMisura').Aspetto
}

export interface Locale {
  id: string
  nome: string
  dove: string | null
  skin: string
  raggio_m: number
  attivo: boolean
  tema: TemaLocale
  dal: string | null
  al: string | null
  orari: Fascia[]
  lat: number
  lon: number
  aperto_ora?: boolean
  creato?: string
}

export interface VoceVetrina {
  id?: string
  locale_id?: string
  sezione: string
  ordine: number
  nome: string
  descrizione: string | null
  prezzo: number | null
  etichette: string[]
  disponibile: boolean
}

export async function elencoLocali(): Promise<Locale[]> {
  const { data, error } = await supabase.from('locali_admin').select('*').order('nome')
  if (error) throw error
  return (data ?? []) as Locale[]
}

export async function getLocale(id: string): Promise<Locale | null> {
  const { data, error } = await supabase.from('locali_admin').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Locale | null
}

export async function salvaLocale(l: Partial<Locale>): Promise<string> {
  const riga = {
    nome: l.nome, dove: l.dove || null, skin: l.skin, raggio_m: l.raggio_m, attivo: l.attivo,
    tema: l.tema ?? {}, dal: l.dal || null, al: l.al || null, orari: l.orari ?? [],
    location: `SRID=4326;POINT(${l.lon} ${l.lat})`,
  }
  if (l.id) {
    const { error } = await supabase.from('locali').update(riga).eq('id', l.id)
    if (error) throw error
    return l.id
  }
  const { data, error } = await supabase.from('locali').insert(riga).select('id').single()
  if (error) throw error
  return data.id
}

export async function attivaLocale(id: string, attivo: boolean) {
  const { error } = await supabase.from('locali').update({ attivo }).eq('id', id)
  if (error) throw error
}

export async function eliminaLocale(id: string) {
  const { error } = await supabase.from('locali').delete().eq('id', id)
  if (error) throw error
}

export async function vociVetrina(localeId: string): Promise<VoceVetrina[]> {
  const { data, error } = await supabase.from('vetrina_voci').select('*').eq('locale_id', localeId).order('ordine')
  if (error) throw error
  return (data ?? []).map(v => ({ ...v, prezzo: v.prezzo == null ? null : Number(v.prezzo) }))
}

/* La vetrina si salva intera: si cancellano le voci tolte e si
   riscrivono le altre nell'ordine della lista. */
export async function salvaVetrina(localeId: string, voci: VoceVetrina[]) {
  const tenute = voci.filter(v => v.id).map(v => v.id!)
  let q = supabase.from('vetrina_voci').delete().eq('locale_id', localeId)
  if (tenute.length) q = q.not('id', 'in', `(${tenute.join(',')})`)
  const { error: e1 } = await q
  if (e1) throw e1
  const righe = voci.map((v, i) => ({
    ...(v.id ? { id: v.id } : {}),
    locale_id: localeId, sezione: v.sezione.trim() || 'Altro', ordine: i + 1, nome: v.nome.trim(),
    descrizione: v.descrizione?.trim() || null, prezzo: v.prezzo, etichette: v.etichette, disponibile: v.disponibile,
  })).filter(r => r.nome)
  if (!righe.length) return
  const { error: e2 } = await supabase.from('vetrina_voci').upsert(righe)
  if (e2) throw e2
}

/* "Sempre", "Ven–Sab 19:00–00:30", "dal 12/10 15:00 al 12/10 17:30". */
export function descriviDisponibilita(l: Pick<Locale, 'dal' | 'al' | 'orari'>): string {
  const parti: string[] = []
  const fmt = (s: string) => new Date(s).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  if (l.dal || l.al) parti.push(`${l.dal ? 'dal ' + fmt(l.dal) : ''}${l.dal && l.al ? ' ' : ''}${l.al ? 'al ' + fmt(l.al) : ''}`)
  for (const f of l.orari ?? []) {
    const g = f.giorni.length === 7 ? 'Tutti i giorni' : f.giorni.map(n => GIORNI[n - 1]).join(' ')
    parti.push(`${g} ${f.dalle}–${f.alle}`)
  }
  return parti.length ? parti.join(' · ') : 'Sempre'
}
