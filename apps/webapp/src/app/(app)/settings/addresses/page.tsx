import type { Metadata } from "next";
import Link from "next/link";

import { AddressBook } from "@/components/address/addressBook";
import styles from "@/components/settings/settings.module.css";
import { IconLabel } from "@/components/ui/appIcon";

export const metadata: Metadata = { title: "Addresses" };

export default function AddressesPage() {
  return (
    <div className={styles.page}>
      <div>
        <Link href="/settings"><IconLabel name="arrowLeft24" size={16}>Settings</IconLabel></Link>
        <h1 className={styles.title}>Addresses</h1>
      </div>
      <AddressBook />
    </div>
  );
}
