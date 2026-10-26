import styles from "./categoryMarquee.module.css";

const shoppingCategories = [
  "Ankara and aso-ebi",
  "Sneakers",
  "Phones and gadgets",
  "Skincare",
  "Hair and wigs",
  "Thrift",
  "Home and kitchen",
  "Perfumes",
  "Kids",
  "Snacks and small chops",
  "Beauty",
  "Computing",
] as const;

function CategoryList({ isDecorativeCopy }: { readonly isDecorativeCopy: boolean }) {
  return (
    <ul className={styles.list} aria-hidden={isDecorativeCopy || undefined}>
      {shoppingCategories.map((categoryName) => (
        <li key={categoryName} className={styles.item}>
          {categoryName}
        </li>
      ))}
    </ul>
  );
}

export function ScrollingShoppingCategoryMarquee() {
  return (
    <section className={styles.marquee} aria-label="Things people sell on Nantty">
      <div className={styles.track}>
        <CategoryList isDecorativeCopy={false} />
        <CategoryList isDecorativeCopy />
      </div>
    </section>
  );
}
