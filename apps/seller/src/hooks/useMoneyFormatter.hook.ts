"use client";

import { useCallback } from "react";

import { useStoreContext } from "@/hooks/useStoreSettings.hook";
import type { Money } from "@/types/money.type";
import { formatMoneyCompactForDisplay, formatMoneyForDisplay } from "@/utils/money.util";

export function useMoneyFormatter() {
  const { settings } = useStoreContext();
  const locale = settings?.locale ?? "en-NG";
  const formatMoney = useCallback((money: Money | null | undefined) => (money ? formatMoneyForDisplay(money, locale) : "—"), [locale]);
  const formatMoneyCompact = useCallback((money: Money | null | undefined) => (money ? formatMoneyCompactForDisplay(money, locale) : "—"), [locale]);
  return { formatMoney, formatMoneyCompact, currency: settings?.currency ?? null, locale };
}
