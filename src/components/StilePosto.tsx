import type { TemaLocale } from '../lib/locali'

/* I campi dello stile di un posto: emoji, colore, saluto, motto, testi e
   frasi pronte. Li usano i locali e gli eventi, che nell'app si propongono
   nello stesso modo ("Sei al Diesis", "Sei alla Sagra"). */

const campo = 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white'
const etichetta = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

export function StilePosto({ tema, onTema, salutoPredefinito, esempioSaluto }: {
  tema: TemaLocale
  onTema: (p: Partial<TemaLocale>) => void
  /** Cosa scrive l'app se il saluto resta vuoto. */
  salutoPredefinito: string
  esempioSaluto: string
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div><label className={etichetta}>Emoji</label><input className={campo} maxLength={4} value={tema.emoji ?? ''} onChange={e => onTema({ emoji: e.target.value || undefined })} /></div>
        <div>
          <label className={etichetta}>Colore principale (vuoto = quello della skin)</label>
          <div className="flex items-center gap-2">
            <input type="color" value={tema.colori?.signal ?? '#888888'} onChange={e => onTema({ colori: { ...tema.colori, signal: e.target.value } })} className="w-10 h-9 rounded border border-gray-200 dark:border-gray-700" />
            {tema.colori?.signal && <button onClick={() => onTema({ colori: { ...tema.colori, signal: undefined } })} className="text-xs text-gray-500 hover:text-rose-500">togli</button>}
          </div>
        </div>
      </div>
      <div>
        <label className={etichetta}>Saluto: la scritta del posto, nella fascia e nella proposta (vuoto = "{salutoPredefinito}")</label>
        <input className={campo} maxLength={40} placeholder={esempioSaluto} value={tema.saluto ?? ''} onChange={e => onTema({ saluto: e.target.value || undefined })} />
      </div>
      <div><label className={etichetta}>Motto (sotto il saluto, nella proposta)</label><input className={campo} value={tema.motto ?? ''} onChange={e => onTema({ motto: e.target.value || undefined })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={etichetta}>Pulsante per scrivere</label><input className={campo} maxLength={30} value={tema.testi?.lascia ?? ''} onChange={e => onTema({ testi: { ...tema.testi, lascia: e.target.value || undefined } })} /></div>
        <div><label className={etichetta}>Invio</label><input className={campo} maxLength={30} value={tema.testi?.invia ?? ''} onChange={e => onTema({ testi: { ...tema.testi, invia: e.target.value || undefined } })} /></div>
        <div><label className={etichetta}>Bacheca vuota</label><input className={campo} maxLength={80} value={tema.testi?.vuoto ?? ''} onChange={e => onTema({ testi: { ...tema.testi, vuoto: e.target.value || undefined } })} /></div>
      </div>
      <div>
        <label className={etichetta}>Frasi pronte (una per riga, massimo 5)</label>
        <textarea rows={3} className={campo} value={(tema.frasi ?? []).join('\n')}
          onChange={e => onTema({ frasi: e.target.value.split('\n').slice(0, 5) })} />
      </div>
    </>
  )
}
