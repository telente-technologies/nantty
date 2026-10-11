"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

import styles from "./dataTable.module.css";

export interface DataTableColumn<Row> {
  readonly key: string;
  readonly header: ReactNode;
  readonly render: (row: Row) => ReactNode;
  readonly width?: string;
  readonly align?: "start" | "end" | "center";
  readonly isMono?: boolean;
}

interface DataTableProps<Row> {
  readonly caption: string;
  readonly columns: readonly DataTableColumn<Row>[];
  readonly rows: readonly Row[];
  readonly readRowKey: (row: Row) => string;
  readonly onRowOpen?: (row: Row) => void;
  readonly selectedRowKey?: string | null;
  readonly isLoading?: boolean;
  readonly emptyMessage?: ReactNode;
}

export function DataTable<Row>({ caption, columns, rows, readRowKey, onRowOpen, selectedRowKey, isLoading = false, emptyMessage = "Nothing here yet." }: DataTableProps<Row>) {
  const bodyRef = useRef<HTMLTableSectionElement>(null);

  function focusRowAtOffset(currentRow: HTMLElement, offset: number) {
    const rowElements = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>("tr[data-row-key]") ?? []);
    const nextRow = rowElements[rowElements.indexOf(currentRow) + offset];
    nextRow?.focus();
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: Row) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowOpen?.(row);
    } else if (event.key === "ArrowDown" || event.key === "j") {
      event.preventDefault();
      focusRowAtOffset(event.currentTarget, 1);
    } else if (event.key === "ArrowUp" || event.key === "k") {
      event.preventDefault();
      focusRowAtOffset(event.currentTarget, -1);
    }
  }

  return (
    <div className={styles.frame}>
      <table className={styles.table}>
        <caption className="visuallyHidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" style={{ width: column.width, textAlign: column.align ?? "start" }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody ref={bodyRef} aria-busy={isLoading || undefined}>
          {isLoading && rows.length === 0
            ? Array.from({ length: 6 }, (_, index) => (
                <tr key={`skeleton-${index}`} className={styles.skeletonRow}>
                  {columns.map((column) => (
                    <td key={column.key}>
                      <span className={styles.skeletonBar} />
                    </td>
                  ))}
                </tr>
              ))
            : null}
          {!isLoading && rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const rowKey = readRowKey(row);
            const className = [onRowOpen ? styles.interactiveRow : "", rowKey === selectedRowKey ? styles.selectedRow : ""].filter(Boolean).join(" ");
            return (
              <tr
                key={rowKey}
                data-row-key={rowKey}
                className={className || undefined}
                tabIndex={onRowOpen ? 0 : undefined}
                aria-selected={onRowOpen ? rowKey === selectedRowKey : undefined}
                onClick={onRowOpen ? () => onRowOpen(row) : undefined}
                onKeyDown={onRowOpen ? (event) => handleRowKeyDown(event, row) : undefined}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.isMono ? styles.monoCell : undefined} style={{ textAlign: column.align ?? "start" }}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
