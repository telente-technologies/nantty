import styles from "./help.module.css";

export function HelpSearchForm({ defaultQuery = "" }: { readonly defaultQuery?: string }) {
  return (
    <form className={styles.searchForm} action="/help" method="get" role="search">
      <label htmlFor="help-search" className={styles.visuallyHidden}>Search help</label>
      <input id="help-search" className={styles.input} type="search" name="q" defaultValue={defaultQuery} placeholder="Search help, for example refund, username or checkmark" maxLength={120} />
      <button type="submit" className={styles.button}>Search</button>
    </form>
  );
}
