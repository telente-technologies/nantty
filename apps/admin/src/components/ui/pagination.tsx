import { Button } from "./button";
import styles from "./pagination.module.css";

export function Pagination({ page, pageSize, total, onPageChange }: { readonly page: number; readonly pageSize: number; readonly total: number; readonly onPageChange: (page: number) => void }) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(total, page * pageSize);
  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className={styles.summary}>
        {firstShown}–{lastShown} of {total.toLocaleString("en-NG")}
      </span>
      <Button size="small" variant="ghost" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <Button size="small" variant="ghost" onClick={() => onPageChange(page + 1)} disabled={page >= lastPage}>
        Next
      </Button>
    </nav>
  );
}
