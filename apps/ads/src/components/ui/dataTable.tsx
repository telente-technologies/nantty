"use client";

import { useMemo, useState, type ReactNode } from "react";

import { ColumnPicker } from "@/components/ui/columnPicker";

import styles from "./dataTable.module.css";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: string;
  readonly render: (row: Row) => ReactNode;
  readonly sortValue?: (row: Row) => number | string | null;
  readonly align?: "start" | "end";
  readonly isAlwaysVisible?: boolean;
  readonly isHiddenByDefault?: boolean;
  readonly width?: number;
  readonly footer?: ReactNode;
}

interface DataTableProps<Row> {
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly readRowId: (row: Row) => string;
  readonly selectedRowIds?: ReadonlySet<string>;
  readonly onSelectedRowIdsChange?: (selectedIds: Set<string>) => void;
  readonly toolbar?: ReactNode;
  readonly emptyState?: ReactNode;
  readonly showColumnPicker?: boolean;
  readonly visibleColumnKeys?: readonly string[];
  readonly onVisibleColumnKeysChange?: (keys: string[]) => void;
  readonly hasFooter?: boolean;
}

type SortState = { readonly key: string; readonly direction: "ascending" | "descending" } | null;

export function DataTable<Row>(props: DataTableProps<Row>) {
  const { columns, rows, readRowId, selectedRowIds, onSelectedRowIdsChange } = props;
  const [internalVisibleKeys, setInternalVisibleKeys] = useState<string[]>(() => columns.filter((column) => !column.isHiddenByDefault).map((column) => column.key));
  const visibleKeys = props.visibleColumnKeys ?? internalVisibleKeys;
  const changeVisibleKeys = props.onVisibleColumnKeysChange ?? setInternalVisibleKeys;
  const [sortState, setSortState] = useState<SortState>(null);
  const visibleColumns = columns.filter((column) => column.isAlwaysVisible || visibleKeys.includes(column.key));

  const sortedRows = useMemo(() => {
    if (!sortState) return rows;
    const sortColumn = columns.find((column) => column.key === sortState.key);
    if (!sortColumn?.sortValue) return rows;
    const readSortValue = sortColumn.sortValue;
    const multiplier = sortState.direction === "ascending" ? 1 : -1;
    return [...rows].sort((first, second) => {
      const firstValue = readSortValue(first);
      const secondValue = readSortValue(second);
      if (firstValue === secondValue) return 0;
      if (firstValue === null) return 1;
      if (secondValue === null) return -1;
      return firstValue > secondValue ? multiplier : -multiplier;
    });
  }, [rows, columns, sortState]);

  const isSelectable = Boolean(onSelectedRowIdsChange && selectedRowIds);
  const areAllRowsSelected = isSelectable && rows.length > 0 && rows.every((row) => selectedRowIds?.has(readRowId(row)));

  function toggleSortForColumn(columnKey: string) {
    setSortState((current) => {
      if (current?.key !== columnKey) return { key: columnKey, direction: "descending" };
      return current.direction === "descending" ? { key: columnKey, direction: "ascending" } : null;
    });
  }

  function toggleRowSelection(rowId: string) {
    if (!selectedRowIds || !onSelectedRowIdsChange) return;
    const next = new Set(selectedRowIds);
    if (next.has(rowId)) next.delete(rowId);
    else next.add(rowId);
    onSelectedRowIdsChange(next);
  }

  function toggleAllRows() {
    if (!onSelectedRowIdsChange) return;
    onSelectedRowIdsChange(areAllRowsSelected ? new Set() : new Set(rows.map(readRowId)));
  }

  return (
    <div className={styles.wrapper}>
      {props.toolbar || props.showColumnPicker ? (
        <div className={styles.toolbar}>
          <div className={styles.toolbarStart}>{props.toolbar}</div>
          {props.showColumnPicker ? <ColumnPicker columns={columns.filter((column) => !column.isAlwaysVisible).map((column) => ({ key: column.key, label: column.header }))} visibleKeys={visibleKeys} onVisibleKeysChange={changeVisibleKeys} /> : null}
        </div>
      ) : null}
      <div className={styles.scroller} tabIndex={0} role="region" aria-label={props.caption}>
        <table className={styles.table}>
          <caption className="visuallyHidden">{props.caption}</caption>
          <thead>
            <tr>
              {isSelectable ? (
                <th scope="col" className={styles.selectCell}>
                  <input type="checkbox" aria-label="Select all rows" checked={areAllRowsSelected} onChange={toggleAllRows} />
                </th>
              ) : null}
              {visibleColumns.map((column) => {
                const sortDirection = sortState?.key === column.key ? sortState.direction : undefined;
                return (
                  <th key={column.key} scope="col" aria-sort={sortDirection ?? "none"} className={column.align === "end" ? styles.alignEnd : undefined} style={column.width ? { minWidth: column.width } : undefined}>
                    {column.sortValue ? (
                      <button type="button" className={styles.sortButton} onClick={() => toggleSortForColumn(column.key)}>
                        {column.header}
                        <span aria-hidden className={styles.sortMark}>
                          {sortDirection === "ascending" ? "↑" : sortDirection === "descending" ? "↓" : ""}
                        </span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => {
              const rowId = readRowId(row);
              const isSelected = selectedRowIds?.has(rowId) ?? false;
              return (
                <tr key={rowId} className={isSelected ? styles.selectedRow : undefined}>
                  {isSelectable ? (
                    <td className={styles.selectCell}>
                      <input type="checkbox" aria-label="Select row" checked={isSelected} onChange={() => toggleRowSelection(rowId)} />
                    </td>
                  ) : null}
                  {visibleColumns.map((column) => (
                    <td key={column.key} className={column.align === "end" ? `${styles.alignEnd} numeric` : undefined}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {props.hasFooter && rows.length > 0 ? (
            <tfoot>
              <tr>
                {isSelectable ? <td className={styles.selectCell} /> : null}
                {visibleColumns.map((column) => (
                  <td key={column.key} className={column.align === "end" ? `${styles.alignEnd} numeric` : undefined}>
                    {column.footer}
                  </td>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
        {rows.length === 0 ? <div className={styles.empty}>{props.emptyState ?? "Nothing to show yet."}</div> : null}
      </div>
    </div>
  );
}
