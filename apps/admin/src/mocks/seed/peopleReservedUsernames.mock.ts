import type { ReservedUsernameEntry } from "@/types/usernames.type";

export function buildDemoReservedUsernames(): ReservedUsernameEntry[] {
  const addedAt = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
  const rows: Omit<ReservedUsernameEntry, "id" | "addedAt" | "addedByName">[] = [
    { value: "zudomart", kind: "EXACT", category: "BRAND", note: "Legacy brand" },
    { value: "zudomart*", kind: "PREFIX", category: "BRAND", note: "Blocks zudomart_support, zudomartng and similar" },
    { value: "*official*", kind: "PATTERN", category: "SYSTEM", note: "Only Black-verified accounts may use 'official'" },
    { value: "admin", kind: "EXACT", category: "SYSTEM", note: null },
    { value: "support", kind: "EXACT", category: "SYSTEM", note: null },
    { value: "help", kind: "EXACT", category: "SYSTEM", note: null },
    { value: "dangote", kind: "EXACT", category: "PUBLIC_FIGURE", note: "Frequent impersonation target" },
    { value: "davido", kind: "EXACT", category: "PUBLIC_FIGURE", note: "Held until artist claims" },
    { value: "burnaboy", kind: "EXACT", category: "PUBLIC_FIGURE", note: "Held until artist claims" },
    { value: "efcc", kind: "EXACT", category: "GOVERNMENT", note: "Economic and Financial Crimes Commission" },
    { value: "cbn*", kind: "PREFIX", category: "GOVERNMENT", note: "Central Bank of Nigeria" },
    { value: "statehouse", kind: "EXACT", category: "GOVERNMENT", note: null },
    { value: "flutterwave", kind: "EXACT", category: "BRAND", note: "Payment partner" },
  ];
  return rows.map((row, index) => ({ ...row, id: `rsv_${String(index + 1).padStart(3, "0")}`, addedAt: addedAt(300 - index * 11), addedByName: index % 3 === 0 ? "Tolu Adeyemi" : "Chidi Okafor" }));
}
