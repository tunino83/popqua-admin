import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, Trash2, MapPin, Upload, Users, CalendarDays } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { getEventById, upsertEvent, deleteEvent, uploadEventImage, parseEventCoords, type AdminEvent } from '../lib/events'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/Toast'

const CATEGORIES = ['Musica', 'Sport', 'Arte', 'Food', 'Cultura', 'Mercato', 'Teatro', 'Cinema', 'Festival', 'Altro']
const STATUSES = [
  { value: 'draft',     label: 'Bozza' },
  { value: 'published', label: 'Pubblicato' },
  { value: 'cancelled', label: 'Annullato' },
] as const

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isNew = id === 'new'
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  const [event, setEvent] = useState<Partial<AdminEvent>>({ status: 'draft' })
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [participants, setParticipants] = useState(0)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const { success: toastSuccess, error: toastError } = useToast()
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  useEffect(() => {
    if (isNew) return
    getEventById(id!).then(ev => {
      if (!ev) { navigate('/events'); return }
      setEvent(ev)
      const coords = parseEventCoords(ev.location)
      if (coords) { setLat(String(coords.lat)); setLng(String(coords.lng)) }
      setImagePreview(ev.image_url)
    }).finally(() => setLoading(false))

    supabase.from('event_participations').select('id', { count: 'exact', head: true }).eq('event_id', id!)
      .then(({ count }) => setParticipants(count ?? 0))
  }, [id])

  // Leaflet map init
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const la = parseFloat(lat) || 41.9028
    const lo = parseFloat(lng) || 12.4964
    const map = L.map(mapRef.current).setView([la, lo], 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)
    mapInstance.current = map

    if (!isNaN(parseFloat(lat)) && !isNaN(parseFloat(lng))) {
      markerRef.current = L.marker([parseFloat(lat), parseFloat(lng)], { draggable: true }).addTo(map)
      markerRef.current.on('dragend', (e: any) => {
        const pos = e.target.getLatLng()
        setLat(pos.lat.toFixed(6)); setLng(pos.lng.toFixed(6))
      })
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: la, lng: lo } = e.latlng
      setLat(la.toFixed(6)); setLng(lo.toFixed(6))
      if (markerRef.current) {
        markerRef.current.setLatLng([la, lo])
      } else {
        markerRef.current = L.marker([la, lo], { draggable: true }).addTo(map)
        markerRef.current.on('dragend', (ev: any) => {
          const pos = ev.target.getLatLng()
          setLat(pos.lat.toFixed(6)); setLng(pos.lng.toFixed(6))
        })
      }
    })

    return () => { map.remove(); mapInstance.current = null; markerRef.current = null }
  }, [loading])

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!event.title?.trim()) { setError('Il titolo è obbligatorio'); return }
    setSaving(true); setError(null)
    try {
      let imageUrl = event.image_url ?? null
      if (imageFile) {
        imageUrl = await uploadEventImage(imageFile)
        if (!imageUrl) throw new Error('Errore upload immagine')
      }

      const locationStr = lat && lng ? `POINT(${lng} ${lat})` : null

      const saved = await upsertEvent({
        ...event,
        id: isNew ? undefined : id,
        image_url: imageUrl,
        location: locationStr,
      })
      if (!saved) throw new Error('Nessuna riga aggiornata — controlla le policy RLS su Supabase')
      toastSuccess(isNew ? 'Evento creato con successo!' : 'Evento modificato con successo!')
      navigate(`/events/${saved.id}`)
    } catch (e: any) {
      setError(e.message)
      toastError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Eliminare questo evento?')) return
    const ok = await deleteEvent(id!)
    if (ok) { toastSuccess('Evento eliminato'); navigate('/events') }
    else toastError('Errore durante l\'eliminazione')
  }

  if (loading) return <div className="text-sm text-gray-400 py-8 text-center">Caricamento…</div>

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/events')} className="p-2 text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{isNew ? 'Nuovo evento' : 'Modifica evento'}</h1>
            {!isNew && <p className="text-xs text-gray-500 dark:text-gray-400">ID: {id?.slice(0, 8)}…</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <div className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl text-sm">
              <Users className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-gray-900 dark:text-white">{participants}</span>
              <span className="text-gray-500 dark:text-gray-400 text-xs">partecipanti</span>
            </div>
          )}
          {!isNew && (
            <button onClick={handleDelete} className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 border border-rose-200 dark:border-rose-900 rounded-xl text-sm font-medium transition-colors">
              <Trash2 className="w-4 h-4" />Elimina
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
            <Save className="w-4 h-4" />{saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>

      {error && <div className="text-sm text-rose-600 bg-rose-50 dark:bg-rose-950 px-4 py-3 rounded-xl border border-rose-200 dark:border-rose-900">{error}</div>}

      <div className="grid grid-cols-2 gap-6">
        {/* Left column */}
        <div className="space-y-4">
          {/* Base info */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Informazioni</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Titolo *</label>
              <input value={event.title ?? ''} onChange={e => setEvent(p => ({ ...p, title: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Titolo evento" />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Descrizione</label>
              <textarea value={event.description ?? ''} onChange={e => setEvent(p => ({ ...p, description: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                placeholder="Descrizione…" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Categoria</label>
                <select value={event.category ?? ''} onChange={e => setEvent(p => ({ ...p, category: e.target.value || null }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">—</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Stato</label>
                <select value={event.status ?? 'draft'} onChange={e => setEvent(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><CalendarDays className="w-4 h-4 text-gray-400" />Date</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Inizio</label>
                <input type="datetime-local" value={event.start_at ? event.start_at.slice(0, 16) : ''}
                  onChange={e => {
                    if (!e.target.value) { setEvent(p => ({ ...p, start_at: null })); return }
                    // Default ora 00:00 se l'utente ha scelto solo la data
                    const val = e.target.value.includes('T') && e.target.value.length === 16 ? e.target.value : e.target.value + 'T00:00'
                    setEvent(p => ({ ...p, start_at: new Date(val).toISOString() }))
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-[10px] text-gray-400 mt-0.5">Default ora: 00:00</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Fine</label>
                <input type="date" value={event.end_at ? event.end_at.slice(0, 10) : ''}
                  onChange={e => {
                    if (!e.target.value) { setEvent(p => ({ ...p, end_at: null })); return }
                    // Fine sempre alle 23:59
                    setEvent(p => ({ ...p, end_at: new Date(e.target.value + 'T23:59').toISOString() }))
                  }}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                <p className="text-[10px] text-gray-400 mt-0.5">Fine giornata: 23:59</p>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Contatti e link</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Email contatto</label>
              <input type="email" value={event.contact_email ?? ''} onChange={e => setEvent(p => ({ ...p, contact_email: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="info@evento.it" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Link (sito/biglietti)</label>
              <input type="url" value={event.link ?? ''} onChange={e => setEvent(p => ({ ...p, link: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="https://…" />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Image */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Immagine</h2>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-40 object-cover rounded-lg" />
                <button onClick={() => { setImagePreview(null); setImageFile(null); setEvent(p => ({ ...p, image_url: null })) }}
                  className="absolute top-2 right-2 bg-white dark:bg-gray-900 rounded-full p-1 shadow text-gray-500 hover:text-rose-500 transition-colors text-xs">
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 h-32 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors">
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400">Clicca per caricare</span>
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            )}
          </div>

          {/* Location */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2"><MapPin className="w-4 h-4 text-gray-400" />Posizione</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nome luogo</label>
              <input value={event.location_text ?? ''} onChange={e => setEvent(p => ({ ...p, location_text: e.target.value || null }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Es. Piazza del Duomo, Milano" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Latitudine</label>
                <input value={lat} onChange={e => setLat(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="41.9028" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Longitudine</label>
                <input value={lng} onChange={e => setLng(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="12.4964" />
              </div>
            </div>
            <p className="text-xs text-gray-400">Clicca sulla mappa per posizionare l'evento o trascina il marker.</p>
            <div ref={mapRef} style={{ height: 260 }} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 z-0" />
          </div>
        </div>
      </div>
    </div>
  )
}
