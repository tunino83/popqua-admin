import { supabase } from './supabase'

/* Elimina davvero un messaggio (31/10): prima "Elimina" toglieva la riga
   solo dallo schermo.
   - admin: admin_elimina_messaggio cancella il messaggio e le sue risposte
     (che altrimenti resterebbero orfane); reazioni, voti, segnalazioni e
     letture se ne vanno da sole.
   - gli altri: solo i propri messaggi, come permettono le regole di riga.
   Ritorna quanti messaggi ha tolto, o lancia l'errore. */
export async function eliminaMessaggio(id: string, isAdmin: boolean, userId?: string): Promise<number> {
  if (isAdmin) {
    const { data, error } = await supabase.rpc('admin_elimina_messaggio', { p_id: id })
    if (error) throw new Error(error.message)
    return Number(data ?? 0)
  }
  const { data, error } = await supabase.from('messages').delete().eq('id', id).eq('author_id', userId ?? '').select('id')
  if (error) throw new Error(error.message)
  return data?.length ?? 0
}

/* La domanda prima di cancellare: cosa si cancella, e che non si torna indietro. */
export function confermaElimina(testo: string | null | undefined): boolean {
  const anteprima = (testo ?? '').trim().slice(0, 80)
  return window.confirm(`Eliminare questo messaggio${anteprima ? ` ("${anteprima}${(testo ?? '').length > 80 ? '...' : ''}")` : ''} e le sue risposte?\nNon si puo' annullare.`)
}
