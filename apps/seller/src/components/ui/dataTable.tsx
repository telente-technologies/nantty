import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

import styles from "./dataTable.module.css";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: ReactNode;
  readonly render: (row: Row) => ReactNode;
  readonly align?: "start" | "end" | "center";
  readonly width?: string;
  readonly hideBelowTablet?: boolean;
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
}

export function DataTable<Row>({ caption, columns, rows, readRowKey, isLoading, emptyState, onRowActivate, hasMore, onLoadMore, isLoadingMore }: DataTableProps<Row>) {
  const showSkeleton = isLoading && (!rows || rows.length === 0);
  return (
    <div className={styles.wrapper}>
      <div className={styles.scroller}>
        <table className={styles.table}>
          <caption className="visuallyHidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" style={{ width: column.width, textAlign: column.align === "end" ? "right" : column.align === "center" ? "center" : "left" }} className={column.hideBelowTablet ? styles.hideBelowTablet : undefined}>
                  {column.header}
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
                      <td key={column.key} style={{ textAlign: column.align === "end" ? "right" : column.align === "center" ? "center" : "left" }} className={column.hideBelowTablet ? styles.hideBelowTablet : undefined}>
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
      {!showSkeleton && rows && rows.length === 0 ? <div className={styles.empty}>{emptyState ?? "Nothing here yet."}</div> : null}
      {hasMore && onLoadMore ? (
        <div className={styles.footer}>
          <Button size="small" onClick={onLoadMore} isBusy={isLoadingMore}>
            Load more
          </Button>
        </div>
      ) : null}
    </div>
  );
}
