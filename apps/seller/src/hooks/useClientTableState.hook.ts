"use client";

import { useMemo, useState } from "react";

import type { TableSortState } from "@/components/ui/dataTable";

export type TableSortValueReader<Row> = (row: Row) => string | number | null;

export interface ClientTableState<Row> {
  readonly visibleRows: Row[] | null;
  readonly sortState: TableSortState | null;
  readonly setSortState: (sortState: TableSortState) => void;
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly totalCount: number;
  readonly pageSize: number;
  readonly setPageIndex: (pageIndex: number) => void;
}

function compareSortValues(left: string | number | null, right: string | number | null): number {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
}

export function useClientTableState<Row>(rows: readonly Row[] | null, sortValueReaders: Record<string, TableSortValueReader<Row>>, options: { readonly pageSize?: number; readonly initialSort?: TableSortState | null } = {}): ClientTableState<Row> {
  const pageSize = options.pageSize ?? 10;
  const [sortState, setSortStateValue] = useState<TableSortState | null>(options.initialSort ?? null);
  const [requestedPageIndex, setPageIndex] = useState(0);

  const sortedRows = useMemo(() => {
    if (!rows) return null;
    const readSortValue = sortState ? sortValueReaders[sortState.key] : undefined;
    if (!sortState || !readSortValue) return [...rows];
    const directionMultiplier = sortState.direction === "ascending" ? 1 : -1;
    return [...rows].sort((left, right) => compareSortValues(readSortValue(left), readSortValue(right)) * directionMultiplier);
  }, [rows, sortState, sortValueReaders]);

  const totalCount = sortedRows?.length ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const pageIndex = Math.min(requestedPageIndex, pageCount - 1);
  const visibleRows = sortedRows ? sortedRows.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize) : null;

  function setSortState(nextSortState: TableSortState) {
    setSortStateValue(nextSortState);
    setPageIndex(0);
  }

  return { visibleRows, sortState, setSortState, pageIndex, pageCount, totalCount, pageSize, setPageIndex };
}
