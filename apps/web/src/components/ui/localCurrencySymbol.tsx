"use client";

import { useVisitorLocaleFromApi } from "@/hooks/useVisitorLocale.hook";
import { readCurrencyDisplayName, readCurrencySymbolForDisplay } from "@/lib/currencyFormatting.util";

import styles from "./localCurrencySymbol.module.css";

export function LocalCurrencySymbol({ className }: { readonly className?: string }) {
  const visitorLocale = useVisitorLocaleFromApi();
  const combinedClassName = [styles.symbol, visitorLocale ? styles.ready : "", className].filter(Boolean).join(" ");
  if (!visitorLocale) return <span className={combinedClassName} aria-hidden="true" />;
  return (
    <span className={combinedClassName} title={readCurrencyDisplayName(visitorLocale.currency)}>
      {readCurrencySymbolForDisplay(visitorLocale.currency)}
    </span>
  );
}

export function LocalCurrencyName() {
  const visitorLocale = useVisitorLocaleFromApi();
  if (!visitorLocale) return <>your local currency</>;
  return <>{readCurrencyDisplayName(visitorLocale.currency)}</>;
}
