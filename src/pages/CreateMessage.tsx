import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Send, Upload, X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

type MessageType = 'message' | 'event' | 'offer'

const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png'
const CARTO_DARK  = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const CARTO_ATTR  = '&copy; OpenStreetMap &copy; CARTO'

const EXPIRY_OPTIONS = [
  { value: 15,    label: '15 min' },
  { value: 30,    label: '30 min' },
  { value: 60,    label: '1h' },
  { value: 180,   label: '3h' },
  { value: 1440,  label: '1 giorno' },
  { value: 10080, label: '1 settimana' },
  { value: 43200, label: '1 mese' },
]

const DELAY_OPTIONS = [
  { value: 0,   label: 'Immediato' },
  { value: 15,  label: '15s' },
  { value: 60,  label: '1 min' },
  { value: 300, label: '5 min' },
  { value: 600, label: '10 min' },
]

function isDark() { return document.documentElement.classList.contains('dark') }

async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = (e) => {
      const img = new Image()
      img.src = e.target?.result as string
      img.onload = () => {
        const max = 1920
        let { width, height } = img
        if (width > height && width > max) { height = Math.round(height * max / width); width = max }
        else if (height > max) { width = Math.round(width * max / height); height = max }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression failed')), 'image/jpeg', 0.8)
      }
      img.onerror = () => reject(new Error('Image load failed'))
    }
  })
}

export default function CreateMessage() {
  const navigate = useNavigate()

  // Content
  const [messageType, setMessageType] = useState<MessageType>('message')
  const [title, setTitle]     = useState('')
  const [text, setText]       = useState('')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [isGlobal, setIsGlobal] = useState(false)

  // Author (current admin)
  const [adminProfile, setAdminProfile] = useState<{ id: string; username: string } | null>(null)

  // Location
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const mapRef         = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef      = useRef<L.Marker | null>(null)

  // Places
  const [placeId,      setPlaceId]      = useState<string>('')
  const [places,       setPlaces]       = useState<{ id: string; name: string; category: string }[]>([])
  const [loadingPlaces, setLoadingPlaces] = useState(false)
  const placesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Timing
  const [delaySeconds,    setDelaySeconds]    = useState(0)
  const [expiresMinutes,  setExpiresMinutes]  = useState(60)
  const [customExpiryDate, setCustomExpiryDate] = useState('')

  // Image
  const [imageUrl,     setImageUrl]     = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploading,  setIsUploading]  = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('user_profiles').select('id, username').eq('id', user.id).single()
        .then(({ data }) => { if (data) setAdminProfile(data) })
    })
  }, [])

  // Map init
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    const map = L.map(mapRef.current).setView([41.9, 12.5], 6)
    mapInstanceRef.current = map
    L.tileLayer(isDark() ? CARTO_DARK : CARTO_LIGHT, { attribution: CARTO_ATTR, subdomains: 'abcd', maxZoom: 19 }).addTo(map)

    navigator.geolocation?.getCurrentPosition(({ coords }) => {
      const { latitude: la, longitude: lo } = coords
      map.setView([la, lo], 13)
      setLat(la.toFixed(6))
      setLng(lo.toFixed(6))
      markerRef.current = L.marker([la, lo]).addTo(map)
    })

    map.on('click', (e) => {
      const { lat: la, lng: lo } = e.latlng
      setLat(la.toFixed(6))
      setLng(lo.toFixed(6))
      if (markerRef.current) markerRef.current.setLatLng(e.latlng)
      else markerRef.current = L.marker(e.latlng).addTo(map)
    })

    setTimeout(() => map.invalidateSize(), 100)
    return () => { map.remove(); mapInstanceRef.current = null; markerRef.current = null }
  }, [])

  // Fetch nearby places when coordinates settle
  useEffect(() => {
    const la = parseFloat(lat), lo = parseFloat(lng)
    if (isNaN(la) || isNaN(lo)) return
    if (placesTimerRef.current) clearTimeout(placesTimerRef.current)
    placesTimerRef.current = setTimeout(async () => {
      setLoadingPlaces(true)
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-places`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lat: la, lon: lo, radius: 500 }),
        })
        if (res.ok) {
          const json = await res.json()
          setPlaces((json.places ?? []).slice(0, 20))
        }
      } catch {}
      finally { setLoadingPlaces(false) }
    }, 800)
  }, [lat, lng])

  // Sync marker when lat/lng typed manually
  useEffect(() => {
    const la = parseFloat(lat), lo = parseFloat(lng)
    if (!mapInstanceRef.current || isNaN(la) || isNaN(lo)) return
    const ll: L.LatLngExpression = [la, lo]
    if (markerRef.current) markerRef.current.setLatLng(ll)
    else markerRef.current = L.marker(ll).addTo(mapInstanceRef.current)
  }, [lat, lng])

  async function uploadImage(file: File): Promise<string | null> {
    if (!file.type.startsWith('image/')) { setError("Il file deve essere un'immagine"); return null }
    setIsUploading(true)
    try {
      const blob = await compressImage(file)
      const path = `messages/${Date.now()}_${file.name}`
      const { data, error: upErr } = await supabase.storage.from('images').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw upErr
      const { data: pub } = supabase.storage.from('images').getPublicUrl(data.path)
      return pub.publicUrl
    } catch (e: any) {
      setError(`Upload fallito: ${e.message}`)
      return null
    } finally {
      setIsUploading(false)
    }
  }

  const needsTitle = messageType === 'event' || messageType === 'offer'
  const latN = parseFloat(lat), lngN = parseFloat(lng)
  const hasLocation = !isNaN(latN) && !isNaN(lngN)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) { setError('Il testo è obbligatorio'); return }
    if (needsTitle && !title.trim()) { setError('Il titolo è obbligatorio per eventi e offerte'); return }
    if (!isGlobal && !hasLocation) { setError('Seleziona una posizione sulla mappa o inserisci le coordinate'); return }

    setIsSubmitting(true); setError(null)
    try {
      const now = new Date()
      const visibleAt = new Date(now.getTime() + delaySeconds * 1000)
      const expiresAt = customExpiryDate
        ? new Date(customExpiryDate + 'T23:59:59')
        : new Date(visibleAt.getTime() + expiresMinutes * 60 * 1000)

      const username = adminProfile?.username ?? 'admin'
      const authorId = adminProfile?.id ?? null

      const { error: insertErr } = await supabase.from('messages').insert({
        text: text.trim(),
        title: title.trim() || null,
        location: isGlobal ? null : `POINT(${lngN} ${latN})`,
        visible_at: visibleAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        username,
        author_id: authorId,
        display_nickname: username,
        is_anonymous: isAnonymous,
        message_type: messageType,
        image_url: imageUrl,
        is_global: isGlobal,
        place_id: placeId || null,
      })
      if (insertErr) throw insertErr
      setSuccess(true)
      setTimeout(() => navigate('/messages'), 1500)
    } catch (e: any) {
      setError(e.message || 'Errore durante la creazione')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500'
  const cardCls  = 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 space-y-4'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/messages')}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Torna ai messaggi
        </button>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">Nuovo messaggio</h1>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm font-medium">
          Messaggio creato con successo. Reindirizzamento…
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 items-start">

        {/* ─── Left column ─── */}
        <div className="space-y-4">

          {/* Type */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tipo</h2>
            <div className="flex gap-2">
              {([
                { value: 'message', label: 'Messaggio', on: 'bg-sky-500 border-sky-500',      off: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
                { value: 'event',   label: 'Evento',    on: 'bg-violet-500 border-violet-500', off: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
                { value: 'offer',   label: 'Offerta',   on: 'bg-orange-500 border-orange-500', off: 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700' },
              ] as const).map(({ value, label, on, off }) => (
                <button key={value} type="button" onClick={() => setMessageType(value)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border-2 transition-all ${messageType === value ? `${on} text-white` : off}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Contenuto</h2>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                Titolo {needsTitle ? <span className="text-red-500">*</span> : <span className="font-normal text-gray-400">(opzionale)</span>}
              </label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value.slice(0, 100))}
                placeholder={needsTitle ? 'Titolo obbligatorio per eventi/offerte…' : 'Aggiungi un titolo…'}
                className={inputCls} maxLength={100} />
              <p className="text-xs text-gray-400 mt-1 text-right">{title.length}/100</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Testo *</label>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder="Scrivi il messaggio…"
                className={`${inputCls} resize-none`} maxLength={500} />
              <p className="text-xs text-gray-400 mt-1 text-right">{text.length}/500</p>
            </div>
          </div>

          {/* Options */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Opzioni</h2>
            {adminProfile && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Pubblicato come <span className="font-semibold text-gray-700 dark:text-gray-300">{adminProfile.username}</span>
              </p>
            )}
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div onClick={() => setIsAnonymous(a => !a)}
                className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${isAnonymous ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isAnonymous ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">Anonimo</span>
            </label>
          </div>

          {/* Timing */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Tempistiche</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Ritardo visibilità — <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                  {DELAY_OPTIONS.find(d => d.value === delaySeconds)?.label ?? `${delaySeconds}s`}
                </span>
              </label>
              <div className="flex flex-wrap gap-2">
                {DELAY_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => setDelaySeconds(o.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${delaySeconds === o.value ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                Scadenza — <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {customExpiryDate
                    ? `il ${new Date(customExpiryDate + 'T23:59:59').toLocaleDateString('it-IT')}`
                    : EXPIRY_OPTIONS.find(o => o.value === expiresMinutes)?.label ?? `${expiresMinutes} min`}
                </span>
              </label>
              <div className="flex flex-wrap gap-2 mb-3">
                {EXPIRY_OPTIONS.map(o => (
                  <button key={o.value} type="button" onClick={() => { setExpiresMinutes(o.value); setCustomExpiryDate('') }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${expiresMinutes === o.value && !customExpiryDate ? 'bg-emerald-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">O scegli una data precisa</label>
                <input type="date" value={customExpiryDate}
                  min={(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0] })()}
                  onChange={e => {
                    setCustomExpiryDate(e.target.value)
                    if (e.target.value) {
                      const end = new Date(e.target.value + 'T23:59:59')
                      setExpiresMinutes(Math.max(Math.round((end.getTime() - Date.now()) / 60000), 1))
                    }
                  }}
                  className="px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        {/* ─── Right column ─── */}
        <div className="space-y-4">

          {/* Location */}
          <div className={cardCls}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                Posizione {!isGlobal && <span className="text-red-500">*</span>}
              </h2>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div onClick={() => setIsGlobal(g => !g)}
                  className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${isGlobal ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                  <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${isGlobal ? 'translate-x-5' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-300">Globale</span>
              </label>
            </div>
            {isGlobal ? (
              <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                Il messaggio sarà visibile a tutti gli utenti, ovunque si trovino.
              </p>
            ) : (
              <>
                <p className="text-xs text-gray-400 -mt-2">Clicca sulla mappa oppure inserisci le coordinate</p>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Latitudine</label>
                    <input type="number" value={lat} onChange={e => setLat(e.target.value)} step="any" placeholder="41.9"
                      className={inputCls} />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Longitudine</label>
                    <input type="number" value={lng} onChange={e => setLng(e.target.value)} step="any" placeholder="12.5"
                      className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Luogo associato {loadingPlaces && <span className="text-gray-400">(caricamento…)</span>}
                  </label>
                  <select value={placeId} onChange={e => setPlaceId(e.target.value)} className={inputCls}
                    disabled={loadingPlaces}>
                    <option value="">— Nessuno —</option>
                    {places.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                    ))}
                  </select>
                </div>
                <div ref={mapRef} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 cursor-crosshair"
                  style={{ height: 300 }} />
              </>
            )}
          </div>

          {/* Image */}
          <div className={cardCls}>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Foto <span className="font-normal text-gray-400">(opzionale)</span></h2>
            {imagePreview ? (
              <div className="relative rounded-lg overflow-hidden">
                <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                <button type="button"
                  onClick={() => { setImageUrl(null); setImagePreview(null); if (fileInputRef.current) fileInputRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-10 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-all">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isUploading ? 'Caricamento…' : 'Clicca per caricare un\'immagine'}
                </p>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = ev => setImagePreview(ev.target?.result as string)
                reader.readAsDataURL(file)
                const url = await uploadImage(file)
                if (url) setImageUrl(url)
              }} />
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <span className="flex-1">{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-600 font-bold leading-none">×</button>
            </div>
          )}

          {/* Submit */}
          <button type="submit"
            disabled={isSubmitting || !text.trim() || (!isGlobal && !hasLocation) || (needsTitle && !title.trim())}
            className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-sm">
            <Send className="w-4 h-4" />
            {isSubmitting ? 'Creazione…' : 'Crea messaggio'}
          </button>
        </div>

      </form>
    </div>
  )
}
