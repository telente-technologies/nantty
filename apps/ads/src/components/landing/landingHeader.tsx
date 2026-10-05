import Link from "next/link";

import { ZudomartWordmark } from "@zudomart/web-kit";

import { LandingActionLink, type LandingAction } from "./landingPrimitives";
import styles from "./landingLayout.module.css";

const landingNavigationLinks = [
  { href: "#formats", label: "Ad formats" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#targeting", label: "Targeting" },
  { href: "#billing", label: "Billing" },
  { href: "#reporting", label: "Reporting" },
  { href: "#questions", label: "FAQ" },
];

export function LandingHeaderWithFloatingNavigation({ primaryAction }: { readonly primaryAction: LandingAction }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerPill}>
        <Link href="/" className={styles.wordmarkLink} aria-label="Zudomart Ads home">
          <ZudomartWordmark productLabel="Ads" tone="onLight" withSymbol />
        </Link>
        <nav aria-label="Main" className={styles.headerNavigation}>
          <ul>
            {landingNavigationLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <LandingActionLink action={primaryAction} />
      </div>
    </header>
  );
}
