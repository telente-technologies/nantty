import Link from "next/link";

import { AlertIcon, ArrowRightIcon } from "@/components/ui/icons";

import styles from "./verifyToWithdrawBanner.module.css";

interface VerifyToWithdrawBannerProps {
  readonly message: string;
  readonly href: string;
  readonly actionLabel: string;
}

export function VerifyToWithdrawBanner({ message, href, actionLabel }: VerifyToWithdrawBannerProps) {
  return (
    <section className={styles.banner} role="status" aria-label="Verify to withdraw">
      <AlertIcon size={20} />
      <div className={styles.body}>
        <p className={styles.title}>{message}</p>
        <p className={styles.note}>Your money is safe and stays in your wallet until you finish verifying. Nothing is lost while you wait.</p>
        <Link className={styles.action} href={href}>{actionLabel} <ArrowRightIcon size={14} /></Link>
      </div>
    </section>
  );
}
