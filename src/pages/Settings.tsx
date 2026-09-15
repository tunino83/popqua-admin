import { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Database, MapPin, Radio } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Settings() {
  const [radiusMeters, setRadiusMeters] = useState<number | null>(null)
  const [radiusInput, setRadiusInput] = useState('')
  const [connected, setConnected] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('radius_meters')
          .eq('id', 1)
          .single()
        if (error) throw error
        setRadiusMeters(data.radius_meters)
        setRadiusInput(String(data.radius_meters))
        setConnected(true)
      } catch {
        setConnected(false)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleSaveRadius() {
    const val = parseInt(radiusInput)
    if (isNaN(val) || val < 100 || val > 50000) { setSaveMsg('Valore non valido (100–50000 m)'); return }
    setSaving(true); setSaveMsg(null)
    const { error } = await supabase.from('system_settings').update({ radius_meters: val }).eq('id', 1)
    if (error) setSaveMsg('Errore nel salvataggio')
    else { setRadiusMeters(val); setSaveMsg('Salvato!') }
    setSaving(false)
    setTimeout(() => setSaveMsg(null), 3000)
  }

  return (
    <div className="space-y-8 max-w-3xl">
      {/* App config */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Configurazione App</h2>
        {loading ? (
          <div className="text-gray-400 text-sm py-4">Caricamento…</div>
        ) : (
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-50 dark:bg-indigo-950 p-2.5 rounded-lg">
                <MapPin className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Raggio di ricerca messaggi</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Distanza massima entro cui vengono mostrati i messaggi agli utenti</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number" value={radiusInput} onChange={e => setRadiusInput(e.target.value)}
                min={100} max={50000} step={100}
                className="w-36 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm text-gray-500 dark:text-gray-400">metri</span>
              <button onClick={handleSaveRadius} disabled={saving}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {saving ? 'Salvataggio…' : 'Salva'}
              </button>
              {saveMsg && (
                <span className={`text-sm font-medium ${saveMsg === 'Salvato!' ? 'text-emerald-600' : 'text-red-500'}`}>{saveMsg}</span>
              )}
            </div>
            {radiusMeters !== null && (
              <p className="text-xs text-gray-400">Valore attuale: <strong>{radiusMeters.toLocaleString('it-IT')} m</strong> ({(radiusMeters / 1000).toFixed(1)} km)</p>
            )}
          </div>
        )}
      </section>

      {/* System status */}
      <section>
        <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          Stato Sistema
        </h2>
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm divide-y divide-gray-100 dark:divide-gray-800">
          {/* Supabase */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">Supabase</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {import.meta.env.VITE_SUPABASE_URL}
                </p>
              </div>
            </div>
            {connected === null ? (
              <span className="text-xs text-gray-400">Verifica…</span>
            ) : connected ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle className="w-4 h-4" />
                Connesso
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <XCircle className="w-4 h-4" />
                Errore
              </span>
            )}
          </div>

          {/* Version */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Radio className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              <p className="text-sm font-medium text-gray-900 dark:text-white">Versione Admin Panel</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950 px-2.5 py-1 rounded-full">
              v1.0.0
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
