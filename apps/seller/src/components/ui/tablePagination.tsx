import { Button } from "@/components/ui/button";

import styles from "./tablePagination.module.css";

export function TablePagination({ pageIndex, pageCount, totalCount, pageSize, onPageChange, itemLabel = "items" }: { readonly pageIndex: number; readonly pageCount: number; readonly totalCount: number; readonly pageSize: number; readonly onPageChange: (pageIndex: number) => void; readonly itemLabel?: string }) {
  if (totalCount === 0) return null;
  const firstShown = pageIndex * pageSize + 1;
  const lastShown = Math.min(totalCount, firstShown + pageSize - 1);
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className={styles.summary}>
        {firstShown}–{lastShown} of {totalCount} {itemLabel}
      </span>
      <span className={styles.controls}>
        <Button size="small" variant="ghost" disabled={pageIndex === 0} onClick={() => onPageChange(pageIndex - 1)}>
          Previous
        </Button>
        <span className={styles.pageLabel}>
          Page {pageIndex + 1} of {pageCount}
        </span>
        <Button size="small" variant="ghost" disabled={pageIndex >= pageCount - 1} onClick={() => onPageChange(pageIndex + 1)}>
          Next
        </Button>
      </span>
    </nav>
  );
}
