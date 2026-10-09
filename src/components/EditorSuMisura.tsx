import { useEffect } from 'react'

/* Editor della skin "su misura" di un locale: lo stesso formato di
   src/lib/suMisura.ts nell'app (che pulisce i dati prima di usarli). */

export const FONT = {
  archivo: ['Archivo', "'Archivo', sans-serif"],
  bricolage: ['Bricolage Grotesque', "'Bricolage Grotesque', sans-serif"],
  jost: ['Jost', "'Jost', sans-serif"],
  barlow: ['Barlow Condensed', "'Barlow Condensed', sans-serif"],
  saira: ['Saira Condensed', "'Saira Condensed', sans-serif"],
  anton: ['Anton', "'Anton', sans-serif"],
  tabellone: ['Big Shoulders Display', "'Big Shoulders Display', sans-serif"],
  college: ['Graduate', "'Graduate', serif"],
  elegante: ['Cormorant Garamond', "'Cormorant Garamond', serif"],
  pennello: ['Caveat Brush', "'Caveat Brush', cursive"],
  pennarello: ['Permanent Marker', "'Permanent Marker', cursive"],
  mano: ['Patrick Hand', "'Patrick Hand', cursive"],
  neon: ['Tilt Neon', "'Tilt Neon', sans-serif"],
  macchina: ['Courier Prime', "'Courier Prime', monospace"],
  digitale: ['VT323', "'VT323', monospace"],
  mono: ['Space Mono', "'Space Mono', monospace"],
} as const
type Font = keyof typeof FONT

const MOTIVI = { tinta: 'Tinta unita', puntini: 'Puntini', righe: 'Righe (quaderno)', quadretti: 'Quadretti', piastrelle: 'Piastrelle', vernice: 'Schizzi di vernice', gessato: 'Gessato' }
const FOGLI = { postit: 'Post-it', biglietto: 'Biglietto con matrice', scaletta: 'Scaletta battuta a macchina', insegna: 'Insegna (bordo al neon)', lavagna: 'Lavagna con cornice', pass: 'Pass / badge', cartoncino: 'Cartoncino del menù', scontrino: 'Scontrino' }
const PULSANTI = { pieno: 'Pieno', neon: 'Tubo al neon', contorno: 'Contorno', storto: 'Storto con ombra' }
const COLORI: [keyof Aspetto['colori'], string][] = [
  ['sfondo', 'Sfondo'], ['superficie', 'Superfici'], ['testo', 'Testo'], ['testo2', 'Testo secondario'],
  ['accento', 'Accento (pulsanti, fascia)'], ['secondario', 'Secondario'], ['evidenziatore', 'Evidenziatore'], ['barra', 'Barra in basso'],
]

export interface Aspetto {
  scuro: boolean
  colori: { sfondo: string; superficie: string; testo: string; testo2: string; accento: string; secondario: string; evidenziatore: string; barra: string }
  motivo: keyof typeof MOTIVI
  fontTitoli: Font
  fontTesto: Font
  fogli: Record<'piccolo' | 'medio' | 'grande', { tipo: keyof typeof FOGLI; colore: string }>
  pulsante: keyof typeof PULSANTI
  alone: boolean
}

export const PARTENZE: Record<string, { nome: string; aspetto: Aspetto }> = {
  pub: { nome: 'Pub al neon (tipo Diesis)', aspetto: {
    scuro: true, colori: { sfondo: '#120C24', superficie: '#1B1236', testo: '#F4EEFF', testo2: '#C2B8DA', accento: '#FF2E63', secondario: '#2EB8FF', evidenziatore: '#FFE14D', barra: '#0B0716' },
    motivo: 'vernice', fontTitoli: 'pennello', fontTesto: 'archivo',
    fogli: { piccolo: { tipo: 'pass', colore: '#1B1236' }, medio: { tipo: 'scaletta', colore: '#F7F5EF' }, grande: { tipo: 'insegna', colore: '#140D28' } },
    pulsante: 'neon', alone: true } },
  pizzeria: { nome: 'Pizzeria / trattoria', aspetto: {
    scuro: true, colori: { sfondo: '#1C120C', superficie: '#2A1C14', testo: '#FFF3E2', testo2: '#D9BFA3', accento: '#FF6A2B', secondario: '#2FA66A', evidenziatore: '#FFD166', barra: '#120A06' },
    motivo: 'piastrelle', fontTitoli: 'pennarello', fontTesto: 'jost',
    fogli: { piccolo: { tipo: 'scontrino', colore: '#FFF8EC' }, medio: { tipo: 'cartoncino', colore: '#FFF3E2' }, grande: { tipo: 'lavagna', colore: '#26302B' } },
    pulsante: 'storto', alone: false } },
  caffe: { nome: 'Caffè chiaro', aspetto: {
    scuro: false, colori: { sfondo: '#F6F0E6', superficie: '#FFFFFF', testo: '#2B1D14', testo2: '#6E5A4B', accento: '#8C4A2F', secondario: '#3D6B5A', evidenziatore: '#F2C230', barra: '#2B1D14' },
    motivo: 'gessato', fontTitoli: 'elegante', fontTesto: 'jost',
    fogli: { piccolo: { tipo: 'postit', colore: '#FFF2B8' }, medio: { tipo: 'cartoncino', colore: '#FFFFFF' }, grande: { tipo: 'lavagna', colore: '#2F3A33' } },
    pulsante: 'pieno', alone: false } },
  scuola: { nome: 'Scuola / università', aspetto: {
    scuro: false, colori: { sfondo: '#FBFAF4', superficie: '#FFFFFF', testo: '#1B2240', testo2: '#3D4766', accento: '#1F4FB5', secondario: '#2F4A3A', evidenziatore: '#FFF06A', barra: '#1B2240' },
    motivo: 'righe', fontTitoli: 'mano', fontTesto: 'archivo',
    fogli: { piccolo: { tipo: 'postit', colore: '#FFF06A' }, medio: { tipo: 'cartoncino', colore: '#FBFAF4' }, grande: { tipo: 'lavagna', colore: '#2F4A3A' } },
    pulsante: 'storto', alone: false } },
}

const campo = 'w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white'
const etichetta = 'block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1'

/* I caratteri dell'app, per l'anteprima: dal CDN di Google Fonts. */
function useFontAnteprima() {
  useEffect(() => {
    if (document.getElementById('font-su-misura')) return
    const famiglie = Object.values(FONT).map(([n]) => `family=${n.replace(/ /g, '+')}`).join('&')
    const l = document.createElement('link')
    l.id = 'font-su-misura'; l.rel = 'stylesheet'
    l.href = `https://fonts.googleapis.com/css2?${famiglie}&display=swap`
    document.head.appendChild(l)
  }, [])
}

const sopra = (hex: string) => {
  const n = parseInt(hex.slice(1), 16)
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 > 0.58 ? '#17150F' : '#FFFFFF'
}

function sfondoMotivo(a: Aspetto): React.CSSProperties {
  const t = `${a.colori.testo}22`
  const m: Record<string, [string, string]> = {
    tinta: ['none', 'auto'],
    puntini: [`radial-gradient(${t} 1.2px, transparent 1.6px)`, '12px 12px'],
    righe: [`repeating-linear-gradient(transparent 0 31px, ${t} 31px 32px)`, 'auto'],
    quadretti: [`linear-gradient(${t} 1px, transparent 1px), linear-gradient(90deg, ${t} 1px, transparent 1px)`, '24px 24px'],
    piastrelle: [`linear-gradient(${t} 1px, transparent 1px), linear-gradient(90deg, ${t} 1px, transparent 1px)`, '64px 32px'],
    gessato: [`repeating-linear-gradient(90deg, ${t} 0 1px, transparent 1px 22px)`, 'auto'],
    vernice: [`radial-gradient(circle at 15% 20%, ${a.colori.accento}55 0 8%, transparent 20%), radial-gradient(circle at 85% 70%, ${a.colori.secondario}55 0 8%, transparent 20%)`, 'auto'],
  }
  const [img, size] = m[a.motivo]
  return { backgroundColor: a.colori.sfondo, backgroundImage: img, backgroundSize: size }
}

function FoglioAnteprima({ a, f, testo }: { a: Aspetto; f: Aspetto['fogli']['piccolo']; testo: string }) {
  const ink = sopra(f.colore)
  const s: React.CSSProperties = { background: f.colore, color: ink, padding: '10px 12px', fontSize: 13, fontWeight: 700, position: 'relative', boxShadow: '0 3px 8px rgba(0,0,0,0.25)' }
  const glow = a.alone ? { textShadow: `0 0 6px ${a.colori.accento}` } : {}
  switch (f.tipo) {
    case 'postit': return <div style={{ ...s, transform: 'rotate(-1.5deg)' }}>{testo}</div>
    case 'biglietto': return <div style={{ ...s, borderRight: `14px solid ${a.colori.accento}` }}>{testo}</div>
    case 'scaletta': return <div style={{ ...s, fontFamily: FONT.macchina[1] }}>{testo}</div>
    case 'insegna': return <div style={{ ...s, border: `3px solid ${a.colori.accento}`, borderRadius: 12, fontFamily: FONT[a.fontTitoli][1], fontWeight: 400, fontSize: 20, boxShadow: a.alone ? `0 0 12px ${a.colori.accento}` : s.boxShadow, ...glow }}>{testo}</div>
    case 'lavagna': return <div style={{ ...s, border: '6px solid #A9825A', fontFamily: FONT[a.fontTitoli][1], fontWeight: 400, fontSize: 19 }}>{testo}</div>
    case 'pass': return <div style={{ ...s, border: `2px solid ${a.colori.secondario}`, borderRadius: 9, paddingTop: 16, boxShadow: a.alone ? `0 0 10px ${a.colori.secondario}` : s.boxShadow }}>{testo}</div>
    case 'cartoncino': return <div style={{ ...s, borderTop: `3px double ${a.colori.accento}`, borderBottom: `3px double ${a.colori.accento}` }}>{testo}</div>
    case 'scontrino': return <div style={{ ...s, fontFamily: FONT.macchina[1], borderBottom: '3px dashed rgba(0,0,0,0.25)' }}>{testo}</div>
  }
}

function PulsanteAnteprima({ a, testo }: { a: Aspetto; testo: string }) {
  const c = a.colori
  const base: React.CSSProperties = { padding: '9px 18px', fontFamily: FONT[a.fontTitoli][1], fontSize: 17, display: 'inline-block' }
  if (a.pulsante === 'neon') return <span style={{ ...base, border: `2.5px solid ${c.accento}`, color: c.accento, borderRadius: 10, textShadow: `0 0 8px ${c.accento}`, boxShadow: `0 0 12px ${c.accento}` }}>{testo}</span>
  if (a.pulsante === 'contorno') return <span style={{ ...base, border: `2px solid ${c.testo}`, color: c.testo, borderRadius: 6 }}>{testo}</span>
  if (a.pulsante === 'storto') return <span style={{ ...base, background: c.accento, color: sopra(c.accento), transform: 'rotate(-2deg)', boxShadow: `3px 3px 0 ${c.testo}` }}>{testo}</span>
  return <span style={{ ...base, background: c.accento, color: sopra(c.accento), borderRadius: 8 }}>{testo}</span>
}

export function AnteprimaSuMisura({ a, nome, lascia }: { a: Aspetto; nome: string; lascia: string }) {
  useFontAnteprima()
  return (
    <div style={{ ...sfondoMotivo(a), color: a.colori.testo, fontFamily: FONT[a.fontTesto][1], borderRadius: 18, overflow: 'hidden', border: '6px solid #111' }}>
      <div style={{ background: a.colori.accento, color: sopra(a.colori.accento), padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>Stile di {nome || 'locale'}</div>
      <div style={{ padding: '14px 14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: FONT[a.fontTitoli][1], fontSize: 28, lineHeight: 1, ...(a.alone ? { textShadow: `0 0 10px ${a.colori.accento}` } : {}) }}>Piazza Bellini</div>
        <div style={{ fontSize: 11, color: a.colori.testo2 }}>6 messaggi · 2 timbri</div>
        <FoglioAnteprima a={a} f={a.fogli.grande} testo="Stasera musica dal vivo!" />
        <FoglioAnteprima a={a} f={a.fogli.medio} testo="Chi c'è per un tavolo da quattro?" />
        <FoglioAnteprima a={a} f={a.fogli.piccolo} testo="Ciao da qui" />
      </div>
      <div style={{ background: a.colori.barra, borderTop: `2px solid ${a.colori.accento}`, padding: '10px', textAlign: 'center' }}>
        <PulsanteAnteprima a={a} testo={lascia || 'Attacca'} />
      </div>
    </div>
  )
}

export function EditorSuMisura({ a, onChange }: { a: Aspetto; onChange: (a: Aspetto) => void }) {
  const set = (p: Partial<Aspetto>) => onChange({ ...a, ...p })
  return (
    <div className="space-y-4">
      <div>
        <label className={etichetta}>Parti da</label>
        <div className="flex flex-wrap gap-2">
          {Object.entries(PARTENZE).map(([k, p]) => (
            <button key={k} type="button" onClick={() => onChange(structuredClone(p.aspetto))}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">{p.nome}</button>
          ))}
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
        <input type="checkbox" checked={a.scuro} onChange={e => set({ scuro: e.target.checked })} className="accent-indigo-600" /> Tema scuro
        <input type="checkbox" checked={a.alone} onChange={e => set({ alone: e.target.checked })} className="accent-indigo-600 ml-4" /> Alone neon su titoli e insegne
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {COLORI.map(([k, n]) => (
          <label key={k} className="block">
            <span className={etichetta}>{n}</span>
            <span className="flex items-center gap-2">
              <input type="color" value={a.colori[k]} onChange={e => set({ colori: { ...a.colori, [k]: e.target.value } })} className="w-9 h-9 rounded border border-gray-200 dark:border-gray-700" />
              <span className="text-xs font-mono text-gray-500">{a.colori[k]}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className={etichetta}>Motivo dello sfondo</label>
          <select className={campo} value={a.motivo} onChange={e => set({ motivo: e.target.value as Aspetto['motivo'] })}>
            {Object.entries(MOTIVI).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
          </select></div>
        <div><label className={etichetta}>Carattere dei titoli</label>
          <select className={campo} value={a.fontTitoli} onChange={e => set({ fontTitoli: e.target.value as Font })}>
            {Object.entries(FONT).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
          </select></div>
        <div><label className={etichetta}>Carattere del testo</label>
          <select className={campo} value={a.fontTesto} onChange={e => set({ fontTesto: e.target.value as Font })}>
            {Object.entries(FONT).map(([k, [n]]) => <option key={k} value={k}>{n}</option>)}
          </select></div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['piccolo', 'medio', 'grande'] as const).map(k => (
          <div key={k} className="space-y-1">
            <label className={etichetta}>{k === 'piccolo' ? 'Messaggio piccolo (100 m)' : k === 'medio' ? 'Messaggio medio (300 m)' : 'Messaggio grande (500 m)'}</label>
            <select className={campo} value={a.fogli[k].tipo} onChange={e => set({ fogli: { ...a.fogli, [k]: { ...a.fogli[k], tipo: e.target.value } } })}>
              {Object.entries(FOGLI).map(([t, n]) => <option key={t} value={t}>{n}</option>)}
            </select>
            <span className="flex items-center gap-2">
              <input type="color" value={a.fogli[k].colore} onChange={e => set({ fogli: { ...a.fogli, [k]: { ...a.fogli[k], colore: e.target.value } } })} className="w-9 h-9 rounded border border-gray-200 dark:border-gray-700" />
              <span className="text-xs text-gray-500">carta</span>
            </span>
          </div>
        ))}
      </div>
      <div className="w-1/3"><label className={etichetta}>Pulsante per scrivere</label>
        <select className={campo} value={a.pulsante} onChange={e => set({ pulsante: e.target.value as Aspetto['pulsante'] })}>
          {Object.entries(PULSANTI).map(([k, n]) => <option key={k} value={k}>{n}</option>)}
        </select></div>
    </div>
  )
}
