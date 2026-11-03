export function walletSummaryQueryOptions(viewerId: string | null) {
  const enabled = viewerId !== null;
  return {
    wallet: {
      queryKey: ["rail", "wallet", viewerId] as const,
      enabled,
      retry: false,
      staleTime: 60_000,
    },
    coins: {
      queryKey: ["rail", "coins", viewerId] as const,
      enabled,
      retry: false,
      staleTime: 60_000,
    },
  };
}
