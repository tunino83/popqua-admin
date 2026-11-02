import { useEffect, useMemo, useState } from 'react'
import { Printer, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { Intestazione, Sezione, cls, bottone } from '../components/ui'

/* QR di POPQua in generale, senza un locale dietro: per volantini,
   bacheche, banchetti, biglietti da lasciare in giro. Il QR porta al
   sito, che fa scaricare l'app. Si sceglie una frase (o se ne scrive
   una), poi si stampa: cartelli A6 (4 per foglio) o biglietti da
   visita 85×55 mm (10 per foglio), con i segni per il taglio. */

const FRASI = [
  { titolo: 'Lascia un messaggio qui.', sotto: 'Lo legge chi passa da questo posto.' },
  { titolo: 'Qualcuno ha scritto qualcosa qui.', sotto: 'Lo vedi solo se ci sei.' },
  { titolo: 'I posti parlano.', sotto: 'Messaggi che restano dove li lasci.' },
  { titolo: 'C’è un messaggio a pochi passi da te.', sotto: 'Inquadra e guarda intorno.' },
  { titolo: 'Scrivi dove sei.', sotto: 'Chi passa di qui, legge.' },
  { titolo: 'Non è un social.', sotto: 'È un muro, ma digitale. E sparisce.' },
]

type Formato = 'biglietto' | 'cartello'
const FORMATI: { id: Formato; nome: string; nota: string }[] = [
  { id: 'biglietto', nome: 'Biglietti da visita', nota: '85×55 mm, 10 per foglio A4' },
  { id: 'cartello', nome: 'Cartelli A6', nota: '105×148 mm, 4 per foglio A4' },
]

const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const STILE = `
  @page { size: A4; margin: 0 }
  * { box-sizing: border-box }
  body { margin: 0; font-family: 'Bricolage Grotesque', system-ui, sans-serif; color: #17150F; -webkit-print-color-adjust: exact; print-color-adjust: exact }
  .marchio { display: flex; align-items: center; gap: 1.6mm; font-weight: 800 }
  .marchio img { border-radius: 22% }
  .sito { color: #DD5E45; font-weight: 700 }

  .fb { display: grid; grid-template-columns: repeat(2, 85mm); grid-auto-rows: 55mm; justify-content: center; align-content: center; height: 297mm }
  .b { border: 0.2mm dashed #c8c8c8; padding: 5mm; display: flex; gap: 4mm; align-items: stretch; background: #fff; overflow: hidden }
  .b .t { flex: 1; display: flex; flex-direction: column; min-width: 0 }
  .b .marchio { font-size: 3.6mm } .b .marchio img { width: 5.5mm; height: 5.5mm }
  .b h1 { margin: auto 0 1.2mm; font-size: 4.6mm; line-height: 1.08; letter-spacing: -0.01em }
  .b p { margin: 0; font-size: 2.6mm; line-height: 1.3; color: #555 }
  .b .sito { font-size: 2.8mm; margin-top: 2mm }
  .b .q { width: 34mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1mm }
  .b .q img { width: 34mm; height: 34mm }
  .b .q span { font-size: 2.1mm; color: #777 }

  .fc { display: grid; grid-template-columns: 105mm 105mm; grid-template-rows: 148mm 148mm }
  .c { border: 0.2mm dashed #bbb; padding: 10mm 9mm; display: flex; flex-direction: column; align-items: center; text-align: center; background: #fff }
  .c .marchio { font-size: 6mm } .c .marchio img { width: 9mm; height: 9mm }
  .c h1 { margin: 6mm 0 2mm; font-size: 8mm; line-height: 1.08; letter-spacing: -0.01em }
  .c p { margin: 0; font-size: 4mm; line-height: 1.35; color: #555 }
  .c .q { width: 58mm; height: 58mm; margin: 6mm 0 3mm }
  .c .i { font-size: 3.4mm; color: #777 }
  .c .sito { margin-top: auto; font-size: 4.2mm }
`

function pezzo(f: Formato, o: { titolo: string; sotto: string; qr: string; icona: string }) {
  const marchio = `<div class="marchio"><img src="${o.icona}" alt="">POPQua</div>`
  if (f === 'biglietto') return `<div class="b"><div class="t">${marchio}<h1>${esc(o.titolo)}</h1><p>${esc(o.sotto)}</p><div class="sito">popqua.it</div></div>
    <div class="q"><img src="${o.qr}" alt=""><span>Inquadra con la fotocamera</span></div></div>`
  return `<div class="c">${marchio}<h1>${esc(o.titolo)}</h1><p>${esc(o.sotto)}</p>
    <img class="q" src="${o.qr}" alt=""><div class="i">Inquadra con la fotocamera</div><div class="sito">popqua.it</div></div>`
}

export function foglio(f: Formato, o: Parameters<typeof pezzo>[1], tutti: boolean, stampa: boolean) {
  const n = f === 'biglietto' ? 10 : 4
  const corpo = tutti ? `<div class="${f === 'biglietto' ? 'fb' : 'fc'}">${pezzo(f, o).repeat(n)}</div>` : pezzo(f, o)
  const anteprima = tutti ? '' : `body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#EBEBE7}
    .b{width:85mm;height:55mm;border-style:solid}.c{width:105mm;height:148mm;border-style:solid}`
  return `<!doctype html><html><head><meta charset="utf-8"><title>QR POPQua</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700;800&display=swap">
    <style>${STILE}${anteprima}</style></head><body>${corpo}
    ${stampa ? '<script>window.onload=()=>document.fonts.ready.then(()=>setTimeout(()=>print(),300))<\/script>' : ''}</body></html>`
}

export default function QrPopqua() {
  const [scelta, setScelta] = useState(0)
  const [titolo, setTitolo] = useState(FRASI[0].titolo)
  const [sotto, setSotto] = useState(FRASI[0].sotto)
  const [formato, setFormato] = useState<Formato>('biglietto')
  const [link, setLink] = useState('https://popqua.it')
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    const url = link.trim() || 'https://popqua.it'
    QRCode.toDataURL(url, { errorCorrectionLevel: 'M', margin: 1, width: 1024, color: { dark: '#17150F', light: '#FFFFFF' } })
      .then(setQr).catch(() => setQr(null))
  }, [link])

  const icona = `${window.location.origin}/icona.png`
  const dati = { titolo: titolo.trim() || 'POPQua', sotto: sotto.trim(), qr: qr ?? '', icona }
  const anteprima = useMemo(() => (qr ? foglio(formato, dati, false, false) : ''), [formato, titolo, sotto, qr])

  function scegli(i: number) {
    setScelta(i); setTitolo(FRASI[i].titolo); setSotto(FRASI[i].sotto)
  }
  function stampa() {
    if (!qr) return
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(foglio(formato, dati, true, true))
    w.document.close()
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <Intestazione titolo="QR e biglietti" sottotitolo="QR di POPQua da stampare: biglietti da visita e cartelli con una frase, senza un locale dietro. Portano a popqua.it." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="space-y-5">
          <Sezione titolo="Frase" nota="Scegline una o scrivila tu.">
            <div className="grid gap-2">
              {FRASI.map((f, i) => (
                <button key={i} type="button" onClick={() => scegli(i)} aria-pressed={scelta === i}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${scelta === i
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">{f.titolo}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{f.sotto}</span>
                </button>
              ))}
            </div>
            <div>
              <label className={cls.etichetta} htmlFor="qr-titolo">Frase principale</label>
              <input id="qr-titolo" className={cls.campo} value={titolo} maxLength={60} onChange={e => { setTitolo(e.target.value); setScelta(-1) }} />
            </div>
            <div>
              <label className={cls.etichetta} htmlFor="qr-sotto">Riga sotto</label>
              <input id="qr-sotto" className={cls.campo} value={sotto} maxLength={70} onChange={e => { setSotto(e.target.value); setScelta(-1) }} />
            </div>
          </Sezione>

          <Sezione titolo="Formato">
            <div className="grid grid-cols-2 gap-2">
              {FORMATI.map(f => (
                <button key={f.id} type="button" onClick={() => setFormato(f.id)} aria-pressed={formato === f.id}
                  className={`text-left px-3 py-2 rounded-lg border transition-colors ${formato === f.id
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
                  <span className="block text-sm font-semibold text-gray-900 dark:text-white">{f.nome}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{f.nota}</span>
                </button>
              ))}
            </div>
            <div>
              <label className={cls.etichetta} htmlFor="qr-link">Dove porta il QR</label>
              <input id="qr-link" className={cls.campo} value={link} onChange={e => setLink(e.target.value)} />
              <p className="text-xs text-gray-400 mt-1">Di solito popqua.it. Si può cambiare, per esempio per contare le scansioni di un volantino con un indirizzo apposta.</p>
            </div>
          </Sezione>
        </div>

        <div className="space-y-5 lg:sticky lg:top-0">
          <Sezione titolo="Anteprima" nota="Così esce ogni pezzo; il foglio A4 ne contiene diversi, con i segni per il taglio.">
            <iframe title="Anteprima" srcDoc={anteprima} className={`w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-100 ${formato === 'biglietto' ? 'h-72' : 'h-[640px]'}`} />
            <div className="flex gap-2 flex-wrap">
              <button onClick={stampa} disabled={!qr} className={bottone()}><Printer className="w-4 h-4" />Stampa foglio A4</button>
              {qr && <a href={qr} download="qr-popqua.png" className={bottone('secondario')}><Download className="w-4 h-4" />Solo il QR (PNG)</a>}
            </div>
          </Sezione>
        </div>
      </div>
    </div>
  )
}
