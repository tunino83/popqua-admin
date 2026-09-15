import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// ⚠️  NON aggiungere qui una service role key.
//
// Vite inlinea ogni variabile `VITE_*` nel bundle JS servito al browser:
// una service role key finirebbe in chiaro su adm.popqua.it, leggibile da
// chiunque apra i devtools — anche senza login, perché il bundle viene
// scaricato prima dell'autenticazione. Quella chiave scavalca tutte le RLS,
// quindi equivarrebbe a pubblicare accesso totale in lettura e scrittura
// all'intero database.
//
// I permessi admin vanno applicati lato server: policy RLS che controllano
// `user_profiles.role`, oppure una Edge Function che tiene la service key
// fra i suoi secret.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { flowType: 'pkce', detectSessionInUrl: true },
});

// Mantenuto solo per compatibilità con i call site esistenti: le scritture
// passano dalle RLS come utente autenticato, esattamente come `supabase`.
export const supabaseAdmin = supabase;
