import styles from "./landingSyncSection.module.css";

const sharedRecords = [
  { title: "Products and stock", description: "Add a product here and it is in your app store. Sell one at the counter and the app shows one fewer." },
  { title: "Orders", description: "Marketplace orders from the app land here to pack and ship; counter sales show in the app's seller area." },
  { title: "Wallet", description: "Escrow, pending and available balances are the same numbers you see on your phone." },
  { title: "Customers", description: "Buyers who follow you in the app and walk-in customers live in one list with their loyalty points." },
];

export function LandingSyncSection() {
  return (
    <section className={styles.section} aria-labelledby="sync-heading">
      <div className={styles.inner}>
        <figure className={styles.photoFrame}>
          <img src="/photos/fruitStandSeller.webp" alt="A trader at her market stall checking orders on her phone" width={1400} height={1000} loading="lazy" className={styles.photo} />
          <figcaption className={styles.photoCaption}>Your phone and your counter, one account.</figcaption>
        </figure>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Same account as the app</p>
          <h2 id="sync-heading" className={styles.heading}>
            Nothing to import. It is already your store.
          </h2>
          <ul className={styles.list}>
            {sharedRecords.map((record) => (
              <li key={record.title}>
                <h3>{record.title}</h3>
                <p>{record.description}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
