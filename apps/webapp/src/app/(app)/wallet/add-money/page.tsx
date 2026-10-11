import Link from "next/link";

import { WalletAccountCard } from "@/components/wallet/walletAccountCard";

import styles from "../page.module.css";

export const metadata = { title: "Add money" };

export default function AddMoneyPage() {
  return (
    <div className={styles.page}>
      <nav aria-label="Breadcrumb" className={styles.note}>
        <Link href="/wallet">Wallet</Link> / Add money
      </nav>
      <h1 className={styles.title}>Add money</h1>
      <WalletAccountCard />
    </div>
  );
}
