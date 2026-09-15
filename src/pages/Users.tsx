import { useEffect, useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table'
import { Ban, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

interface Profile {
  id: string
  username: string
  role: string | null
  avatar_url: string | null
  created_at: string
}

const columnHelper = createColumnHelper<Profile>()

const roleBadge = (role: string | null) => {
  if (role === 'admin')   return 'bg-rose-100 dark:bg-rose-900 text-rose-700 dark:text-rose-300'
  if (role === 'premium') return 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300'
  return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

export default function Users() {
  const navigate = useNavigate()
  const [data, setData]           = useState<Profile[]>([])
  const [loading, setLoading]     = useState(true)
  const [globalFilter, setGlobalFilter] = useState('')
  const [pageSize, setPageSize]   = useState(25)

  useEffect(() => {
    async function load() {
      try {
        const { data: rows } = await supabase
          .from('user_profiles')
          .select('id, username, role, avatar_url, created_at')
          .order('created_at', { ascending: false })
        setData(rows ?? [])
      } catch { /* leave empty */ } finally { setLoading(false) }
    }
    load()
  }, [])

  const columns = useMemo(() => [
    columnHelper.display({
      id: 'avatar',
      header: 'Avatar',
      cell: ({ row }) => {
        const u = row.original
        return u.avatar_url ? (
          <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
            {u.username?.[0]?.toUpperCase() ?? '?'}
          </div>
        )
      },
    }),
    columnHelper.accessor('username', {
      header: 'Username',
      cell: info => <span className="font-medium text-gray-900 dark:text-white">{info.getValue()}</span>,
    }),
    columnHelper.accessor('role', {
      header: 'Ruolo',
      cell: info => (
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${roleBadge(info.getValue())}`}>
          {info.getValue() ?? 'user'}
        </span>
      ),
    }),
    columnHelper.accessor('created_at', {
      header: 'Creato il',
      cell: info => new Date(info.getValue()).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Azioni',
      cell: () => (
        <button
          className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200 transition-colors"
          title="Sospendi utente"
          onClick={e => e.stopPropagation()}
        >
          <Ban className="w-4 h-4" />Sospendi
        </button>
      ),
    }),
  ], [])

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter, pagination: { pageIndex: 0, pageSize } },
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  // Sync pageSize changes
  useEffect(() => {
    table.setPageSize(pageSize)
  }, [pageSize])

  const totalFiltered = table.getFilteredRowModel().rows.length
  const { pageIndex } = table.getState().pagination
  const pageCount = table.getPageCount()

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Cerca per username…"
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-56"
          />
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">
          {totalFiltered} utenti
        </span>
        {/* Per-page */}
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <span>Righe per pagina:</span>
          <div className="flex gap-1">
            {PAGE_SIZE_OPTIONS.map(n => (
              <button key={n} onClick={() => setPageSize(n)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${pageSize === n ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Caricamento…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => (
                    <th key={h.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {table.getRowModel().rows.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">Nessun utente trovato</td></tr>
              ) : table.getRowModel().rows.map(row => (
                <tr key={row.id} onClick={() => navigate(`/users/${row.original.id}`)}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination — centrata, sopra il FAB */}
      <div className="flex items-center justify-center gap-3 pb-16 text-sm text-gray-600 dark:text-gray-400">
        <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-medium">
          «
        </button>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold min-w-[80px] text-center">
          {pageIndex + 1} / {pageCount || 1}
        </span>

        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}
          className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
        <button onClick={() => table.setPageIndex(pageCount - 1)} disabled={!table.getCanNextPage()}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs font-medium">
          »
        </button>
      </div>
    </div>
  )
}
