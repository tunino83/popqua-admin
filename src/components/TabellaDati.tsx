import { useMemo, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type ColumnFiltersState,
  type Column,
  type PaginationState,
  type Row,
  type RowData,
  type SortingState,
  type Table,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'

/* Tabelle del pannello: ogni colonna si ordina toccando l'intestazione e si
 * filtra dalla riga sotto. Le colonne dicono come si cercano con `meta`:
 *
 *   filtro: 'testo'  casella, cerca dentro il testo (il default)
 *           'scelta' menu con i valori presenti, per le colonne con pochi
 *                    valori (tipo, stato, ruolo)
 *           false    niente filtro (le azioni)
 *   testo:  cosa si legge nella cella, quando il valore non e' gia' quello
 *           (le date: si ordina sull'ISO, si cerca su "12/10/2026") */

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData extends RowData, TValue> {
    filtro?: 'testo' | 'scelta' | false
    testo?: (riga: TData, valore: TValue) => string
  }
}

function norm(s: string) {
  return s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

function testoDi<T>(col: ColumnDef<T, any>, row: Row<T>, id: string): string {
  const v = row.getValue(id)
  if (col.meta?.testo) return col.meta.testo(row.original, v)
  if (v == null) return ''
  return Array.isArray(v) ? v.join(', ') : String(v)
}

/* Ordine "da persona": accenti e maiuscole non contano (Àlba sta fra le
   A) e i numeri dentro il testo vanno in ordine di valore (2 prima di 10).
   Le date ISO si ordinano bene cosi' come sono. */
const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' })
function confronta<T>(a: Row<T>, b: Row<T>, id: string) {
  const x = a.getValue(id), y = b.getValue(id)
  if (typeof x === 'number' && typeof y === 'number') return x - y
  return collator.compare(x == null ? '' : String(x), y == null ? '' : String(y))
}

interface Opzioni<T> {
  dati: T[]
  colonne: ColumnDef<T, any>[]
  /* Righe per pagina; senza, la tabella mostra tutto. */
  perPagina?: number
  ordine?: SortingState
  cercaGlobale?: string
}

export function useTabella<T>({ dati, colonne, perPagina, ordine, cercaGlobale }: Opzioni<T>): Table<T> {
  const [sorting, setSorting] = useState<SortingState>(ordine ?? [])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: perPagina ?? 20 })

  const columns = useMemo(() => colonne.map(c => ({
    sortingFn: confronta,
    sortDescFirst: false,
    ...c,
    filterFn: (row: Row<T>, id: string, cerca: string) => {
      const t = testoDi(c, row, id)
      return c.meta?.filtro === 'scelta' ? t === cerca : norm(t).includes(norm(cerca))
    },
  })), [colonne])

  return useReactTable({
    data: dati,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter: cercaGlobale ?? '',
      ...(perPagina ? { pagination } : {}),
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    ...(perPagina ? { getPaginationRowModel: getPaginationRowModel() } : {}),
  })
}

function Filtro<T>({ column, table }: { column: Column<T, unknown>; table: Table<T> }) {
  const tipo = column.columnDef.meta?.filtro ?? 'testo'
  const valore = (column.getFilterValue() as string) ?? ''
  const cls = 'w-full min-w-[70px] px-2 py-1 text-xs font-normal normal-case tracking-normal border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500'

  /* I valori del menu vengono da tutte le righe, non da quelle gia'
     filtrate: altrimenti scelto un valore gli altri sparirebbero. */
  const scelte = useMemo(() => {
    if (tipo !== 'scelta') return []
    const def = column.columnDef as ColumnDef<T, any>
    const s = new Set(table.getPreFilteredRowModel().rows.map(r => testoDi(def, r, column.id)))
    return [...s].sort((a, b) => a.localeCompare(b, 'it'))
  }, [tipo, column, table.getPreFilteredRowModel()])

  if (!column.getCanFilter() || tipo === false) return null
  if (tipo === 'scelta') {
    return (
      <select value={valore} onChange={e => column.setFilterValue(e.target.value || undefined)} className={cls}>
        <option value="">Tutti</option>
        {scelte.map(s => <option key={s} value={s}>{s || '—'}</option>)}
      </select>
    )
  }
  return (
    <input type="search" value={valore} placeholder="Filtra…"
      onChange={e => column.setFilterValue(e.target.value || undefined)} className={cls} />
  )
}

interface Props<T> {
  table: Table<T>
  vuoto: string
  onRiga?: (riga: T) => void
  classeRiga?: (riga: T) => string
  /* Le tabelle dentro una scheda (capsule, diagnostica) hanno righe piu'
     basse e l'intestazione senza fondo. */
  compatta?: boolean
  className?: string
}

export function TabellaDati<T>({ table, vuoto, onRiga, classeRiga, compatta, className = '' }: Props<T>) {
  const py = compatta ? 'py-2' : 'py-3'
  const righe = table.getRowModel().rows
  const filtrabile = table.getAllLeafColumns().some(c => c.getCanFilter() && c.columnDef.meta?.filtro !== false)

  return (
    <table className={`w-full text-sm ${className}`}>
      <thead className={compatta
        ? 'text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800'
        : 'bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700'}>
        {table.getHeaderGroups().map(hg => (
          <tr key={hg.id}>
            {hg.headers.map(h => {
              const ord = h.column.getIsSorted()
              const Freccia = ord === 'asc' ? ArrowUp : ord === 'desc' ? ArrowDown : ArrowUpDown
              const titolo = flexRender(h.column.columnDef.header, h.getContext())
              return (
                <th key={h.id} aria-sort={ord === 'asc' ? 'ascending' : ord === 'desc' ? 'descending' : undefined}
                  className={`px-4 ${py} text-left ${compatta ? 'font-medium' : 'text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider'}`}>
                  {h.column.getCanSort() ? (
                    <button type="button" onClick={h.column.getToggleSortingHandler()}
                      className={`inline-flex items-center gap-1 ${compatta ? '' : 'uppercase'} hover:text-gray-900 dark:hover:text-white transition-colors`}>
                      {titolo}
                      <Freccia className={`w-3.5 h-3.5 ${ord ? 'text-indigo-500' : 'opacity-30'}`} />
                    </button>
                  ) : titolo}
                </th>
              )
            })}
          </tr>
        ))}
        {filtrabile && table.getHeaderGroups().slice(-1).map(hg => (
          <tr key={`${hg.id}-filtri`}>
            {hg.headers.map(h => (
              <th key={h.id} className="px-4 pb-2 pt-0 text-left font-normal">
                <Filtro column={h.column} table={table} />
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody className={compatta ? '' : 'divide-y divide-gray-100 dark:divide-gray-800'}>
        {righe.length === 0 ? (
          <tr><td colSpan={table.getAllLeafColumns().length} className="px-4 py-10 text-center text-gray-400">{vuoto}</td></tr>
        ) : righe.map(row => (
          <tr key={row.id} onClick={onRiga ? () => onRiga(row.original) : undefined}
            className={`${compatta ? 'border-b border-gray-100 dark:border-gray-800 last:border-0' : ''} ${onRiga ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors' : ''} ${classeRiga?.(row.original) ?? ''}`}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id} className={`px-4 ${py} ${compatta ? '' : 'text-gray-700 dark:text-gray-300'}`}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
