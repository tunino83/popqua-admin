import type L from 'leaflet'

/* Il clic singolo sulla mappa, distinto dal doppio clic.

   Leaflet manda 'click' anche per ciascuno dei due tocchi di un doppio
   clic: chi ingrandiva con il doppio clic si trovava il modulo del
   messaggio aperto, o il punto spostato. Qui il clic aspetta un attimo: se
   arriva il secondo era uno zoom (lo fa Leaflet da se') e non succede
   altro. */
const ATTESA_MS = 250

export function suClicSingolo(map: L.Map, fai: (e: L.LeafletMouseEvent) => void) {
  let attesa: ReturnType<typeof setTimeout> | null = null
  const annulla = () => { if (attesa) { clearTimeout(attesa); attesa = null } }
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (attesa) { annulla(); return }
    attesa = setTimeout(() => { attesa = null; fai(e) }, ATTESA_MS)
  })
  map.on('dblclick', annulla)
  // Mappa smontata a meta' attesa: niente aggiornamenti dopo.
  map.on('unload', annulla)
}
