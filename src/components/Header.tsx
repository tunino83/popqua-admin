import { Menu } from 'lucide-react'

/* Solo su schermi stretti: il pulsante del menu e il marchio. Su schermi
   larghi non c'e' intestazione: il titolo lo mette ogni pagina
   (Intestazione in ui.tsx) e tema ed esci stanno in fondo al menu.
   Prima l'intestazione ripeteva il titolo, sbagliato su cinque pagine
   ("Admin"), con un'etichetta "Admin" fissa anche per i gestori. */
export default function Header({ onApriMenu }: { onApriMenu?: () => void }) {
  return (
    <header className="lg:hidden h-14 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center px-4 gap-3 flex-shrink-0">
      <button onClick={onApriMenu} aria-label="Apri il menu"
        className="p-2 -ml-2 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
        <Menu className="w-5 h-5" />
      </button>
      <img src="/icona.png" alt="" className="w-7 h-7 rounded-lg" />
      <span className="font-display text-base font-bold text-gray-900 dark:text-white">POPQua</span>
    </header>
  )
}
