'use client';

import * as React from 'react';
import {
  ColumnDef,
  ColumnFiltersState,
  RowSelectionState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
  PaginationState,
} from '@tanstack/react-table';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface BulkAction {
  label: string;
  variant?: 'default' | 'destructive' | 'outline';
  onClick: (selectedIds: string[]) => void;
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  totalCount?: number;
  pagination?: PaginationState;
  onPaginationChange?: (state: PaginationState) => void;
  searchPlaceholder?: string;
  searchColumn?: string;
  loading?: boolean;
  emptyMessage?: string;
  toolbar?: React.ReactNode;
  enableRowSelection?: boolean;
  bulkActions?: BulkAction[];
}

export function DataTable<TData extends { id?: string }, TValue>({
  columns,
  data,
  totalCount,
  pagination,
  onPaginationChange,
  searchPlaceholder = 'Filter…',
  searchColumn,
  loading,
  emptyMessage = 'No results.',
  toolbar,
  enableRowSelection,
  bulkActions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [internalPagination, setInternalPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 20 });

  const isServerPaginated = !!pagination && !!onPaginationChange;
  const activePagination = isServerPaginated ? pagination : internalPagination;
  const pageCount = isServerPaginated && totalCount
    ? Math.ceil(totalCount / activePagination.pageSize)
    : undefined;

  const selectionColumn: ColumnDef<TData, TValue> = {
    id: '__select__',
    header: ({ table }) => (
      <input
        type="checkbox"
        checked={table.getIsAllPageRowsSelected()}
        ref={(el) => { if (el) el.indeterminate = table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected(); }}
        onChange={table.getToggleAllPageRowsSelectedHandler()}
        className="h-4 w-4 accent-primary cursor-pointer"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        checked={row.getIsSelected()}
        onChange={row.getToggleSelectedHandler()}
        className="h-4 w-4 accent-primary cursor-pointer"
      />
    ),
    size: 40,
    enableSorting: false,
  };

  const allColumns = enableRowSelection ? [selectionColumn, ...columns] : columns;

  const table = useReactTable({
    data,
    columns: allColumns,
    state: { sorting, columnFilters, columnVisibility, pagination: activePagination, rowSelection },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: isServerPaginated
      ? (updater) => {
          const next = typeof updater === 'function' ? updater(activePagination) : updater;
          onPaginationChange(next);
        }
      : setInternalPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: isServerPaginated ? getCoreRowModel() : getFilteredRowModel(),
    manualPagination: isServerPaginated,
    pageCount,
  });

  const currentPage = activePagination.pageIndex;
  const totalPages = pageCount ?? table.getPageCount();
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedIds = selectedRows.map((r) => (r.original as { id?: string }).id ?? '').filter(Boolean);
  const hasSelection = selectedRows.length > 0;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        {searchColumn && (
          <Input
            placeholder={searchPlaceholder}
            value={(table.getColumn(searchColumn)?.getFilterValue() as string) ?? ''}
            onChange={(e) => table.getColumn(searchColumn)?.setFilterValue(e.target.value)}
            className="h-9 max-w-sm"
          />
        )}
        {toolbar && <div className="ms-auto flex items-center gap-2">{toolbar}</div>}
      </div>

      {/* Bulk action bar */}
      {hasSelection && bulkActions && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2 text-sm">
          <span className="text-muted-foreground font-medium">{selectedRows.length} selected</span>
          <div className="h-4 w-px bg-border mx-1" />
          {bulkActions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? 'outline'}
              size="sm"
              onClick={() => { action.onClick(selectedIds); setRowSelection({}); }}
            >
              {action.label}
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setRowSelection({})}>
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        onClick={header.column.getToggleSortingHandler()}
                        className="flex items-center gap-1 font-medium hover:text-foreground"
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getIsSorted() === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : header.column.getIsSorted() === 'desc' ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {allColumns.map((_, j) => (
                    <TableCell key={j}>
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                  className={cn(row.getIsSelected() && 'bg-primary/5')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={allColumns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        {totalCount !== undefined && (
          <span>{totalCount} record{totalCount !== 1 ? 's' : ''}</span>
        )}
        <div className="ms-auto flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            {currentPage + 1} / {Math.max(1, totalPages)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => table.setPageIndex(Math.max(0, totalPages - 1))}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
