import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import styles from "./dataTable.module.css";
import { NanttyIcon } from "@/components/ui/nanttyIcon";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: ReactNode;
  readonly render: (row: Row) => ReactNode;
  readonly align?: "start" | "end" | "center";
  readonly width?: string;
  readonly hideBelowTablet?: boolean;
  readonly sortKey?: string;
  readonly mobileLabel?: string;
}

export interface TableSortState {
  readonly key: string;
  readonly direction: "ascending" | "descending";
}

interface DataTableProps<Row> {
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[] | null;
  readonly readRowKey: (row: Row) => string;
  readonly isLoading?: boolean;
  readonly emptyState?: ReactNode;
  readonly onRowActivate?: (row: Row) => void;
  readonly hasMore?: boolean;
  readonly onLoadMore?: () => void;
  readonly isLoadingMore?: boolean;
  readonly sortState?: TableSortState | null;
  readonly onSortChange?: (sortState: TableSortState) => void;
  readonly errorMessage?: string | null;
  readonly onRetry?: () => void;
  readonly footer?: ReactNode;
}

function readNextSortState(current: TableSortState | null | undefined, sortKey: string): TableSortState {
  if (current?.key !== sortKey) return { key: sortKey, direction: "descending" };
  return { key: sortKey, direction: current.direction === "descending" ? "ascending" : "descending" };
}

export function DataTable<Row>({ caption, columns, rows, readRowKey, isLoading, emptyState, onRowActivate, hasMore, onLoadMore, isLoadingMore, sortState, onSortChange, errorMessage, onRetry, footer }: DataTableProps<Row>) {
  const showSkeleton = isLoading && (!rows || rows.length === 0);
  const showError = Boolean(errorMessage) && !isLoading && (!rows || rows.length === 0);
  return (
    <div className={styles.wrapper}>
      <div className={styles.scroller} role="region" aria-label={caption} tabIndex={0}>
        <table className={`${styles.table} ${styles.stackOnPhones}`}>
          <caption className="visuallyHidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  style={{ width: column.width, textAlign: column.align === "end" ? "right" : column.align === "center" ? "center" : "left" }}
                  className={column.hideBelowTablet ? styles.hideBelowTablet : undefined}
                  aria-sort={column.sortKey && sortState?.key === column.sortKey ? sortState.direction : undefined}
                >
                  {column.sortKey && onSortChange ? (
                    <button type="button" className={styles.sortButton} onClick={() => onSortChange(readNextSortState(sortState, column.sortKey as string))}>
                      {column.header}
                      <span aria-hidden="true" className={styles.sortMark}>
                        <NanttyIcon name={sortState?.key === column.sortKey ? (sortState.direction === "ascending" ? "caretUp24" : "caretDown24") : "caretUpDown24"} size={14} />
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {showSkeleton
              ? Array.from({ length: 6 }, (_, rowIndex) => (
                  <tr key={`skeleton-${rowIndex}`} aria-hidden="true">
                    {columns.map((column) => (
                      <td key={column.key} className={column.hideBelowTablet ? styles.hideBelowTablet : undefined}>
                        <span className={styles.skeleton} />
                      </td>
                    ))}
                  </tr>
                ))
              : (rows ?? []).map((row) => (
                  <tr
                    key={readRowKey(row)}
                    className={onRowActivate ? styles.clickableRow : undefined}
                    onClick={onRowActivate ? () => onRowActivate(row) : undefined}
                    onKeyDown={onRowActivate ? (event) => { if (event.key === "Enter") onRowActivate(row); } : undefined}
                    tabIndex={onRowActivate ? 0 : undefined}
                  >
                    {columns.map((column) => (
                      <td key={column.key} data-label={column.mobileLabel ?? (typeof column.header === "string" ? column.header : "")} style={{ textAlign: column.align === "end" ? "right" : column.align === "center" ? "center" : "left" }} className={column.hideBelowTablet ? styles.hideBelowTablet : undefined}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {showError ? (
        <div className={styles.error} role="alert">
          <p>{errorMessage}</p>
          {onRetry ? (
            <Button size="small" onClick={onRetry}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
      {!showSkeleton && !showError && rows && rows.length === 0 ? <div className={styles.empty}>{emptyState ?? "Nothing here yet."}</div> : null}
      {hasMore && onLoadMore ? (
        <div className={styles.footer}>
          <Button size="small" onClick={onLoadMore} isBusy={isLoadingMore}>
            Load more
          </Button>
        </div>
      ) : null}
      {footer ? <div className={styles.footer}>{footer}</div> : null}
    </div>
  );
}
